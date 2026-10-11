import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
export { openPage } from '../../scripts/browser-pages.js';

/** Keep the existing rendered-state assertions while gaining Playwright polling. */
export async function waitFor(page: Page, expression: string): Promise<void> {
  try {
    await expect
      .poll(
        async () => {
          try {
            return await page.evaluate(`Boolean(${expression})`);
          } catch (error) {
            // A reload briefly destroys the old execution context. Retry only this
            // expected transition; malformed expressions and closed pages still fail.
            if (error instanceof Error && error.message.includes('Execution context was destroyed'))
              return false;
            throw error;
          }
        },
        {
          message: `Rendered condition: ${expression}`,
          timeout: 10000,
          intervals: [25, 50, 100],
        },
      )
      .toBe(true);
  } catch (error) {
    // A closing page or interrupted navigation can also prevent diagnostics.
    // Preserve the assertion failure even when an attachment cannot be captured.
    await Promise.allSettled([captureFailure(page), attachRenderedState(page)]);
    throw error;
  }
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

export async function captureFailure(page: Page): Promise<void> {
  if (page.isClosed()) return;
  await test.info().attach('failed smoke page', {
    body: await page.screenshot({ timeout: 5000 }),
    contentType: 'image/png',
  });
}
