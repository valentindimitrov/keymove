import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { openPage, snapshot } from '../pages.js';
import { keymove } from '../keymove.js';
import { focusTab, setCheckbox, settingsTab } from './settings-smoke.js';

type AnimatedWindow = typeof globalThis & { __tooltipAnimationChanges: number };

const shortcut = process.platform === 'darwin' ? 'Option + 1' : 'Alt + 1';

/** The first numbered badge: the full Alt/Option label in tooltips mode, a number otherwise. */
function badge(page: Page) {
  return keymove(page).host.locator('.keymove-suggestion-position').first();
}

async function checkMenuSurvivesAnimation(page: Page) {
  const changes = () =>
    page.evaluate(() => (globalThis as AnimatedWindow).__tooltipAnimationChanges);
  const before = await changes();
  await expect.poll(changes).toBeGreaterThanOrEqual(before + 12);
  await expect(keymove(page).menu, 'Page animation must not dismiss the menu').toHaveCount(1);
  expect(
    await page.evaluate(() =>
      document.getElementById('keymove-root')?.shadowRoot?.activeElement?.getAttribute('role'),
    ),
  ).toBe('menuitem');
}

export async function checkTooltipsMode(context: BrowserContext, origin: string, popup: Page) {
  await settingsTab(popup, 'Appearance');
  const toggle = popup.getByLabel('Tooltips mode', { exact: true });
  await expect(toggle).toBeChecked();
  expect(
    await popup
      .locator('label')
      .evaluateAll(labels => labels.slice(0, 3).map(label => label.textContent)),
  ).toEqual(['Appearance', 'Tooltips mode', 'Highlight matches']);
  const page = await openPage(context, `${origin}fixtures.html?tooltips`);
  const { bar, input, menu, host } = keymove(page);
  try {
    await expect(bar).toHaveAttribute('data-always-on', 'true');
    await focusTab(page);
    await page.evaluate(() => {
      const link = document.createElement('a');
      link.textContent = 'Tooltip demonstration link';
      link.href = '#tooltip-target';
      document.body.prepend(link);
      const paste = document.createElement('textarea');
      paste.id = 'tooltips-paste';
      document.body.append(paste);
    });
    await page.keyboard.press('Alt+f');
    await expect(input).toBeFocused();
    for (const character of 'tooltip demonstration') await page.keyboard.type(character);
    await expect(badge(page)).toHaveText(shortcut);
    await page.keyboard.press('Alt+1');
    await page.evaluate(() => {
      const state = globalThis as AnimatedWindow;
      state.__tooltipAnimationChanges = 0;
      const animated = document.getElementById('dynamic')!;
      setInterval(() => {
        animated.style.opacity = ++state.__tooltipAnimationChanges % 2 ? '0.9' : '1';
      }, 16);
    });
    await page.keyboard.press('ArrowDown');
    await expect(menu).toHaveCount(1);
    await expect(badge(page)).toHaveText(shortcut);
    await checkMenuSurvivesAnimation(page);
    // Switching the setting in the settings document updates the open menu live.
    await setCheckbox(popup, 'Tooltips mode', false);
    await expect(badge(page)).toHaveText('1');
    await expect(menu).toHaveCount(1);
    await checkMenuSurvivesAnimation(page);
    await expect(host.locator('#keymove-actions-hint, .keymove-action-menu-footer')).toHaveCount(0);
    await expect(input).not.toHaveAttribute('aria-describedby');
    await expect(popup.locator('.keymove-popup-reminder')).toHaveCount(0);
    await snapshot(page, 'tooltips-clean-extension');
    // The same numbered action still works immediately with the hints hidden.
    await page.keyboard.press('Alt+4');
    await expect(menu).toHaveCount(0);
    await expect(badge(page)).toHaveText('1');
    await expect(input).toHaveValue('tooltip demonstration');
    const paste = page.locator('#tooltips-paste');
    await paste.focus();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(paste).toHaveValue(`${origin}fixtures.html?tooltips#tooltip-target`);
    await page.keyboard.press('Alt+f');
    await expect(input).toBeFocused();
    for (const character of 'tooltip demonstration') await page.keyboard.type(character);
    await expect(badge(page)).toHaveText('1');
    await page.keyboard.press('Alt+1');
    await page.keyboard.press('ArrowDown');
    await expect(menu).toHaveCount(1);
    await checkMenuSurvivesAnimation(page);
    await setCheckbox(popup, 'Tooltips mode', true);
    await expect(menu).toHaveCount(1);
    await expect(badge(page)).toHaveText(shortcut);
    await expect(host.locator('#keymove-actions-hint')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(badge(page)).toHaveText(shortcut);
    await popup.bringToFront();
    await snapshot(popup, 'tooltips-settings');
  } finally {
    await setCheckbox(popup, 'Tooltips mode', true);
    await page.close();
    await settingsTab(popup, 'General');
  }
}
