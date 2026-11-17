import { expect } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { attachFailure, hasSearchMarks, openPage, selectionText, snapshot } from '../pages.js';
import { keymove } from '../keymove.js';

export async function checkHighlightDensity(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}highlights.html`);
  const { bar, input, status, options, host } = keymove(page);
  const outlines = host.locator('.keymove-selection');
  const selected = host.locator('.keymove-selected-selection');
  try {
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
    await page.keyboard.press('Alt+f');
    await expect(input).toBeFocused();
    await page.keyboard.press('s');
    await expect(status).toHaveText(/^Text 1 \//);
    await page.keyboard.press('Alt+s');
    await expect(status).toHaveText('Actions 1 / 12');
    // Below three characters every result stays navigable, but only the selected one is outlined.
    for (let index = 1; index <= 12; index++) {
      await expect(status).toHaveText(`Actions ${index} / 12`);
      await expect(outlines).toHaveCount(1);
      expect(await hasSearchMarks(page)).toBe(false);
      await page.keyboard.press('Tab');
    }
    await expect(status).toHaveText('Actions 1 / 12');
    await snapshot(page, 'highlights-short');
    await page.keyboard.press('n');
    await expect(input).toHaveValue('sn');
    await expect(status).toHaveText('Actions 1 / 12');
    expect(await hasSearchMarks(page)).toBe(false);
    await page.keyboard.press('e');
    await expect(input).toHaveValue('sne');
    await expect(status).toHaveText('Actions 1 / 12');
    await expect.poll(() => hasSearchMarks(page)).toBe(true);
    await expect(outlines).toHaveCount(12);
    await expect(selected).toHaveCount(1);
    expect(await page.evaluate(() => CSS.highlights.get('keymove-search-results')?.size)).toBe(12);
    await snapshot(page, 'highlights-long');
    await page.keyboard.press('Alt+s');
    await expect(status).toHaveText('Text 1 / 12');
    await expect(outlines).toHaveCount(12);
    await expect(selected).toHaveCount(1);
    await snapshot(page, 'highlights-long-text');
    await page.keyboard.press('Backspace');
    await expect(input).toHaveValue('sn');
    await expect.poll(() => hasSearchMarks(page)).toBe(false);
    await expect(status).toHaveText('Text 1 / 12');
    await expect(outlines).toHaveCount(1);
    await expect.poll(() => selectionText(page)).toBe('Sneakers classic');
    await page.keyboard.press('Tab');
    await expect(status).toHaveText('Text 2 / 12');
    await expect.poll(() => selectionText(page)).toBe('Sneakers canvas');
    await page.keyboard.press('Escape');
    await expect(outlines).toHaveCount(0);
    expect(await hasSearchMarks(page)).toBe(false);
    // Short queries mix text and action suggestions and keep focus in the input.
    await page.keyboard.press('Alt+f');
    await expect(input).toBeFocused();
    await page.keyboard.press('4');
    await expect(options).toHaveCount(2);
    await page.keyboard.press('0');
    await expect(input).toHaveValue('40');
    await expect(status).toHaveText('Text 1 / 1');
    await expect(options.first()).toContainText('Minimum (EUR) — 40');
    await expect(outlines).toHaveCount(1);
    expect(await hasSearchMarks(page)).toBe(false);
    await snapshot(page, 'short-input-suggestion');
    await page.keyboard.press('Alt+1');
    await expect(status).toHaveText('Actions 1 / 1');
    await page.keyboard.press('Enter');
    await expect(page.locator('#minimum')).toBeFocused();
  } catch (error) {
    await attachFailure(page);
    throw error;
  } finally {
    await page.close();
  }
}
