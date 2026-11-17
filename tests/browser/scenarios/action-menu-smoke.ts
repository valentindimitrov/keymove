import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { attachFailure, openPage, snapshot } from '../pages.js';
import { keymove, replaceQuery } from '../keymove.js';

/** The label of the focused menu item: the menu uses native focus, not a second cursor. */
function focusedLabel(page: Page) {
  return page.evaluate(
    () =>
      document
        .getElementById('keymove-root')
        ?.shadowRoot?.activeElement?.querySelector('.keymove-action-label')?.textContent ?? null,
  );
}

async function expectMenuClosedWithInputFocused(page: Page) {
  const { menu, input } = keymove(page);
  await expect(menu).toHaveCount(0);
  await expect(input).toBeFocused();
}

/** The selected result stays one line, below the bar, outside the scrolling action list. */
async function checkSelectedRow(page: Page) {
  const layout = await page.evaluate(() => {
    const root = document.getElementById('keymove-root')!.shadowRoot!;
    const row = root.querySelector('.keymove-action-menu-result')!;
    const body = row.querySelector('.keymove-suggestion-body')!;
    const rect = row.getBoundingClientRect();
    const bar = root.querySelector('#keymove-bar')!.getBoundingClientRect();
    return {
      belowBar: rect.top >= bar.bottom,
      visible: rect.bottom <= innerHeight,
      singleLine: rect.height <= 35 && body.scrollHeight <= body.clientHeight + 1,
      outsideMenu: !row.closest('#keymove-action-menu-container'),
    };
  });
  expect(layout).toEqual({ belowBar: true, visible: true, singleLine: true, outsideMenu: true });
}

async function query(page: Page, text: string) {
  await replaceQuery(page, text);
  await expect(keymove(page).suggestions).toHaveAttribute('aria-busy', 'false');
  await expect(keymove(page).host.locator('#keymove-actions-hint')).toBeAttached();
}

async function pasteInto(page: Page, expected: string) {
  const paste = page.locator('#menu-paste');
  await paste.fill('');
  await paste.focus();
  await page.keyboard.press('ControlOrMeta+v');
  await expect(paste).toHaveValue(expected);
}

