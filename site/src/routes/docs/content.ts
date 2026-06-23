// Docs content registry. Pages are authored as markdown strings and rendered with
// react-markdown — no per-page components. The sidebar + TOC are derived from this.

export interface DocPageDef {
  slug: string;
  title: string;
  description: string;
  body: string;
}
export interface DocGroup {
  label: string;
  pages: DocPageDef[];
}

const introduction = `# Introduction

**Poolstatis** is product analytics built for coding agents. The primary user isn't a
human clicking through dashboards — it's an agent connected over **MCP** that registers
metrics, defines funnels, and answers questions about whether what it shipped is working.

Two rules hold the whole system together:

> **Every metric carries a \`purpose\`** — one sentence naming the decision it informs.
> **Every funnel carries a \`goal\`** — what journey it measures and why.

If you can't name the decision a number informs, you don't track it. That single constraint
is what makes an agent's analytics trustworthy instead of noise.

## Why it exists

Traditional analytics assume a person is sitting in front of a chart. An agent can write a
feature, ship it, and open the PR — but then it goes blind, because the feedback half of the
loop (\`ship → measure → decide\`) lives behind a SQL console and a dashboard UI.

Poolstatis closes that loop. The agent works through a small, typed surface instead of raw
SQL, and every number is self-describing.

## How it fits together

- **Ingest API** receives events and entity updates from your product.
- **Registry** holds the semantic layer: metrics (with a purpose) and funnels (with a goal).
- **Query DSL** answers questions over registered metrics — never raw tables.
- **MCP server** exposes all of the above as tools your agent calls.
- **Admin panel** is a headless console for humans to audit and activate.

Next: [Quickstart](/docs/quickstart).
`;

const quickstart = `# Quickstart

Get analytics flowing in a few minutes. You'll connect the MCP server, let your agent
register metrics, and verify events arrive.

## 1. Connect the MCP server

Add Poolstatis to your agent's MCP configuration:

\`\`\`json
{
  "poolstatis": {
    "command": "npx",
    "args": ["@poolstatis/mcp"],
    "env": {
      "POOLSTATIS_URL": "https://your-host",
      "POOLSTATIS_TOKEN": "pt_your_personal_token"
    }
  }
}
\`\`\`

Your agent now has tools to register, query, and audit.

## 2. Let your agent instrument

Ask your agent to "set up analytics for this product." It reads your code, proposes metrics,
and registers each with a mandatory purpose:

\`\`\`ts
register_metric({
  key: "signup_completed",
  purpose: "Track top-of-funnel growth week over week",
  type: "unique_actors",
  category: "acquisition",
  tags: ["onboarding"]
})
\`\`\`

## 3. Send events

Use the SDK in your product. \`distinct_id\` must be the **stable** user id:

\`\`\`ts
import { createClient } from '@poolstatis/sdk';

export const ph = createClient({
  url: process.env.POOLSTATIS_URL!,
  ingestKey: process.env.POOLSTATIS_INGEST_KEY!,
});

ph.track('signup.completed', user.id, { plan });
ph.identify('account', account.id, { plan, seats });
\`\`\`

## 4. Verify

Ask your agent to sample recent events, or check the admin panel's **Data** tab. Activate the
proposed metrics so they start counting toward your registered coverage.

That's it — your agent can now answer "did it work?" itself.
`;

const concepts = `# Core concepts

Poolstatis has exactly **four primitives**. Pick the right one and everything else follows.

## Event

An immutable fact — "X happened at time T". Signups, exports, purchases, page views. Events
are append-only; they're never edited (except GDPR deletion by \`distinct_id\`).

Name them \`object.action\`, past tense, snake_case: \`checkout.completed\`, \`doc.exported\`.

## Entity

A mutable object with a current state — users, accounts, documents. Anything where you care
about the *latest value*, not a stream of facts. A user's plan, an account's seat count, a
document's status: entities, upserted when they change.

> Rule of thumb: if it changes over time and you only care about the latest value, it's an
> entity property — not an event property.

## Metric

A declared measurement over events or entities, with a mandatory \`purpose\`. Metrics are the
only thing the query layer references — never raw event names.

## Funnel

An ordered sequence of metrics with a \`goal\`. Because steps reference registered metrics, a
funnel inherits the purpose of each step.

## Identity

\`distinct_id\` is the actor — the stable, authenticated user id from your product. Stability
is what makes retention, funnels, and unique counts correct.
`;

