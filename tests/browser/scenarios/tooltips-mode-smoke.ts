import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { openPage, waitFor } from '../pages.js';

import { settingsTab } from './settings-smoke.js';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const menu = `${shadow}?.querySelector('[role="menu"]')`;
const badge = `${shadow}?.querySelector('.keymove-suggestion-position')`;
const toggle = `Array.from(document.querySelectorAll('label')).find(label => label.textContent === 'Tooltips mode').control`;
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
const shortcut = process.platform === 'darwin' ? 'Option + 1' : 'Alt + 1';

async function checkMenuSurvivesAnimation(page: Page) {
  const changes = await page.evaluate('globalThis.__tooltipAnimationChanges');
  assert.equal(typeof changes, 'number');
  await waitFor(page, `globalThis.__tooltipAnimationChanges >= ${Number(changes) + 12}`);
  assert.equal(
    await page.evaluate(`Boolean(${menu})`),
    true,
    'Page animation must not dismiss the menu',
  );
  assert.equal(await page.evaluate(`${shadow}.activeElement?.getAttribute('role')`), 'menuitem');
}

export async function checkTooltipsMode(context: BrowserContext, origin: string, popup: Page) {
  await settingsTab(popup, 'Appearance');
  assert.equal(await popup.evaluate(`${toggle}.checked`), true);
  assert.deepEqual(
    await popup.evaluate(
      `Array.from(document.querySelectorAll('label')).slice(0, 3).map(label => label.textContent)`,
    ),
    ['Appearance', 'Tooltips mode', 'Highlight matches'],
  );
  const page = await openPage(context, `${origin}fixtures.html?tooltips`);
  try {
    await page.bringToFront();
    await waitFor(page, `${input}`);
    await waitFor(
      page,
      `document.hasFocus() && ${shadow}.querySelector('#keymove-bar').dataset.alwaysOn === 'true'`,
    );
    await page.evaluate(`(() => {
      const link = document.createElement('a');
      link.textContent = 'Tooltip demonstration link'; link.href = '#tooltip-target';
      document.body.prepend(link);
      const paste = document.createElement('textarea'); paste.id = 'tooltips-paste'; document.body.append(paste);
    })()`);
    await page.keyboard.press('Alt+f');
    await waitFor(page, `${shadow}.activeElement === ${input}`);
    for (const character of 'tooltip demonstration') await page.keyboard.type(character);
    await waitFor(page, `${badge}?.textContent === ${JSON.stringify(shortcut)}`);
    await page.keyboard.press('Alt+1');
    await page.evaluate(`(() => {
      globalThis.__tooltipAnimationChanges = 0;
      const animated = document.getElementById('dynamic');
      setInterval(() => {
        animated.style.opacity = (++globalThis.__tooltipAnimationChanges % 2) ? '0.9' : '1';
      }, 16);
    })()`);
    await page.keyboard.press('ArrowDown');
    await waitFor(page, `${menu} && ${badge}?.textContent === ${JSON.stringify(shortcut)}`);
    await checkMenuSurvivesAnimation(page);
    await popup.evaluate(`${toggle}.click()`);
    await waitFor(page, `${menu} && ${badge}?.textContent === '1'`);
    await checkMenuSurvivesAnimation(page);
    assert.equal(
      await page.evaluate(
        `Boolean(${shadow}.querySelector('#keymove-actions-hint, .keymove-action-menu-footer'))`,
      ),
      false,
    );
    assert.equal(await page.evaluate(`${input}.getAttribute('aria-describedby')`), null);
    assert.equal(
      await popup.evaluate(`Boolean(document.querySelector('.keymove-popup-reminder'))`),
      false,
    );
    writeFileSync(
      path.resolve(import.meta.dirname, '../../../.artifacts/tooltips-clean-extension.png'),
      await page.screenshot(),
    );
    // The same numbered action still works immediately with the hints hidden.
    await page.keyboard.press('Alt+4');
    await waitFor(page, `!${menu} && ${badge}?.textContent === '1'`);
    assert.equal(await page.evaluate(`${input}.value`), 'tooltip demonstration');
    await page.evaluate(`document.getElementById('tooltips-paste').focus()`);
    await page.keyboard.press(`${modifier}+v`);
    assert.equal(
      await page.evaluate(`document.getElementById('tooltips-paste').value`),
      `${origin}fixtures.html?tooltips#tooltip-target`,
    );
    await page.keyboard.press('Alt+f');
    await waitFor(page, `${shadow}.activeElement === ${input}`);
    for (const character of 'tooltip demonstration') await page.keyboard.type(character);
    await waitFor(page, `${badge}?.textContent === '1'`);
    await page.keyboard.press('Alt+1');
    await page.keyboard.press('ArrowDown');
    await waitFor(page, `${menu}`);
    await checkMenuSurvivesAnimation(page);
    await popup.evaluate(`${toggle}.click()`);
    await waitFor(page, `${menu} && ${badge}?.textContent === ${JSON.stringify(shortcut)}`);
    assert.equal(
      await page.evaluate(`Boolean(${shadow}.querySelector('#keymove-actions-hint'))`),
      true,
    );
    await page.keyboard.press('Escape');
    await waitFor(page, `!${menu} && ${badge}?.textContent === ${JSON.stringify(shortcut)}`);
    await popup.bringToFront();
    writeFileSync(
      path.resolve(import.meta.dirname, '../../../.artifacts/tooltips-settings.png'),
      await popup.screenshot(),
    );
  } finally {
    await popup.evaluate(`if (!${toggle}.checked) ${toggle}.click()`);
    await page.close();
    await settingsTab(popup, 'General');
  }
}
