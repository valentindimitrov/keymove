import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { attachFailure, openPage, snapshot } from '../pages.js';
import { keymove, replaceQuery } from '../keymove.js';

/** Streamed frame replies retain the current node, which can change its rank. */
async function firstAction(page: Page) {
  const { status } = keymove(page);
  await expect(status).toHaveText(/^Actions [1-3] \/ 3$/);
  const current = Number((await status.textContent())?.match(/^Actions (\d+)/)?.[1]);
  for (let position = current; position > 1; position--) await page.keyboard.press('Shift+Tab');
  await expect(status).toHaveText('Actions 1 / 3');
}

async function openSearch(page: Page) {
  await page.keyboard.press('Alt+f');
  await expect(keymove(page).input).toBeFocused();
}

export async function checkIframes(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}frames.html`);
  const { bar, input, status, suggestions } = keymove(page);
  // The first iframe is the same-origin form; its document is reachable from the page.
  const local = page.locator('iframe').first().contentFrame();
  try {
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    await expect(local.locator('#price')).toBeAttached();
    await openSearch(page);
    for (const key of '40') await page.keyboard.type(key);
    await page.keyboard.press('Alt+s');
    await firstAction(page);
    await expect(suggestions).toContainText('Minimum (EUR) — 40');
    await snapshot(page, 'iframe-search');
    await page.keyboard.press('Enter');
    await expect(local.locator('#price')).toBeFocused();
    // From inside the embedded editor, the opening shortcut returns to the one top bar.
    await openSearch(page);
    for (const key of '40') await page.keyboard.type(key);
    await page.keyboard.press('Alt+s');
    await firstAction(page);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('#cross')).toBeFocused();
    // A button inside the cross-origin frame is clicked, not only focused.
    await openSearch(page);
    for (const key of 'Launch') await page.keyboard.type(key);
    await expect(status).toHaveText(/^(Text|Actions) [1-9] \/ [1-9]$/);
    if ((await status.textContent())?.startsWith('Text')) await page.keyboard.press('Alt+s');
    await firstAction(page);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('#cross').contentFrame().locator('#result')).toHaveText('Activated');
    await expect(page.locator('#keymove-root')).toHaveCount(1);
    await openSearch(page);
    for (const key of 'otter') await page.keyboard.type(key);
    await expect(status).toHaveText(/\/ 4$/);
    await page.keyboard.press('Tab');
    await expect
      .poll(() => local.locator('body').evaluate(() => getSelection()?.toString()))
      .toBe('local otter paragraph to copy.');
    await expect
      .poll(() =>
        local
          .locator('body')
          .evaluate(() => CSS.highlights.get('keymove-search-results')?.size ?? 0),
      )
      .toBeGreaterThan(0);
    await page.keyboard.press('ControlOrMeta+c');
    await page.evaluate(() => {
      const target = document.createElement('textarea');
      target.id = 'paste';
      document.body.append(target);
    });
    await page.locator('#paste').focus();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(page.locator('#paste')).toHaveValue('local otter paragraph to copy.');
    await openSearch(page);
    for (const key of 'otter') await page.keyboard.type(key);
    await expect(status).toHaveText(/\/ 4$/);
    await page.locator('#paste').evaluate(target => target.remove());
    await expect(status).toHaveText(/\/ 4$/);
    // Hiding the outer cross-origin frame removes it and its nested frame, not the local one.
    const cross = page.locator('#cross');
    await cross.evaluate(frame => {
      (frame as HTMLElement).hidden = true;
    });
    await expect(status).toHaveText(/\/ 2$/);
    await cross.evaluate(frame => {
      (frame as HTMLElement).hidden = false;
    });
    await expect(status).toHaveText(/\/ 4$/);
    await cross.evaluate(frame => {
      (frame as HTMLIFrameElement).src += '&reload=1';
    });
    await expect(status).toHaveText(/\/ 4$/);
    await expect(suggestions).toHaveAttribute('aria-busy', 'false');
    // Child frames get the smaller helper, never a second searchbar.
    await expect(local.locator('[aria-label="Search page"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(local.locator('#keymove-root')).toHaveCount(0);
    // The first match arrives from a frame. Automatic hover must open its menu,
    // and moving to a sibling result must retain the shared menu ancestry.
    await local.locator('body').evaluate(body => {
      const menu = document.createElement('nav');
      menu.innerHTML =
        '<button>Zephyr menu</button><div id="hover-items" hidden><button id="hover-item">Zephyr item</button></div>';
      body.append(menu);
      const panel = document.getElementById('hover-items')!;
      menu.addEventListener('mouseenter', () => {
        panel.hidden = false;
      });
      menu.addEventListener('mouseleave', () => {
        panel.hidden = true;
      });
      document.getElementById('hover-item')!.addEventListener('click', () => {
        body.dataset['hoverActivated'] = 'yes';
      });
    });
    const hoverItems = local.locator('#hover-items');
    await openSearch(page);
    for (const key of 'zephyr menu') await page.keyboard.type(key);
    await expect(hoverItems).toHaveJSProperty('hidden', false);
    await replaceQuery(page, 'item');
    await expect(input).toHaveValue('item');
    await expect(suggestions).toHaveAttribute('aria-busy', 'false');
    if ((await status.textContent())?.startsWith('Text')) await page.keyboard.press('Alt+s');
    await expect(status).toHaveText('Actions 1 / 1');
    await page.keyboard.press('Tab');
    await expect(status).toHaveText('Actions 1 / 1');
    await expect(hoverItems).toHaveJSProperty('hidden', false);
    await page.keyboard.press('Enter');
    await expect(local.locator('body')).toHaveAttribute('data-hover-activated', 'yes');
  } catch (error) {
    await attachFailure(page);
    throw error;
  } finally {
    await page.close();
  }
}

type IframeTimes = { firstLocalMs: number | null; allFramesMs: number | null };

/** Local-first timing: main-document results publish before every frame has replied. */
export async function measureIframes(context: BrowserContext, origin: string) {
  const samples: { frames: number; firstLocalMs: number; allFramesMs: number }[] = [];
  for (const count of [0, 3, 20]) {
    const page = await openPage(context, `${origin}frames.html?frames=${count}`);
    try {
      await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', /.*/);
      await expect(keymove(page).bar).toHaveAttribute('data-always-on', 'true');
      await openSearch(page);
      await page.evaluate(
        expected => {
          const times: IframeTimes = { firstLocalMs: null, allFramesMs: null };
          (globalThis as typeof globalThis & { __iframeTimes: IframeTimes }).__iframeTimes = times;
          const root = document.getElementById('keymove-root')!.shadowRoot!;
          const field = root.querySelector<HTMLInputElement>('[aria-label="Search page"]')!;
          let start: number | undefined;
          window.addEventListener(
            'keydown',
            () => {
              start = performance.now();
            },
            {
              once: true,
              capture: true,
            },
          );
          const observer = new MutationObserver(() => {
            if (start === undefined || field.value !== '4') return;
            const status = root.querySelector('[role="status"]')?.textContent;
            if (status?.startsWith('Text 1 /') && times.firstLocalMs === null)
              times.firstLocalMs = performance.now() - start;
            if (status === expected) {
              times.allFramesMs = performance.now() - start;
              observer.disconnect();
            }
          });
          observer.observe(root, { subtree: true, childList: true, characterData: true });
        },
        `Text 1 / ${count + 1}`,
      );
      await page.keyboard.press('4');
      const times = () =>
        page.evaluate(
          () => (globalThis as typeof globalThis & { __iframeTimes: IframeTimes }).__iframeTimes,
        );
      await expect.poll(async () => (await times()).allFramesMs).not.toBeNull();
      const value = await times();
      samples.push({
        frames: count,
        firstLocalMs: value.firstLocalMs!,
        allFramesMs: value.allFramesMs!,
      });
    } catch (error) {
      await attachFailure(page);
      throw error;
    } finally {
      await page.close();
    }
  }
  return { iframes: samples };
}
