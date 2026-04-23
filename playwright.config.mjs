import { defineConfig } from '@playwright/test';

const isFull = process.env.E2E_FULL === '1';

const smokeProjects = [
  {
    name: 'desktop-smoke',
    testDir: './tests/e2e/desktop',
    testMatch: ['smoke.spec.mjs'],
  },
  {
    name: 'pro-smoke',
    testDir: './tests/e2e/pro',
    testMatch: ['pro-smoke.spec.mjs'],
  },
];

const fullProjects = [
  {
    name: 'desktop-full',
    testDir: './tests/e2e/desktop',
    testMatch: '**/*.spec.mjs',
  },
  {
    name: 'pro-full',
    testDir: './tests/e2e/pro',
    testMatch: '**/*.spec.mjs',
  },
];

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.mjs',
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: isFull ? 1 : process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {},
  projects: isFull ? fullProjects : smokeProjects,
});
