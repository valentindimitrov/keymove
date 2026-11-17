import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { keymove } from '../keymove.js';
import { barShown, focusTab, setCheckbox } from './settings-smoke.js';

type ReturnWindow = typeof globalThis & { __returnEscape: number };

async function query(page: Page, value: string) {
  const { status, host } = keymove(page);
  await page.keyboard.press('Alt+f');
  for (const character of value) await page.keyboard.type(character);
  await expect(status).toHaveText('Text 1 / 1');
  await expect(host.locator('[role="option"][aria-disabled="false"]').first()).toBeAttached();
}

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const scrollerTop = (page: Page) =>
  page.locator('#return-scroller').evaluate(element => element.scrollTop);

export async function checkReturnPosition(page: Page, popup: Page) {
  const { input, status, host } = keymove(page);
  await setCheckbox(popup, 'Autohide', false);
  try {
    await focusTab(page);
    await page.keyboard.press('Alt+f');
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.id = 'return-fixture';
      fixture.innerHTML =
        '<div style="height:2000px"></div><h2 id="return-match">Help improve MDN</h2><div id="return-scroller" style="height:180px;overflow:auto"><div style="height:1000px"></div><p id="nested-return-match">Nestedreturntarget</p><div style="height:500px"></div></div><button id="return-next">Next control</button><div style="height:1000px"></div>';
      document.body.append(fixture);
      (globalThis as ReturnWindow).__returnEscape = 0;
      document.getElementById('return-next')!.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !event.defaultPrevented)
          (globalThis as ReturnWindow).__returnEscape++;
      });
      scrollTo({ top: 170, behavior: 'instant' });
    });
    for (const shortcut of ['Tab', 'Alt+1']) {
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
      const original = await scrollY(page);
      // Start by typing while reading, with no page control focused (the MDN case).
      for (const character of 'improve') await page.keyboard.type(character);
      await expect(status).toHaveText('Text 1 / 1');
      await expect(host.locator('[role="option"][aria-disabled="false"]').first()).toBeAttached();
      await page.keyboard.press(shortcut);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.getElementById('return-match')!.getBoundingClientRect().top < innerHeight,
          ),
        )
        .toBe(true);
      expect(await scrollY(page)).toBeGreaterThan(original);
      await page.keyboard.press('Alt+Backspace');
      await expect.poll(() => barShown(page)).toBe(false);
      expect(await scrollY(page), `${shortcut}: return to original position`).toBe(original);
      await expect(input).toHaveValue('');
    }

    await query(page, 'improve');
    await page.keyboard.press('Tab');
    await expect
      .poll(() =>
        page.evaluate(
          () => document.getElementById('return-match')!.getBoundingClientRect().top < innerHeight,
        ),
      )
      .toBe(true);
    const jumped = await scrollY(page);
    await page.keyboard.press('Escape');
    await expect.poll(() => barShown(page)).toBe(false);
    expect(await scrollY(page), 'Escape closes in one press and stays here').toBe(jumped);

    await page.evaluate(() => {
      document.getElementById('return-scroller')!.scrollTop = 80;
      scrollTo({ top: 0, behavior: 'instant' });
    });
    await query(page, 'nestedreturntarget');
    await page.keyboard.press('Tab');
    await expect.poll(() => scrollerTop(page)).toBeGreaterThan(80);
    await page.keyboard.press('Alt+Backspace');
    await expect.poll(() => scrollerTop(page)).toBe(80);
    expect(await scrollY(page), 'Nested result restores both container and page').toBe(0);

    // Escape after focus moved to a page control belongs to that control.
    await query(page, 'improve');
    await page.keyboard.press('Tab');
    await page.locator('#return-next').focus();
    const moved = await scrollY(page);
    await page.keyboard.press('Escape');
    await expect
      .poll(() => page.evaluate(() => (globalThis as ReturnWindow).__returnEscape))
      .toBe(1);
    await expect(page.locator('#return-next')).toBeFocused();
    expect(await scrollY(page)).toBe(moved);
    // Reopening from this control starts a new session, not the original reading position.
    await query(page, 'improve');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Alt+Backspace');
    await expect.poll(() => barShown(page)).toBe(false);
    expect(await scrollY(page)).toBe(moved);
  } finally {
    await page.evaluate(() => document.getElementById('return-fixture')?.remove());
    await setCheckbox(popup, 'Autohide', true);
  }
}
