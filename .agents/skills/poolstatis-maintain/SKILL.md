---
name: poolstatis-maintain
description: >-
  Keep a Poolstatis project's metric registry healthy over time — reconcile instrumentation
  drift, investigate ingest warnings/errors, deprecate stale metrics, and evolve the registry
  as the product changes. Use when the user asks to "audit metrics", "clean up the registry",
  "why are events unregistered", "what's drifting", "an event isn't counting", "a metric was
  deleted", "review data health", or after a product change that may have moved events.
  Requires the Poolstatis MCP (get_project_schema, list_metrics, update_metric, delete_metric,
  sample_events, list_ingest_warnings).
---

# Maintaining a Poolstatis registry

Instrumentation rots: events get renamed, metrics outlive their decision, code ships
that emits names nobody registered. This skill is the periodic hygiene pass that keeps
the registry trustworthy. It is **separate from initial instrumentation** — run it when
auditing or after a product change, not while first wiring a product up.

## Step 1 — Read the health signal

1. `get_project_schema(project)` → look at `observed_events_30d`. For each event, the
   `registered_share` is the fraction of its volume that matched an **active** metric.
   - share = 1.0 → fully on-standard.
   - 0 < share < 1 → partial drift (e.g. a metric was deprecated, or some events carry
     a property a filtered metric excludes).
   - share = 0 → the event is arriving but **no active metric covers it**.
2. `list_ingest_warnings(project)` → the persisted log of events the platform accepted
   but couldn't fully process: `rejected` (failed validation — malformed name, missing
   distinct_id) and `unregistered` (no matching active metric). This is the answer to
   "what happened to events for the metric I deleted" — they didn't vanish, they're here.

## Step 2 — Diagnose each drift

For an event with share < 1 or sitting in warnings, decide which case it is:

- **Renamed in code** — the product emits `doc.export` but the metric expects
  `doc.exported`. Fix the code or `update_metric` the source event to match. Confirm with
  `sample_events(project, {event})`.
- **Metric was deprecated/deleted** but the product still emits it — either re-activate
  (`update_metric status:active`) if it still informs a decision, or accept it as
  intentionally-retired (the warnings are then expected noise).
- **Never registered** — genuinely new behaviour. If it informs a decision, register it
  (hand off to the instrument workflow / `register_metric` with a real purpose). If not,
  it's vanity volume — leave it unregistered; that's the system working.
- **Rejected (malformed)** — fix the emitting code: name must be `object.action`
  snake_case, `distinct_id` must be present and stable.

## Step 3 — Retire what's dead

- A metric whose decision no longer exists → `update_metric status:deprecated`. Existing
  data and the definition are kept; new events stop counting toward it. This is the
  default retirement — reversible.
- Only `delete_metric` when genuinely cleaning up a mistake (it's refused while a funnel
  references the metric; remove/edit the funnel first). Deletion drops aggregated history
  but keeps raw events.

## Step 4 — Report

Summarize: coverage % (volume-weighted registered share), the list of drifting/wild
events with the diagnosis and action taken, and any metrics deprecated/deleted. Flag
anything you couldn't resolve (e.g. an event you can't classify) for the owner.

## Gotchas

- The active-metric set is cached ~30s on ingest — after activating/deprecating, give it
  a moment before judging `registered` on fresh events.
- `registered_share` is volume-weighted over 30 days, so a recently-fixed event can still
  show < 1 until old unregistered volume ages out.
- Don't "fix" drift by deleting the metric — that just turns the events fully unregistered.
  Reconcile the name or re-activate instead.
- Never invent a purpose to keep a metric alive. If you can't name its decision, deprecate it.
