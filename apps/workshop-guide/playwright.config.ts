import { defineConfig } from '@playwright/test';

/**
 * E2E suite (README "E2E tests"). Needs a running production build: BASE_URL (default
 * http://localhost:8000). Uses the installed Google Chrome (channel "chrome"), no browser download.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts', // not *.spec.ts: vitest (npm test) would pick those up
  outputDir: './e2e/artifacts/results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 5 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: './e2e/artifacts/report', open: 'never' }]],
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/support/global-teardown.ts',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8000',
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    headless: process.env.HEADED !== '1',
    locale: 'pl-PL',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 30_000,
  },
});