const metrics = `# Metrics & purpose

A metric is a registry declaration: what to measure, and **why**.

## Required fields

Every metric needs a \`key\`, \`name\`, \`type\`, \`source\`, and a non-empty \`purpose\`. The server
rejects empty or templated purposes — this is the core of the product, not boilerplate.

## Types

| type | answers | source shape |
|------|---------|--------------|
| \`count\` | how many times did X happen | \`{ event, filters? }\` |
| \`unique_actors\` | how many distinct users did X | \`{ event, filters? }\` |
| \`value\` | sum/avg/p90 of a numeric property | \`{ event, value_property, agg }\` |
| \`conversion\` | what share went A → B in a window | \`{ from, to, window_seconds }\` |
| \`state\` | how many entities are in state S | \`{ entity_type, filters, agg }\` |

## Categories and tags

Tag each metric with one AARRR **category** — acquisition, activation, retention, revenue,
referral — or \`quality\`. Beyond that, add free-form **tags** (lowercased, multiple) for the
product feature a metric belongs to: \`["checkout"]\`, \`["onboarding", "north-star"]\`. Tags are
how you later group metrics by feature without a rigid enum.

## Lifecycle

Metrics start as \`proposed\`. The owner **activates** them — only \`active\` metrics mark matching
events as \`registered\` on ingest. Retire metrics as \`deprecated\`; never delete (historical
queries must keep working).
`;

const funnels = `# Funnels

A funnel is an ordered sequence of registered metrics with a mandatory \`goal\`.

## Defining one

\`\`\`ts
define_funnel({
  key: "activation",
  name: "New user activation",
  goal: "Take a new signup to their first export within 14 days",
  steps: [
    { metric_key: "signup", label: "Signed up" },
    { metric_key: "first_export", label: "First export" }
  ],
  window_seconds: 1209600
})
\`\`\`

## Why steps are metrics, not events

Steps reference **registry metric keys**, never raw event names. So the funnel inherits each
step's purpose: the insight layer knows not just "conversion 2→3 dropped" but "conversion into
activation dropped, whose goal is X".

## The window

\`window_seconds\` is anchored at the first step. Match it to the journey — activation: 1–14
days; purchase: hours.
`;

const queryDsl = `# Query DSL

All analysis goes through a typed Query DSL — a discriminated union on \`kind\`. Branches
reference **registered metric keys**, never raw SQL. There is no SQL surface exposed to
clients, which is exactly what keeps an agent's output safe.

## Query types

| kind | question |
|------|----------|
| \`trend\` | how much of X over time (with optional breakdown) |
| \`funnel\` | what share go from A to B, in order |
| \`retention\` | do users come back after doing X |
| \`lifecycle\` | new / returning / resurrecting / dormant under the total |
| \`stickiness\` | how habitual is the product |
| \`entities\` | which entities are currently in state S |

## Example

\`\`\`ts
query_trend({
  metric: "checkout_completed",
  date_from: "-30d",
  interval: "week",
  breakdown: "plan"
})
\`\`\`

## Right-censoring

Retention and lifecycle are honest about partial windows: recent cohorts expose
\`mature_periods\`, and the latest, still-open interval is never counted as churn. Read the most
recent bucket with that in mind.

## Dates

Accept relative (\`-30d\`, \`-12w\`) or ISO. Don't hand-compute timestamps.
`;

