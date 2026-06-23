# Instrumenting a product with Poolstatis

Two ways to get metrics into Poolstatis:

- **A — Let a coding agent do it** (recommended): connect the MCP, point the agent
  at your product, it registers metrics and wires up tracking by the standard.
- **B — Do it by hand** over the HTTP API.

Both end in the same place: events flowing to the ingest API, metrics registered
with a `purpose`, and the admin panel showing green data-health.

---

## 0. Prerequisites

```bash
# from the poolstatis repo
docker compose up -d            # Postgres on :5444
pnpm install && pnpm serve      # Platform + Ingest API on :3300
pnpm --dir web install && pnpm --dir web dev   # admin panel on :5273 (optional)
```

Get keys for a project. Either bootstrap a fresh one:

```bash
pnpm bootstrap "My Org" my-app "My App"   # prints pk_/sk_/pt_ tokens — save them
```

…or seed a demo project with realistic data to explore first:

```bash
pnpm seed demo
```

Key kinds (see [ARCHITECTURE.md](../ARCHITECTURE.md)):

| Token | Use |
|-------|-----|
| `pk_` ingest | write-only, ships in product code, encodes project + env |
| `sk_` secret | read + manage one project (server-side / CI / admin panel) |
| `pt_` personal | read + manage across the org (MCP for an agent) |

---

## A. Agent-driven (MCP)

### 1. Connect the MCP

Add to your agent's MCP config (Claude Code / Desktop). The **Setup & MCP** tab in
the admin panel renders this for you, pre-filled and copyable.

```json
{
  "mcpServers": {
    "poolstatis": {
      "command": "pnpm",
      "args": ["--silent", "--dir", "/path/to/poolstatis", "mcp"],
      "env": {
        "POOLSTATIS_URL": "http://127.0.0.1:3300",
        "POOLSTATIS_TOKEN": "pt_…"
      }
    }
  }
}
```

`--silent` is required — otherwise pnpm prints a banner to stdout and corrupts the
stdio MCP protocol.

### 2. Run the instrumentation skill

In your **product's** repo (with the MCP connected), invoke the
[`poolstatis-instrument`](../.claude/skills/poolstatis-instrument/SKILL.md) skill, or
just ask: *"instrument this app with Poolstatis."* The agent will:

1. read `poolstatis://standard/instrumentation` and `get_project_schema`,
2. pick a north-star metric + activation funnel for your product type,
3. `register_metric` each (as `proposed`) with a real `purpose`,
4. add tracking calls to your code,
5. verify with `sample_events`, and
6. hand back the list of metrics for you to activate.

### 3. Activate

Open the admin **Registry** tab → metrics arrive as `proposed` → click **activate**
on the ones you want counted. (Or `update_metric` via MCP.)

---

## B. By hand (HTTP)

### 1. Register a metric

```bash
SK=sk_…
curl -X POST http://127.0.0.1:3300/api/v1/projects/my-app/metrics \
  -H "Authorization: Bearer $SK" -H 'content-type: application/json' \
  -d '{
    "key": "signup",
    "name": "Signups",
    "purpose": "Counts completed signups to size top-of-funnel acquisition.",
    "category": "acquisition",
    "type": "count",
    "source": { "event": "signup.completed" }
  }'
# → { ... "status": "proposed" }

# activate it
curl -X PATCH http://127.0.0.1:3300/api/v1/projects/my-app/metrics/signup \
  -H "Authorization: Bearer $SK" -H 'content-type: application/json' \
  -d '{"status":"active"}'
```

### 2. Send events with the SDK (JS/TS — recommended)

Use [`@poolstatis/sdk`](../sdk/README.md) — it batches, retries, and flushes on page
unload so events aren't lost. Don't hand-roll a fetch client.

```bash
pnpm add @poolstatis/sdk
```

```ts
// tracking.ts — one shared client, ingest key only (safe in client/server code)
import { createClient } from "@poolstatis/sdk";

export const ph = createClient({
  url: "http://127.0.0.1:3300",
  ingestKey: process.env.POOLSTATIS_INGEST_KEY!, // pk_…
});
```

```ts
// at the signup site — distinct_id is the STABLE user id
ph.track("signup.completed", user.id, { plan: "free" });
ph.identify("account", user.accountId, { plan: "free", seats: 1 }); // mutable state → entity
```

**Other languages / no SDK** — POST directly (the same shape the SDK sends). Batch up to 500
events and send a `batch_id` for idempotent retries:

```bash
# events
curl -X POST http://127.0.0.1:3300/i/v1/events \
  -H 'Authorization: Bearer pk_…' -H 'content-type: application/json' \
  -d '{"batch_id":"<uuid>","events":[{"event":"signup.completed","distinct_id":"u1","properties":{"plan":"free"}}]}'

# entities (mutable state — note entity_type/entity_id, not event shape)
curl -X POST http://127.0.0.1:3300/i/v1/entities \
  -H 'Authorization: Bearer pk_…' -H 'content-type: application/json' \
  -d '{"entities":[{"entity_type":"account","entity_id":"acc1","properties":{"plan":"free","seats":1}}]}'
```

### 3. Verify

```bash
# did it arrive? is it registered (matches an active metric)?
curl "http://127.0.0.1:3300/api/v1/projects/my-app/events/sample?limit=10" \
  -H "Authorization: Bearer $SK"
```

Or watch the admin **Data → Event stream** (filter to *unregistered*) and
**Data → Data health** for off-standard drift.

### 4. Query (this is what your own dashboards call)

Poolstatis is headless: you build dashboards on your side and pull via the Query API
(or the `query_*` MCP tools). The DSL accepts registry metric **keys**, never raw SQL.

```bash
curl -X POST http://127.0.0.1:3300/api/v1/projects/my-app/query \
  -H "Authorization: Bearer $SK" -H 'content-type: application/json' \
  -d '{"kind":"trend","metric":"signup","date_from":"-30d","interval":"day"}'
```

Query kinds: `trend`, `funnel`, `entities`, `retention`, `lifecycle`, `stickiness`
(see [04-http-api.md](04-http-api.md)).

---

## See also

- [The instrumentation standard](../src/mcp/standard.ts) — the normative rules (also
  served at `poolstatis://standard/instrumentation` and `GET /api/v1/standard`).
- [03-mcp-server.md](03-mcp-server.md) — every MCP tool.
- [04-http-api.md](04-http-api.md) — ingest + query API reference.
- [05-gap-analysis.md](05-gap-analysis.md) — what's built vs PostHog, and what's next.
