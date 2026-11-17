import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { openPage } from '../pages.js';
import { keymove } from '../keymove.js';

/** Pending searches retain visible rows, but their shortcuts are deliberately disabled. */
function enabledOptions(page: Page) {
  return keymove(page).host.locator('[role="option"][aria-disabled="false"]');
}

async function openFixture(context: BrowserContext, url: string) {
  const page = await openPage(context, url);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', /.*/);
  await expect(keymove(page).bar).toHaveAttribute('data-always-on', 'true');
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  return page;
}

export async function checkContextNavigation(context: BrowserContext, origin: string) {
  const first = await openFixture(context, `${origin}fixtures.html?context=first`);
  let second: Page | undefined;
  try {
    const one = keymove(first);
    await first.keyboard.press('c');
    await expect(one.input).toHaveValue('c');
    await first.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.style.height = '2000px';
      const match = document.createElement('p');
      match.id = 'context-match';
      match.textContent = 'Contexttarget heading';
      const below = document.createElement('p');
      below.textContent = 'Details below the selected heading';
      below.style.height = '800px';
      document.body.append(spacer, match, below);
    });
    await one.input.focus();
    for (const key of 'ontexttarget') await first.keyboard.type(key);
    await expect(one.status).toHaveText('Text 1 / 1');
    await expect(enabledOptions(first)).toHaveCount(1);
    await first.keyboard.press('Alt+1');
    // An off-screen match scrolls to leave context below it.
    await expect
      .poll(() =>
        first.evaluate(() => {
          const rect = document.getElementById('context-match')!.getBoundingClientRect();
          return rect.top > innerHeight * 0.2 && rect.bottom < innerHeight * 0.75;
        }),
      )
      .toBe(true);

    await first.keyboard.press('Escape');
    for (const key of 'qxy') await first.keyboard.type(key);
    await expect(one.status).toHaveText('Text 1 / 2');
    await expect(enabledOptions(first)).toHaveCount(2);
    await first.keyboard.press('Alt+2');
    await expect(one.status).toHaveText('Text 2 / 2');
    const suggestions = await one.suggestions.textContent();

    // Each tab keeps its own query, cursor and suggestions.
    second = await openFixture(context, `${origin}fixtures.html?context=second`);
    const two = keymove(second);
    await second.keyboard.press('q');
    await expect(two.input).toHaveValue('q');
    await two.input.focus();
    for (const key of 'xyz') await second.keyboard.type(key);
    await expect(two.status).toHaveText('Text 1 / 1');
    await first.bringToFront();
    await expect.poll(() => first.evaluate(() => document.hasFocus())).toBe(true);
    await expect(one.input).toHaveValue('qxy');
    await expect(one.status).toHaveText('Text 2 / 2');
    expect(await one.suggestions.textContent()).toBe(suggestions);
    await second.bringToFront();
    await expect.poll(() => second!.evaluate(() => document.hasFocus())).toBe(true);
    await expect(two.input).toHaveValue('qxyz');
    await expect(two.status).toHaveText('Text 1 / 1');
  } catch (error) {
    await test.info().attach('context navigation diagnostic', {
      body: JSON.stringify(
        await first.evaluate(() => ({
          scrollY,
          height: innerHeight,
          rect: document.getElementById('context-match')?.getBoundingClientRect().toJSON(),
          selected: getSelection()?.toString(),
          row: document.getElementById('keymove-root')?.shadowRoot?.querySelector('[role="option"]')
            ?.outerHTML,
        })),
        null,
        2,
      ),
      contentType: 'application/json',
    });
    throw error;
  } finally {
    await second?.close();
    await first.close();
  }
}
