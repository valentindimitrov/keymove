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