export async function checkActionMenu(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}fixtures.html?menu`);
  const { bar, input, menu, host } = keymove(page);
  const altLabel = process.platform === 'darwin' ? 'Option' : 'Alt';
  try {
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    await page.evaluate(() => {
      const section = document.createElement('section');
      section.innerHTML =
        '<a id="menu-link" href="#menu-target">Menu demonstration link</a><button id="menu-next">Neighbour control</button><p id="menu-text">Menu standalone paragraph with complete text.</p><textarea id="menu-paste" aria-label="Paste check"></textarea>';
      document.body.prepend(section);
      document.getElementById('menu-link')!.addEventListener('click', event => {
        event.preventDefault();
        document.body.dataset['menuActivated'] = 'yes';
      });
    });
    await query(page, 'menu demonstration');
    await page.keyboard.press('ArrowUp');
    await expect(menu, 'Up alone is reserved').toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => focusedLabel(page)).toBe('Open link');
    await expect(menu.getByRole('menuitem', { includeHidden: true })).toHaveCount(7);
    await expect(host.locator('.keymove-suggestion')).toHaveCount(1);
    await expect(host.locator('.keymove-action-menu-result .keymove-suggestion-label')).toHaveText(
      'Menu demonstration link',
    );
    await expect(menu.locator('.keymove-suggestion-position')).toHaveText(
      [1, 2, 3, 4, 5, 6, 7].map(number => `${altLabel} + ${number}`),
    );
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => focusedLabel(page)).toBe('Open in new tab');
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => focusedLabel(page)).toBe('Open link');
    await page.keyboard.press('Escape');
    await expectMenuClosedWithInputFocused(page);
    await expect(input).toHaveValue('menu demonstration');
    // Left and Right keep their text-editing behavior in the search input.
    const queryLength = 'menu demonstration'.length;
    const caret = () => input.evaluate(field => (field as HTMLInputElement).selectionStart);
    // Place the caret at the end; End does not move it on macOS.
    await input.evaluate(
      (field, end) => (field as HTMLInputElement).setSelectionRange(end, end),
      queryLength,
    );
    await page.keyboard.press('ArrowLeft');
    await expect.poll(caret).toBe(queryLength - 1);
    await page.keyboard.press('ArrowRight');
    await expect.poll(caret).toBe(queryLength);
    await page.keyboard.press('ArrowDown');
    await expect(menu).toHaveCount(1);
    await page.keyboard.press('ArrowLeft');
    await expectMenuClosedWithInputFocused(page);
    await expect(input).toHaveValue('menu demonstration');
    await page.keyboard.press('ArrowDown');
    await expect(menu).toHaveCount(1);
    await snapshot(page, 'action-menu-extension');
    await checkSelectedRow(page);
    await page.keyboard.press('Tab');
    await expectMenuClosedWithInputFocused(page);
    // Alt+4 copies the link address; Alt+6 copies its text.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Alt+4');
    await expectMenuClosedWithInputFocused(page);
    await pasteInto(page, `${origin}fixtures.html?menu#menu-target`);
    await query(page, 'menu demonstration');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Alt+6');
    await expectMenuClosedWithInputFocused(page);
    await pasteInto(page, 'Menu demonstration link');
    await query(page, 'menu demonstration');
    await page.keyboard.press('ArrowDown');
    for (let index = 0; index < 4; index++) await page.keyboard.press('ArrowDown');
    await expect.poll(() => focusedLabel(page)).toBe('Focus without activating');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#menu-link')).toBeFocused();
    await expect(menu).toHaveCount(0);
    expect(await page.evaluate(() => document.body.dataset['menuActivated'])).toBeUndefined();
    await page.keyboard.press('Tab');
    await expect(page.locator('#menu-next')).toBeFocused();
    await query(page, 'menu demonstration');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-menu-activated', 'yes');
    await expect(menu).toHaveCount(0);
    await query(page, 'menu standalone');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => focusedLabel(page)).toBe('Copy text');
    await expect(menu.getByRole('menuitem', { includeHidden: true })).toHaveCount(2);
    await page.keyboard.press('Enter');
    await expect(menu).toHaveCount(0);
    await pasteInto(page, 'Menu standalone paragraph with complete text.');
    await page.evaluate(() => {
      const dialog = document.createElement('dialog');
      dialog.innerHTML = '<button id="menu-modal-action">Menu dialog command</button>';
      document.body.append(dialog);
      dialog.querySelector('button')!.onclick = () => {
        document.body.dataset['menuModalActivated'] = 'yes';
        dialog.close();
      };
      dialog.showModal();
    });
    await query(page, 'menu dialog command');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => focusedLabel(page)).toBe('Activate control');
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-menu-modal-activated', 'yes');
    await expect(menu).toHaveCount(0);
  } catch (error) {
    await attachFailure(page);
    throw error;
  } finally {
    await page.close();
  }
  for (const scenario of [
    'action-menu',
    'action-menu-narrow',
    'action-menu-clean',
    'action-menu-bottom-edge',
    'suggestions-hints',
    'suggestions-clean',
  ]) {
    const preview = await openPage(context, `${origin}?scenario=${scenario}`);
    try {
      const selector = scenario.startsWith('suggestions')
        ? '#keymove-suggestions'
        : '#keymove-action-menu-container';
      const panel = keymove(preview).host.locator(selector);
      await expect(panel).toBeAttached();
      const bounds = await panel.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: innerWidth,
          height: innerHeight,
          font: getComputedStyle(node).fontFamily,
        };
      });
      expect(
        bounds.left >= 0 &&
          bounds.right <= bounds.width &&
          bounds.top >= 0 &&
          bounds.bottom <= bounds.height,
        JSON.stringify(bounds),
      ).toBe(true);
      expect(bounds.font).toMatch(/Helvetica/);
      if (scenario.startsWith('action-menu')) await checkSelectedRow(preview);
      await snapshot(preview, `${scenario}-preview`);
    } catch (error) {
      await attachFailure(preview);
      throw error;
    } finally {
      await preview.close();
    }
  }
}
