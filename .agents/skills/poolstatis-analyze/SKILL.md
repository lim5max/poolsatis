---
name: poolstatis-analyze
description: >-
  Answer a product question from Poolstatis data — pick the right query type, run it through
  the MCP, and interpret the result using each metric's declared purpose. Use when the user
  asks "how is X doing", "did Y change", "what's our retention/activation/conversion", "are
  users sticky", "why did this metric move", "build me a number for Z", or wants insight from
  an instrumented project. Requires the Poolstatis MCP (get_project_schema, query_trend,
  query_funnel, query_retention, query_lifecycle, query_stickiness, query_entities,
  get_person, list_funnels, create_insight).
---

# Answering product questions with Poolstatis

Poolstatis is headless: you pull data through the query tools and reason over the JSON.
The registry's `purpose`/`goal` fields are the key — every number is self-describing, so
your job is to map the question to the right query and explain the answer in those terms.

## Step 1 — Ground in the registry

`get_project_schema(project)` first. Answer questions using **registered metric keys**,
never raw event names (the DSL only accepts keys). If no metric fits the question, say so
and propose registering one (hand off to the instrument workflow) rather than guessing.

## Step 2 — Pick the query type

| Question shape | Query | Notes |
|----------------|-------|-------|
| "how many / how much of X over time" | `query_trend` | add `breakdown` by a property for splits |
| "what share go from A to B" (ordered) | `query_funnel` | saved funnel key, or inline metric-key steps |
| "do users come back after doing X" | `query_retention` | `start_metric` (+ optional `return_metric`), interval, periods |
| "is growth healthy underneath the total" | `query_lifecycle` | new / returning / resurrecting / dormant |
| "how habitual is the product" | `query_stickiness` | distinct active intervals per actor |
| "which entities are in state S" | `query_entities` | filter on current entity properties |
| "what do we know about this one user" | `get_person` | engagement summary (recency/frequency/tenure) + identity entity |

Defaults: weekly interval and `-30d`/`-90d` ranges unless the question implies otherwise.
Retention/lifecycle/stickiness need an **event-based** metric (count/unique_actors/value),
not a conversion or state metric.

## Step 3 — Interpret, don't just dump

Translate the result back into the metric's purpose and the funnel's goal. "Week-2
retention is 41%" is data; "41% of new signups still open the app two weeks later — the
activation funnel's goal is first export within 14 days, and that's where the drop
concentrates" is an answer. Quote the actual numbers, name the date range, and state the
one thing the user should take away.

## Step 4 — Persist what matters

When a finding is worth keeping, `create_insight(project, {title, body, query})` so it's
reproducible — store the exact Query DSL alongside the prose. This is how a one-off answer
becomes a tracked insight.

## Gotchas

- The DSL takes **metric keys, not event names** — `query_trend` on `"signup.completed"`
  fails; use the metric key (e.g. `signup`).
- A `conversion`-type metric can't be trended — query it as a funnel instead.
- `distinct_id` is the actor. Per-user numbers (retention/stickiness) are only as correct
  as the stability of that id; if the project's instrumentation is shaky, check
  `poolstatis-maintain` before trusting per-user results.
- Dates accept relative (`-30d`, `-12w`) or ISO — don't hand-compute timestamps.
