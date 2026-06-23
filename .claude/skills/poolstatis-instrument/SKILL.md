---
name: poolstatis-instrument
description: >-
  Instrument a product with Poolstatis analytics — decide what to measure, register
  metrics with a purpose, add tracking calls, and verify data flows. Use when the user
  asks to "add analytics", "track metrics", "set up Poolstatis", "instrument this app",
  "what should we measure", or connects the Poolstatis MCP and wants events flowing.
  Requires the Poolstatis MCP server to be connected (tools prefixed list_projects,
  register_metric, query_*, sample_events, plus the resource poolstatis://standard/instrumentation).
---

# Instrumenting a product with Poolstatis

You are adding **purpose-first** analytics to the product in the current repo.
Poolstatis's contract: every metric carries a `purpose` (the decision it informs)
and every funnel a `goal`. Track on purpose, not by reflex.

**Always read the standard first:** the resource `poolstatis://standard/instrumentation`
is normative. This skill is the *procedure*; the standard is the *rules*.

## Step 1 — Orient

1. Read the resource `poolstatis://standard/instrumentation`.
2. Call `list_projects`, then `get_project_schema(project)` for the target project.
   Note what metrics, funnels, entity types and **observed events** already exist —
   never duplicate an existing metric key; extend or reuse.
3. Skim the product code to understand the domain: what is the core action, who is
   the user, where does money happen, what is the "aha" moment.

## Step 2 — Decide what to measure (the hard part)

Pick the product archetype (SaaS / e-commerce / content / mobile / dev-tool — see
the standard §6) and from it:

- **One north-star metric** the product optimises.
- **The activation funnel**: acquisition → the first real value moment → retention.
- A short list of event-based metrics across the AARRR categories + `quality`.

Resist vanity metrics. If you cannot write a one-sentence `purpose` naming a
decision, drop the metric. Prefer 8–12 sharp metrics over 40 vague ones.

## Step 3 — Register the semantic layer (design-time)

For each metric, call `register_metric` with `{key, name, purpose, category, tags, type, source}`.
They land as `status: proposed` — that is correct; the owner activates them.

- Use the right `type` (count / unique_actors / value / conversion / state) and a
  valid `source` for it (standard §4). Money → `value` over an `amount` property.
- Set `category` to the AARRR stage, and `tags` to the **product feature** the metric
  belongs to (e.g. `["checkout"]`, `["onboarding","north-star"]`) — this is how the
  owner later groups metrics by feature.
- Mutable state (plan, seats, status) → `register_entity_type`, not event properties.
- Then `define_funnel` from the registered metric keys, each with a real `goal`.

If `register_metric` returns `metric_key_taken`, the metric exists — read it and
either reuse it or pick a new key. Error messages carry a `hint`; follow it.

## Step 4 — Instrument the code

For a JS/TS product, use the **`@poolstatis/sdk`** package — do NOT hand-roll a fetch
client (it would miss batching, retries, and unload-flush, losing events):

```ts
import { createClient } from '@poolstatis/sdk';
export const ph = createClient({ url: '<server>', ingestKey: process.env.POOLSTATIS_INGEST_KEY! });
ph.track('signup.completed', user.id, { plan });   // distinct_id = stable user id
ph.identify('account', account.id, { plan, seats }); // mutable state → entity
```

For other languages (no SDK), POST to `/i/v1/events` and `/i/v1/entities` with an ingest
key (`pk_`), batching ≤500 events and sending a `batch_id` for idempotent retries.

Always: `distinct_id` is the **stable authenticated user id** (never a session/random id);
event names are `object.action`, past tense, snake_case; mutable state goes on entities,
not event properties. Centralise tracking in one module.

## Step 5 — Verify, then hand off

1. Trigger the instrumented paths (run the app / a script) so events flow.
2. Call `sample_events(project, {limit, registered: false})` — anything showing up
   here is **off-standard** (no matching active metric). Reconcile: either the event
   name is wrong, or a metric is missing/needs activation.
3. Re-check `get_project_schema` → `observed_events_30d`: aim for high registered share.
4. Tell the owner which `proposed` metrics to **activate** (in the admin Registry tab
   or via `update_metric status:active`). Only then do they count toward coverage.

## Gotchas (Poolstatis-specific — get these wrong without being told)

- **`registered` is lazy.** The ingest server caches the active-metric set for ~30s.
  After you activate a metric, events may show `registered: false` for up to half a
  minute. Don't conclude the instrumentation is broken — re-check `sample_events`.
- **Unregistered events are NOT errors.** An event with no matching active metric is
  still accepted and stored; it's only flagged. So "wild" events in Data health mean
  "off-standard", not "lost". Reconcile by registering/activating the metric.
- **A metric in `proposed` does not mark events registered.** Only `active` metrics do.
  Registering is not enough — someone must activate.
- **`distinct_id` must be the stable user id**, identical across sessions/devices.
  A per-session or random id silently corrupts every per-user number.
- **Deleting a metric doesn't delete its events** (they become unregistered) and is
  refused while a funnel references it. Use `deprecated` to retire, not delete.

## Guardrails

- Never invent a `purpose` to satisfy the validator — that defeats the whole system.
- Don't activate metrics yourself unless the user explicitly asks; registration is
  yours, activation is the owner's.
- Don't send events from this chat session; instrument the **product** so it sends
  them at runtime. `sample_events` is the only data call you make here, for verification.
