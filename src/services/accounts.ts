import type pg from 'pg';
import { ApiError, badRequest } from '../errors.js';
import { createApiKey, createProject, type Project } from './projects.js';

export interface AuthUserInput {
  subject: string;
  email?: string | null;
  name?: string | null;
  pictureUrl?: string | null;
}

export interface AuthenticatedAccount {
  user: {
    id: string;
    subject: string;
    email: string | null;
    name: string | null;
    picture_url: string | null;
  };
  organization: {
    id: string;
    name: string;
    role: 'owner' | 'admin' | 'member';
  };
}

export interface BillingSummary {
  plan: {
    id: string;
    name: string;
    price_cents: number;
    currency: string;
    billing_interval: string;
    included_events_monthly: number;
    included_mtu_monthly: number;
    included_projects: number;
    included_retention_months: number;
    included_seats: number;
    pricing_stage: string;
    features: Record<string, unknown>;
  };
  status: string;
  billing_limit_cents: number | null;
  current_period_start: string;
  current_period_end: string;
  meters: Array<{
    key: string;
    name: string;
    unit: string;
    aggregation: string;
    free_quantity: number;
    overage_unit_quantity: number;
    overage_price_cents: string;
    pricing_stage: string;
    source_note: string;
  }>;
}

export interface OnboardingInput {
  workspace_name: string;
  project_slug: string;
  project_name: string;
}

export interface OnboardingResult {
  organization: { id: string; name: string };
  project: Pick<Project, 'slug' | 'name' | 'timezone'>;
  tokens: {
    personal: string;
    ingest_prod: string;
  };
  mcp: {
    command: string;
    args: string[];
    package_status: 'published' | 'publish_pending';
    note: string;
    env: {
      POOLSTATIS_URL: string;
      POOLSTATIS_TOKEN: string;
    };
  };
}

export interface McpRunnerConfig {
  command: string;
  args: string[];
  packageStatus: 'published' | 'publish_pending';
  note: string;
}

function cleanText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function defaultOrgName(user: AuthUserInput): string {
  const display = cleanText(user.name, cleanText(user.email, 'Poolstatis'));
  return `${display}'s workspace`;
}

export async function getOrCreateAuthenticatedAccount(
  pool: pg.Pool,
  input: AuthUserInput,
): Promise<AuthenticatedAccount> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: userRows } = await client.query(
      `INSERT INTO auth_users (subject, email, name, picture_url, updated_at, last_seen_at)
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (subject) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, auth_users.email),
         name = COALESCE(EXCLUDED.name, auth_users.name),
         picture_url = COALESCE(EXCLUDED.picture_url, auth_users.picture_url),
         updated_at = now(),
         last_seen_at = now()
       RETURNING id, subject, email, name, picture_url`,
      [input.subject, input.email ?? null, input.name ?? null, input.pictureUrl ?? null],
    );
    const user = userRows[0];

    const { rows: memberships } = await client.query(
      `SELECT o.id, o.name, om.role
       FROM organization_members om
       JOIN organizations o ON o.id = om.org_id
       WHERE om.user_id = $1
       ORDER BY om.created_at
       LIMIT 1`,
      [user.id],
    );

    let organization = memberships[0];
    if (!organization) {
      const { rows: orgRows } = await client.query(
        'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name',
        [defaultOrgName(input)],
      );
      organization = { ...orgRows[0], role: 'owner' };
      await client.query(
        'INSERT INTO organization_members (org_id, user_id, role) VALUES ($1, $2, $3)',
        [organization.id, user.id, 'owner'],
      );
      await client.query(
        `INSERT INTO organization_billing (org_id, plan_id, status)
         VALUES ($1, 'free', 'free')
         ON CONFLICT (org_id) DO NOTHING`,
        [organization.id],
      );
    } else {
      await client.query(
        `INSERT INTO organization_billing (org_id, plan_id, status)
         VALUES ($1, 'free', 'free')
         ON CONFLICT (org_id) DO NOTHING`,
        [organization.id],
      );
    }

    await client.query('COMMIT');
    return {
      user,
      organization: {
        id: organization.id,
        name: organization.name,
        role: organization.role,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getBillingSummary(pool: pg.Pool, orgId: string): Promise<BillingSummary> {
  await pool.query(
    `INSERT INTO organization_billing (org_id, plan_id, status)
     VALUES ($1, 'free', 'free')
     ON CONFLICT (org_id) DO NOTHING`,
    [orgId],
  );
  const { rows } = await pool.query(
    `SELECT ob.status, ob.billing_limit_cents, ob.current_period_start, ob.current_period_end,
       bp.id, bp.name, bp.price_cents, bp.currency, bp.billing_interval,
       bp.included_events_monthly, bp.included_mtu_monthly, bp.included_projects,
       bp.included_retention_months, bp.included_seats, bp.pricing_stage, bp.features
     FROM organization_billing ob
     JOIN billing_plans bp ON bp.id = ob.plan_id
     WHERE ob.org_id = $1`,
    [orgId],
  );
  const plan = rows[0];
  if (!plan) throw new ApiError(500, 'billing_not_initialized', 'free billing plan was not initialized');

  const { rows: meters } = await pool.query(
    `SELECT key, name, unit, aggregation, free_quantity, overage_unit_quantity,
       overage_price_cents::text, pricing_stage, source_note
     FROM billing_meters
     WHERE active = true
     ORDER BY sort_order, key`,
  );

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      price_cents: plan.price_cents,
      currency: plan.currency,
      billing_interval: plan.billing_interval,
      included_events_monthly: Number(plan.included_events_monthly),
      included_mtu_monthly: Number(plan.included_mtu_monthly),
      included_projects: plan.included_projects,
      included_retention_months: plan.included_retention_months,
      included_seats: plan.included_seats,
      pricing_stage: plan.pricing_stage,
      features: plan.features,
    },
    status: plan.status,
    billing_limit_cents: plan.billing_limit_cents,
    current_period_start: plan.current_period_start,
    current_period_end: plan.current_period_end,
    meters: meters.map((m) => ({
      ...m,
      free_quantity: Number(m.free_quantity),
      overage_unit_quantity: Number(m.overage_unit_quantity),
    })),
  };
}

