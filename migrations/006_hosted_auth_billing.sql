-- Hosted auth and future billing foundation.
-- API keys remain the protocol for ingest/MCP; auth_users are for humans in the hosted admin.

CREATE TABLE auth_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     text NOT NULL UNIQUE,
  email       text,
  name        text,
  picture_url text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_members (
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','member')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX organization_members_user_idx ON organization_members (user_id, created_at);

CREATE TABLE billing_plans (
  id                       text PRIMARY KEY,
  name                     text NOT NULL,
  price_cents              integer NOT NULL DEFAULT 0,
  currency                 text NOT NULL DEFAULT 'USD',
  billing_interval         text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month','year')),
  included_events_monthly  bigint NOT NULL DEFAULT 0,
  included_mtu_monthly     bigint NOT NULL DEFAULT 0,
  included_projects        integer NOT NULL DEFAULT 1,
  included_retention_months integer NOT NULL DEFAULT 12,
  included_seats           integer NOT NULL DEFAULT 1,
  pricing_stage            text NOT NULL DEFAULT 'free_now' CHECK (pricing_stage IN ('free_now','future_reference','active')),
  features                 jsonb NOT NULL DEFAULT '{}',
  active                   boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_meters (
  key                  text PRIMARY KEY,
  name                 text NOT NULL,
  unit                 text NOT NULL,
  aggregation          text NOT NULL DEFAULT 'sum' CHECK (aggregation IN ('sum','max','latest')),
  free_quantity        bigint NOT NULL DEFAULT 0,
  overage_unit_quantity bigint NOT NULL DEFAULT 1,
  overage_price_cents  numeric(14,6) NOT NULL DEFAULT 0,
  pricing_stage        text NOT NULL DEFAULT 'future_reference' CHECK (pricing_stage IN ('free_now','future_reference','active')),
  source_note          text NOT NULL,
  sort_order           integer NOT NULL DEFAULT 100,
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_billing (
  org_id                uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id               text NOT NULL REFERENCES billing_plans(id),
  status                text NOT NULL DEFAULT 'free' CHECK (status IN ('free','trial','active','past_due','paused')),
  billing_limit_cents   integer,
  current_period_start  date NOT NULL DEFAULT date_trunc('month', now())::date,
  current_period_end    date NOT NULL DEFAULT (date_trunc('month', now())::date + interval '1 month')::date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usage_counters (
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start  date NOT NULL,
  meter_key     text NOT NULL REFERENCES billing_meters(key),
  quantity      bigint NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, period_start, meter_key)
);

INSERT INTO billing_plans (
  id, name, price_cents, currency, billing_interval,
  included_events_monthly, included_mtu_monthly, included_projects,
  included_retention_months, included_seats, pricing_stage, features
) VALUES (
  'free',
  'Free',
  0,
  'USD',
  'month',
  1000000,
  10000,
  1,
  12,
  3,
  'free_now',
  '{"mcp_setup": true, "agent_registry": true, "query_dsl": true, "billing_enforced": false}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO billing_meters (
  key, name, unit, aggregation, free_quantity, overage_unit_quantity,
  overage_price_cents, pricing_stage, source_note, sort_order
) VALUES
  ('events', 'Events', 'event', 'sum', 1000000, 1, 0.005000, 'future_reference', 'Future meter modeled after event-based product analytics pricing; currently not billed.', 10),
  ('monthly_tracked_users', 'Monthly tracked users', 'mtu', 'max', 10000, 1, 4.900000, 'future_reference', 'Future alternate meter for MTU-based pricing; currently not billed.', 20),
  ('retained_entities', 'Retained entities', 'entity', 'max', 1000000, 1000, 1.000000, 'future_reference', 'Future storage meter for mutable entity rows; currently not billed.', 30),
  ('projects', 'Projects', 'project', 'max', 1, 1, 500.000000, 'future_reference', 'Future packaging meter for hosted workspace scale; currently not billed.', 40),
  ('retention_months', 'Retention months', 'month', 'latest', 12, 1, 100.000000, 'future_reference', 'Future retention packaging meter; currently not billed.', 50),
  ('seats', 'Seats', 'seat', 'max', 3, 1, 0.000000, 'future_reference', 'Future team packaging meter; currently not billed.', 60)
ON CONFLICT (key) DO NOTHING;
