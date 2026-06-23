# VPS deployment notes

Poolstatis has four deployable/portable pieces. Keep them separate.

## What runs on the VPS

- **Platform + Ingest API**: `pnpm serve`, behind HTTPS/reverse proxy.
- **Postgres**: persistent volume; keep the physical DB name `poolsatis`.
- **Admin SPA**: build `web/` and serve it as static files, or keep Vite only for local dev.

The VPS does not need customer-product source code, product agent skills, or SDK build artifacts.

## What runs where the agent works

- **MCP stdio server**: run from this repo/package in the agent environment.
- **Agent skills**: install/copy into the product repo or agent profile that edits the product.
- **SDK**: install into the product app that emits events.

For a hosted Poolstatis API, the agent config still points at the local stdio wrapper, but the wrapper talks to the VPS API:

```json
{
  "mcpServers": {
    "poolstatis": {
      "command": "pnpm",
      "args": ["--silent", "--dir", "/path/to/poolstatis", "mcp"],
      "env": {
        "POOLSTATIS_URL": "https://analytics.example.com",
        "POOLSTATIS_TOKEN": "pt_..."
      }
    }
  }
}
```

Use `pt_` for MCP by default so the agent can discover projects. Use `sk_` only when you want a project-pinned MCP scope.

## Product integration

Products should emit with `pk_` keys only:

```ts
import { Poolstatis } from '@poolstatis/sdk';

const analytics = new Poolstatis({
  url: 'https://analytics.example.com',
  token: process.env.POOLSTATIS_INGEST_KEY!,
});
```

For local/private use before publishing `@poolstatis/sdk`, install it from a Git URL or a workspace/file dependency. Do not copy SDK source into every product repo.

## Smoke checks after deploy

```bash
curl https://analytics.example.com/health
POOLSTATIS_URL=https://analytics.example.com POOLSTATIS_TOKEN=pt_... pnpm mcp:smoke --project my-project
```

Then open the admin console with an `sk_` key and check:

- `Data -> Event stream`: product events arrived.
- `Data -> Data health`: registered coverage is high and entity conflicts are empty.
- `Data -> Warnings`: no rejected/unregistered/clock-skew warnings unless expected.
