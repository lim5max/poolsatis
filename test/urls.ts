export const TEST_DB = 'poolsatis_test';
export const ADMIN_URL =
  process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://poolsatis:poolsatis@localhost:5444/poolsatis';
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? `postgres://poolsatis:poolsatis@localhost:5444/${TEST_DB}`;
