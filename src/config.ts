export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    databaseUrl:
      env.DATABASE_URL ??
      'postgres://poolsatis:poolsatis@localhost:5444/poolsatis',
    port: env.PORT ? Number(env.PORT) : 3300,
    host: env.HOST ?? '127.0.0.1',
  };
}
