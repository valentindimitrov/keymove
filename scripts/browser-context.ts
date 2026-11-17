import { chromium } from '@playwright/test';
import type { BrowserContext, ViewportSize } from '@playwright/test';
import { findBrowser } from './preview-extension.ts';

export const testBrowsers = ['chromium', 'vivaldi', 'chrome'] as const;
export type TestBrowser = (typeof testBrowsers)[number];

/** The browser selected for automated runs: bundled Chromium unless a run names another. */
export function testBrowser(env: NodeJS.ProcessEnv = process.env): TestBrowser {
  const value = env['KEYMOVE_TEST_BROWSER'] ?? 'chromium';
  const browser = testBrowsers.find(name => name === value);
  if (!browser) throw new Error('KEYMOVE_TEST_BROWSER must be chromium, vivaldi, or chrome.');
  return browser;
}

/**
 * Published media is captured in installed Vivaldi, as before the Playwright migration;
 * KEYMOVE_TEST_BROWSER selects another browser, such as bundled Chromium where Vivaldi
 * is not installed.
 */
export function captureBrowser(env: NodeJS.ProcessEnv = process.env): TestBrowser {
  return env['KEYMOVE_TEST_BROWSER'] ? testBrowser(env) : 'vivaldi';
}

/** Launch arguments for one browser, kept apart from launching so they can be unit tested. */
export function extensionLaunchArgs(extension: string, browser: TestBrowser): string[] {
  return [
    // Vivaldi's native UI cannot initialize Playwright-created tabs reliably: tab
    // creation hung or crashed. Automated runs exercise the installed Vivaldi build
    // through its Chromium shell; the interactive preview keeps Vivaldi's UI via web-ext.
    ...(browser === 'vivaldi' ? ['--disable-vivaldi'] : []),
    ...(browser === 'chrome'
      ? ['--enable-unsafe-extension-debugging']
      : [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]),
  ];
}

/**
 * Starts a fresh temporary profile with the unpacked extension at `extension`. Shared by
 * the Playwright suite, the media recorder and the store-image generator.
 */
export async function launchExtensionContext(
  extension: string,
  browser: TestBrowser,
  options: { headless: boolean; viewport?: ViewportSize | null; baseURL?: string },
): Promise<BrowserContext> {
  const binary = browser === 'chromium' ? undefined : findBrowser(browser).binary;
  // An empty userDataDir is a new temporary profile, removed when the context closes.
  const context = await chromium.launchPersistentContext('', {
    ...(binary ? { executablePath: binary } : { channel: 'chromium' }),
    ...(browser === 'chrome' ? { ignoreDefaultArgs: ['--disable-extensions'] } : {}),
    headless: options.headless,
    viewport: options.viewport === undefined ? { width: 1280, height: 900 } : options.viewport,
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
    timeout: 30000,
    args: extensionLaunchArgs(extension, browser),
  });
  if (browser === 'chrome') {
    // Branded Chrome removed --load-extension. Use its extension-loading CDP command
    // through Playwright's browser session, as the preview launcher does.
    try {
      const session = await context.browser()!.newBrowserCDPSession();
      try {
        await session.send('Extensions.loadUnpacked', { path: extension });
      } finally {
        await session.detach();
      }
    } catch (error) {
      await context.close();
      throw error;
    }
  }
  return context;
}
