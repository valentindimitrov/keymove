import { defineConfig } from '@playwright/test';

const browser = process.env['KEYMOVE_TEST_BROWSER'] ?? 'chromium';
if (!['chromium', 'vivaldi', 'chrome'].includes(browser)) {
  throw new Error('KEYMOVE_TEST_BROWSER must be chromium, vivaldi, or chrome.');
}

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