export async function organizationHasProjects(pool: pg.Pool, orgId: string): Promise<boolean> {
  const { rowCount } = await pool.query('SELECT 1 FROM projects WHERE org_id = $1 LIMIT 1', [orgId]);
  return Boolean(rowCount);
}

export async function completeHostedOnboarding(
  pool: pg.Pool,
  orgId: string,
  input: OnboardingInput,
  publicUrl: string,
  mcpRunner: McpRunnerConfig,
): Promise<OnboardingResult> {
  const workspaceName = cleanText(input.workspace_name, 'Poolstatis workspace');
  const projectSlug = cleanText(input.project_slug, '');
  const projectName = cleanText(input.project_name, projectSlug);
  if (!/^[a-z][a-z0-9-]*$/.test(projectSlug)) {
    throw badRequest('invalid_slug', 'project_slug must be lowercase letters, digits and hyphens, starting with a letter');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query('SELECT 1 FROM projects WHERE org_id = $1 LIMIT 1', [orgId]);
    if (rowCount) {
      throw new ApiError(
        409,
        'onboarding_complete',
        'this workspace already has a project',
        'use the Projects and Keys screens to manage additional resources or issue a new MCP token',
      );
    }
    const { rows: orgRows } = await client.query(
      'UPDATE organizations SET name = $2 WHERE id = $1 RETURNING id, name',
      [orgId, workspaceName],
    );
    if (!orgRows[0]) throw new ApiError(404, 'organization_not_found', 'organization not found');

    let project: Project;
    try {
      project = await createProject(client as unknown as pg.Pool, orgId, projectSlug, projectName);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ApiError(409, 'slug_taken', `a project with slug "${projectSlug}" already exists in this org`);
      }
      throw err;
    }
    const personal = await createApiKey(client as unknown as pg.Pool, {
      orgId,
      projectId: null,
      kind: 'personal',
      label: 'hosted onboarding MCP',
    });
    const ingest = await createApiKey(client as unknown as pg.Pool, {
      orgId,
      projectId: project.id,
      kind: 'ingest',
      env: 'prod',
      label: 'hosted onboarding prod ingest',
    });
    await client.query('COMMIT');

    return {
      organization: { id: orgRows[0].id, name: orgRows[0].name },
      project: { slug: project.slug, name: project.name, timezone: project.timezone },
      tokens: { personal: personal.token, ingest_prod: ingest.token },
      mcp: {
        command: mcpRunner.command,
        args: mcpRunner.args,
        package_status: mcpRunner.packageStatus,
        note: mcpRunner.note,
        env: {
          POOLSTATIS_URL: publicUrl.replace(/\/$/, ''),
          POOLSTATIS_TOKEN: personal.token,
        },
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
