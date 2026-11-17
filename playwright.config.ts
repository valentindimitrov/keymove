import { defineConfig } from '@playwright/test';
import { testBrowser } from './scripts/browser-context.ts';

// Reports, traces and timings are kept apart per browser so runs do not overwrite each other.
const browser = testBrowser();

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  timeout: 120000,
  globalTimeout: 10 * 60 * 1000,
  expect: { timeout: 10000 },
  outputDir: `.artifacts/playwright/${browser}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `.artifacts/playwright/${browser}/report`, open: 'never' }],
    ['json', { outputFile: `.artifacts/playwright/${browser}/results.json` }],
  ],
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    actionTimeout: 10000,
    navigationTimeout: 15000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: `${browser}-extension` }],
});
