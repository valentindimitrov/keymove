import { chromium } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { findBrowser } from './preview-extension.ts';

/** Shared by the Playwright suite and the installed-extension video recorder. */
export async function launchExtensionContext(
  extension: string,
  browser: string,
  headless: boolean,
  baseURL?: string,
): Promise<BrowserContext> {
  const binary = browser === 'chromium' ? undefined : findBrowser(browser).binary;
  const context = await chromium.launchPersistentContext('', {
    ...(binary ? { executablePath: binary } : { channel: 'chromium' }),
    ...(browser === 'chrome' ? { ignoreDefaultArgs: ['--disable-extensions'] } : {}),
    headless,
    viewport: { width: 1280, height: 900 },
    ...(baseURL ? { baseURL } : {}),
    timeout: 20000,
    args: [
      // Vivaldi's native UI cannot initialize Playwright-created tabs reliably.
      // Exercise the installed Vivaldi renderer in its Chromium shell instead;
      // the interactive preview retains the normal Vivaldi UI via web-ext.
      ...(browser === 'vivaldi' ? ['--disable-vivaldi'] : []),
      ...(browser === 'chrome'
        ? ['--enable-unsafe-extension-debugging']
        : [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]),
    ],
  });
  if (browser === 'chrome') {
    // Current branded Chrome removed --load-extension. Use its extension-loading
    // API through Playwright's native CDP session, as the preview launcher does.
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
