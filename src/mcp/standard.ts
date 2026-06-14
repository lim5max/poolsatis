/**
 * The instrumentation standard served as an MCP resource.
 * v0 placeholder: the full standard (per-product-type metric sets) is the
 * next milestone; the naming and semantic rules below are already binding.
 */
export const INSTRUMENTATION_STANDARD = `# Poolsatis Instrumentation Standard (v0)

## Event naming
- Format: \`object.action\`, snake_case: \`checkout.completed\`, \`doc.exported\`.
- Past tense for facts (\`completed\`, not \`complete\`).
- The \`$\` prefix is reserved for system events and properties.

## Required practices
1. Every tracked event MUST have a registered metric in Poolsatis with a real
   \`purpose\` — one sentence explaining what decision this metric informs.
2. \`distinct_id\` MUST be a stable user identifier from the product's auth
   system. Do not send random/per-session ids as distinct_id.
3. Monetary values go in a \`amount\` numeric property; currency in \`currency\`.
4. Mutable state (plan, seats, lifecycle stage) belongs to entities, not
   event properties — upsert entities on change.
5. Group related metrics into funnels with an explicit \`goal\`. A metric that
   belongs to no funnel and no category should make you suspicious.

## Workflow for agents
1. Read \`poolsatis://{project}/schema\` to see what already exists.
2. Register missing metrics (\`register_metric\`) — they start as \`proposed\`.
3. Instrument the code to send the events.
4. Verify with \`sample_events\` that events arrive and are \`registered\`.
5. Ask the project owner to activate proposed metrics.
`;
