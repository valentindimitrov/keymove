import { expect } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { attachFailure, openPage } from '../pages.js';
import { keymove } from '../keymove.js';

type DynamicWindow = typeof globalThis & {
  __dynamicChanges: number;
  __dynamicTiming: number | null;
  __pageClicks: number;
  __pageClickErrors: number;
};

export async function checkDynamicPage(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}fixtures.html?size=large&dynamic`);
  const { bar, input, status, menu } = keymove(page);
  const changes = () => page.evaluate(() => (globalThis as DynamicWindow).__dynamicChanges);
  try {
    await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', /.*/);
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
    // A page animation mutates the DOM every frame while the user searches.
    await page.evaluate(() => {
      const state = globalThis as DynamicWindow;
      state.__dynamicChanges = 0;
      state.__dynamicTiming = null;
      const changing = document.getElementById('dynamic')!;
      setInterval(() => {
        changing.style.opacity = ++state.__dynamicChanges % 2 ? '0.9' : '1';
      }, 16);
      let started: number | undefined;
      window.addEventListener(
        'keydown',
        () => {
          started = performance.now();
        },
        {
          capture: true,
          once: true,
        },
      );
      const root = document.getElementById('keymove-root')!.shadowRoot!;
      const observer = new MutationObserver(() => {
        if (
          started !== undefined &&
          root.querySelector('[role="status"]')?.textContent === 'Text 1 / 4'
        ) {
          state.__dynamicTiming = performance.now() - started;
          observer.disconnect();
        }
      });
      observer.observe(root, { subtree: true, childList: true, characterData: true });
    });
    await page.keyboard.press('q');
    await expect
      .poll(() => page.evaluate(() => typeof (globalThis as DynamicWindow).__dynamicTiming))
      .toBe('number');
    const searchMs = (await page.evaluate(() => (globalThis as DynamicWindow).__dynamicTiming))!;
    // Keep the animation running through subsequent keystrokes and selection changes.
    for (const character of 'xyz') await page.keyboard.type(character);
    await expect(status).toHaveText('Text 1 / 1');
    await expect.poll(changes).toBeGreaterThanOrEqual(5);
    await page.keyboard.press('Tab');
    await expect
      .poll(() => page.evaluate(() => getSelection()?.toString()))
      .toContain('semantic block');
    await page.keyboard.press('ArrowDown');
    await expect(menu).toHaveCount(1);
    const before = await changes();
    await expect.poll(changes).toBeGreaterThanOrEqual(before + 12);
    await expect(menu, 'Page animation must not dismiss the action menu').toHaveCount(1);
    expect(
      await page.evaluate(() =>
        document.getElementById('keymove-root')?.shadowRoot?.activeElement?.getAttribute('role'),
      ),
    ).toBe('menuitem');
    await page.keyboard.press('Escape');
    await expect(input).toBeFocused();
    await page.evaluate(() => {
      const state = globalThis as DynamicWindow;
      state.__pageClicks = 0;
      state.__pageClickErrors = 0;
      addEventListener('error', () => state.__pageClickErrors++);
      document.onclick = event => {
        state.__pageClicks++;
        // Same shallow-target failure as the Elgato tracking handler.
        void (event.target as Node).parentNode!.parentNode!.parentNode!.parentNode!.nodeName;
      };
    });
    const clicks = () =>
      page.evaluate(() => {
        const state = globalThis as DynamicWindow;
        return { clicks: state.__pageClicks, errors: state.__pageClickErrors };
      });
    // A real click inside the interface stays isolated from the page's document handlers.
    await input.click();
    expect(await clicks()).toEqual({ clicks: 0, errors: 0 });
    // Page controls still reach their own handlers and the document listener.
    await page.locator('button[aria-label="apricot"]').click();
    await expect.poll(clicks).toEqual({ clicks: 1, errors: 0 });
    return { searchMs };
  } catch (error) {
    await attachFailure(page);
    throw error;
  } finally {
    await page.close();
  }
}