const mcpTools = `# MCP reference

Every capability is an MCP tool. Your agent discovers and calls them directly.

## Registry (design-time)

\`\`\`text
register_metric(project, { key, name, purpose, category, tags?, type, source })
update_metric(project, key, patch)        // including activation { status: 'active' }
delete_metric(project, key)               // refused while a funnel references it
list_metrics(project, { status?, category? })
register_entity_type(project, { name, description, prop_schema? })
define_funnel(project, { key, name, goal, steps, window_seconds })
list_funnels(project)
delete_funnel(project, key)
\`\`\`

## Analysis (query-time)

\`\`\`text
query_trend(project, { metric, date_from, date_to?, interval, breakdown?, env? })
query_funnel(project, { funnel | steps, date_from, date_to?, env? })
query_retention(project, { start_metric, return_metric?, interval, periods, date_from, env? })
query_lifecycle(project, { metric, interval, date_from, env? })
query_stickiness(project, { metric, interval, date_from, env? })
query_entities(project, { entity_type, filters?, limit, order_by? })
get_person(project, { distinct_id, env? })
\`\`\`

## Operations

\`\`\`text
sample_events(project, { event?, registered?, distinct_id?, limit })
list_ingest_warnings(project, { env?, kind? })   // rejected / unregistered / clock_skew
create_insight(project, { title, body, query })
\`\`\`

## Keys

- \`pk_\` — ingest, write-only, safe in client code (encodes project + env).
- \`sk_\` — secret, scoped to one project, read + manage.
- \`pt_\` — personal, org-wide, for MCP.
`;

const standard = `# Instrumentation standard

This is the normative reference an agent follows when instrumenting a product. The job isn't
"add tracking" — it's to make a product's behaviour **computable**: every number traces back
to a declared reason.

## Naming

- Format \`object.action\`, lower snake_case: \`checkout.completed\`.
- Past tense for facts: \`completed\`, not \`complete\`.
- Name the intent, not the widget: \`export.requested\`, not \`button.clicked\`.
- \`$\` is reserved for system events/properties.

## Identity & properties

1. \`distinct_id\` **must** be a stable user id — never per-session or random.
2. Money goes in a numeric \`amount\` with a \`currency\`. Never bake it into the name.
3. Mutable state belongs on entities, not copied onto every event.
4. Keep properties low-cardinality where you'll break down by them.

## The north star

Pick one north-star metric the whole product optimises, and instrument the funnel from
acquisition to that metric first.

## Anti-patterns

- Vanity events with no metric or purpose behind them.
- Unstable \`distinct_id\` — silently corrupts every per-user number.
- State on events only — you lose "how many accounts are on Pro right now".
- Generic names (\`click\`, \`action\`, \`event\`) — unqueryable six months later.
- Tracking everything "just in case". Coverage is not the goal; decisions are.
`;

export const docsIndex: DocGroup[] = [
  {
    label: 'Get started',
    pages: [
      { slug: 'introduction', title: 'Introduction', description: 'What Poolstatis is and why it exists.', body: introduction },
      { slug: 'quickstart', title: 'Quickstart', description: 'Connect the MCP server and get events flowing.', body: quickstart },
    ],
  },
  {
    label: 'Concepts',
    pages: [
      { slug: 'concepts', title: 'Core concepts', description: 'The four primitives.', body: concepts },
      { slug: 'metrics', title: 'Metrics & purpose', description: 'The semantic layer at the core.', body: metrics },
      { slug: 'funnels', title: 'Funnels', description: 'Ordered metrics with a goal.', body: funnels },
    ],
  },
  {
    label: 'Reference',
    pages: [
      { slug: 'query-dsl', title: 'Query DSL', description: 'The typed query surface.', body: queryDsl },
      { slug: 'mcp-tools', title: 'MCP reference', description: 'Every tool your agent can call.', body: mcpTools },
      { slug: 'standard', title: 'Instrumentation standard', description: 'The normative rules for instrumenting.', body: standard },
    ],
  },
];

export const allDocPages: DocPageDef[] = docsIndex.flatMap((g) => g.pages);

export function findDoc(slug: string): { page: DocPageDef; group: DocGroup } | null {
  for (const group of docsIndex) {
    const page = group.pages.find((p) => p.slug === slug);
    if (page) return { page, group };
  }
  return null;
}

/** Slugify a heading to match rehype-slug / github-slugger for simple headings. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

export interface TocItem { id: string; text: string; level: number }

/** Extract ## and ### headings from a markdown body for the on-this-page TOC. */
export function extractToc(body: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = body.split('\n');
  let inFence = false;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.*)$/.exec(line);
    if (m) {
      const text = m[2]!.trim();
      items.push({ id: slugifyHeading(text), text, level: m[1]!.length });
    }
  }
  return items;
}
