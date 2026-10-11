import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { openPage } from '../pages.js';
import { expect } from '@playwright/test';
import { keymove } from '../keymove.js';

export async function checkActionFallback(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}action-fallback.html`);
  try {
    await page.bringToFront();
    await expect(keymove(page).bar).toHaveAttribute('data-always-on', 'true');
    await page.keyboard.press('Alt+f');
    for (const character of 'recher') await page.keyboard.type(character);
    await expect(keymove(page).status).toHaveText('Actions 1 / 1');
    writeFileSync(
      path.resolve(import.meta.dirname, '../../../.artifacts/action-fallback.png'),
      await page.screenshot(),
    );
    for (const character of 'zzzzzz') await page.keyboard.type(character);
    await expect(keymove(page).status).toHaveText(/0 \/ 0$/);
    await expect(keymove(page).suggestions).not.toBeAttached();
    await expect(keymove(page).input).toHaveAttribute('aria-expanded', 'false');
    await expect(keymove(page).input).toBeFocused();
    writeFileSync(
      path.resolve(import.meta.dirname, '../../../.artifacts/action-fallback-empty.png'),
      await page.screenshot(),
    );
    for (let index = 0; index < 6; index++) await page.keyboard.press('Backspace');
    await expect(keymove(page).status).toHaveText('Actions 1 / 1');
    await expect(keymove(page).suggestions).toBeAttached();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Backspace');
    await expect(keymove(page).status).toHaveText('Text 1 / 1');
    await expect(keymove(page).input).toHaveValue('reche');

    await page.keyboard.press('r');
    await expect(keymove(page).status).toHaveText('Actions 1 / 1');
    await page.keyboard.press('ArrowDown');
    await expect(keymove(page).menu).toBeAttached();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Backspace');
    await expect(keymove(page).status).toHaveText('Text 1 / 1');

    await page.keyboard.press('r');
    await expect(keymove(page).status).toHaveText('Actions 1 / 1');
    await page.keyboard.press('Enter');
    await expect(page.locator('#fallback-action')).toBeFocused();

    // A deliberate action-mode choice must survive the same Backspace transition.
    await page.keyboard.press('Alt+f');
    for (const character of 'recher') await page.keyboard.type(character);
    await expect(keymove(page).status).toHaveText('Actions 1 / 1');
    await page.keyboard.press('Alt+s');
    await page.keyboard.press('Backspace');
    await expect(keymove(page).status).toHaveText('Actions 1 / 1');
    await expect(keymove(page).input).toHaveValue('reche');
  } finally {
    await page.close();
  }
}
