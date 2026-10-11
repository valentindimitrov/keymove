import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  timeout: 30000,
  globalTimeout: 5 * 60 * 1000,
  expect: { timeout: 10000 },
  outputDir: '.artifacts/playwright/results',
  reporter: [['list'], ['html', { outputFolder: '.artifacts/playwright/report', open: 'never' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    actionTimeout: 10000,
    navigationTimeout: 15000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium-extension' }],
});
