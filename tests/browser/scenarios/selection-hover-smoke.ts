import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { attachFailure, openPage, snapshot } from '../pages.js';
import { keymove, searchFor } from '../keymove.js';
import { focusTab } from './settings-smoke.js';

async function search(page: Page, text: string, mode: 'Text' | 'Actions' = 'Actions', count = 1) {
  await focusTab(page);
  await searchFor(page, text, mode, count);
}

function enters(page: Page) {
  return page
    .locator('#automatic-hover button')
    .evaluateAll(buttons =>
      buttons.map(button => Number((button as HTMLElement).dataset['enters'])),
    );
}

export async function checkSelectionHover(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}hover.html`);
  const { bar, input, status, suggestions } = keymove(page);
  const submenu = page.locator('#submenu');
  try {
    await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', /.*/);
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    await page.evaluate(() => {
      const fixture = document.createElement('section');
      fixture.id = 'automatic-hover';
      fixture.innerHTML =
        '<button>Automatic hover first</button><button>Automatic hover second</button>';
      for (const button of fixture.children as HTMLCollectionOf<HTMLElement>) {
        button.dataset['enters'] = '0';
        button.addEventListener('mouseenter', () => {
          button.dataset['enters'] = String(Number(button.dataset['enters']) + 1);
        });
      }
      document.body.append(fixture);
    });
    // Automatic selection hovers the first result once; Tab moves hover to the second.
    await search(page, 'automatic hover', 'Actions', 2);
    await expect.poll(() => enters(page)).toEqual([1, 0]);
    await page.keyboard.press('Tab');
    await expect(status).toHaveText('Actions 2 / 2');
    await expect.poll(() => enters(page)).toEqual([1, 1]);
    // Real pointer takeover and the resulting DOM refresh must not re-enter the result.
    await page.mouse.move(1, 1);
    await page
      .locator('#automatic-hover')
      .evaluate(section => section.append(document.createTextNode('Refresh marker')));
    await expect(suggestions).toHaveAttribute('aria-busy', 'false');
    expect(await enters(page)).toEqual([1, 1]);
    await page.keyboard.press('Escape');
    await page.locator('#automatic-hover').evaluate(section => section.remove());
    // Hover opens the submenu without clicking; partial queries keep it open.
    await search(page, 'hommes');
    await expect(submenu).toHaveJSProperty('hidden', false);
    await page.keyboard.press('Alt+1');
    await expect(submenu).toHaveJSProperty('hidden', false);
    expect(
      await page.evaluate(() => document.documentElement.dataset['clicked'] ?? null),
    ).toBeNull();
    await expect(input).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('s');
    await expect(input).toHaveValue('s');
    await expect(suggestions).toHaveAttribute('aria-busy', 'false');
    // The exact-match S button is outside the menu; typing must not hover it.
    await expect(submenu).toHaveJSProperty('hidden', false);
    for (const char of 'neakers') await page.keyboard.type(char);
    await expect(input).toHaveValue('sneakers');
    await expect(status).toHaveText('Actions 1 / 1');
    await page.keyboard.press('Tab');
    await expect(submenu).toHaveJSProperty('hidden', false);
    await snapshot(page, 'selection-hover');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-clicked', 'sneakers');
    await expect(submenu).toHaveJSProperty('hidden', true);
    await search(page, 'hommes');
    await page.keyboard.press('Tab');
    await expect(submenu).toHaveJSProperty('hidden', false);
    await search(page, 'outside menu');
    await expect(submenu).toHaveJSProperty('hidden', false);
    await page.keyboard.press('Tab');
    await expect(submenu).toHaveJSProperty('hidden', true);
    // Hover follows rendered ancestry into an open shadow root.
    await search(page, 'collections');
    await page.keyboard.press('Tab');
    const panel = page.locator('#component p');
    await expect(panel).toHaveJSProperty('hidden', false);
    await search(page, 'velvet footwear', 'Text');
    await page.keyboard.press('Tab');
    await expect(panel).toHaveJSProperty('hidden', false);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveJSProperty('hidden', true);
    await search(page, 'hommes');
    await page.keyboard.press('Tab');
    await expect(submenu).toHaveJSProperty('hidden', false);
    const box = (await page.locator('#sneakers').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(submenu).toHaveJSProperty('hidden', false);
    await page.keyboard.press('Escape');
    // The physical pointer now owns the menu; ending keyboard hover must not close it.
    await expect(submenu).toHaveJSProperty('hidden', false);
    await page.mouse.move(1, 1);
    await expect(submenu).toHaveJSProperty('hidden', true);
  } catch (error) {
    await attachFailure(page);
    throw error;
  } finally {
    await page.close();
  }
}
