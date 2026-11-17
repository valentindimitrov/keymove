import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Locators follow the existing host when it moves into a modal or an open root. */
export function keymove(page: Page) {
  const host = page.locator('#keymove-root');
  // Membership and stored-value assertions also inspect the hidden searchbar.
  // Callers use toBeVisible() explicitly when visibility is the behavior tested.
  const suggestions = host.getByRole('listbox', { includeHidden: true });
  return {
    host,
    bar: host.locator('#keymove-bar'),
    input: host.getByRole('combobox', { name: 'Search page', exact: true, includeHidden: true }),
    status: host.getByRole('status', { includeHidden: true }),
    suggestions,
    options: suggestions.getByRole('option', { includeHidden: true }),
    menu: host.getByRole('menu', { includeHidden: true }),
  };
}

export async function replaceQuery(page: Page, query: string) {
  const { input } = keymove(page);
  await page.keyboard.press('Alt+f');
  await expect(input).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await expect(input).toHaveValue('');
  // Use the page keyboard so a lost focus still fails instead of being repaired
  // automatically by a locator action before each keystroke.
  for (const character of query) await page.keyboard.type(character);
  await expect(input).toHaveValue(query);
}

export async function searchFor(page: Page, query: string, mode: 'Text' | 'Actions', count = 1) {
  const { status, suggestions } = keymove(page);
  await replaceQuery(page, query);
  if (query.length >= 3) await expect(suggestions).toHaveAttribute('aria-busy', 'false');
  else await expect(status).toHaveText(/^(Text|Actions)/);
  if (!(await status.textContent())?.startsWith(mode)) await page.keyboard.press('Alt+s');
  await expect(status).toHaveText(`${mode} 1 / ${count}`);
}

/**
 * Types like a keyboard whose layout produces each character: printable ASCII through
 * Playwright's US layout, anything else as a key press carrying that text, as a Cyrillic,
 * Greek or Arabic layout does. Playwright's own fallback for such characters inserts text
 * without key events, which is a different input path (dictation or a character picker).
 */
export async function typeText(page: Page, text: string) {
  for (const character of text) {
    if (/^[\x20-\x7e]$/.test(character)) {
      await page.keyboard.type(character);
      continue;
    }
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: character,
        text: character,
        unmodifiedText: character,
      });
      await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: character });
    } finally {
      await session.detach();
    }
  }
}
