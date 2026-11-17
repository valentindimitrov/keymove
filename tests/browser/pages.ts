import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
export { openPage } from '../../scripts/browser-pages.js';

/** Attaches a screenshot to the report, kept apart per browser with the run's results. */
export async function snapshot(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

/** The page's native selection, which is what Ctrl/Command+C copies. */
export function selectionText(page: Page): Promise<string> {
  return page.evaluate(() => getSelection()?.toString() ?? '');
}

/** Whether the page currently has page-wide CSS Custom Highlight marks. */
export function hasSearchMarks(page: Page): Promise<boolean> {
  return page.evaluate(() => CSS.highlights.has('keymove-search-results'));
}

/**
 * Attaches a screenshot and KeyMove's rendered state for a failing scenario page before
 * the scenario closes it; Playwright's own failure screenshot only covers the fixture page.
 */
export async function attachFailure(page: Page): Promise<void> {
  if (page.isClosed()) return;
  // A closing page or interrupted navigation can prevent diagnostics. Keep the
  // original assertion failure even when an attachment cannot be captured.
  await Promise.allSettled([
    page
      .screenshot({ timeout: 5000 })
      .then(body => test.info().attach('failed scenario page', { body, contentType: 'image/png' })),
    attachRenderedState(page),
  ]);
}

async function attachRenderedState(page: Page): Promise<void> {
  await test.info().attach('rendered state', {
    body: JSON.stringify(
      await page.evaluate(() => {
        const root = document.getElementById('keymove-root')?.shadowRoot;
        return {
          url: location.href,
          focused: document.hasFocus(),
          activeElement: document.activeElement?.id,
          shadowActiveElement: root?.activeElement?.id,
          query: root?.querySelector<HTMLInputElement>('input')?.value,
          status: root?.querySelector('[role="status"]')?.textContent,
          selection: getSelection()?.toString(),
        };
      }),
      null,
      2,
    ),
    contentType: 'application/json',
  });
}
