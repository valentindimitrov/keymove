import type { BrowserContext, Page } from '@playwright/test';

/** Use real tab focus rather than Playwright's default focus emulation. */
export async function openPage(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  const session = await context.newCDPSession(page);
  try {
    await session.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  } finally {
    await session.detach();
  }
  await page.goto(url);
  await page.bringToFront();
  return page;
}

/** Standalone capture scripts do not run inside Playwright Test. */
export async function waitFor(page: Page, expression: string): Promise<void> {
  await page.waitForFunction(expression, undefined, { timeout: 10000 });
}
