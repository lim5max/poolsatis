import { createPool, migrate } from '../db.js';
import { loadConfig } from '../config.js';
import { buildServer } from '../http/server.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl, { max: config.databasePoolMax });
await migrate(pool);

const app = buildServer(pool, {
  auth: config.auth,
  publicUrl: config.publicUrl,
  mcpRunner: config.mcpRunner,
  ingestBuffer: config.ingestBuffer,
});
await app.listen({ port: config.port, host: config.host });
console.log(`poolstatis listening on http://${config.host}:${config.port}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
