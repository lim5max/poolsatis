import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: 'test/globalSetup.ts',
    // Suites share one test database; run files sequentially.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
