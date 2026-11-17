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

/**
 * Waits for a condition in the page; for standalone capture scripts outside Playwright Test.
 * A string is a fixed expression; anything that varies reaches a function as its argument.
 */
export async function waitFor(page: Page, condition: string): Promise<void>;
export async function waitFor<Arg>(
  page: Page,
  condition: (arg: Arg) => unknown,
  arg: Arg,
): Promise<void>;
export async function waitFor(
  page: Page,
  condition: string | ((arg: unknown) => unknown),
  arg?: unknown,
): Promise<void> {
  await page.waitForFunction(condition, arg, { timeout: 10000 });
}
