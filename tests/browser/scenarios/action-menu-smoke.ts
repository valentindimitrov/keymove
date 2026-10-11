import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { openPage, waitFor } from '../pages.js';
import { expect } from '@playwright/test';
import { keymove, replaceQuery } from '../keymove.js';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const menu = `${shadow}?.querySelector('[role="menu"]')`;
const focused = `${shadow}?.activeElement`;
const focusedLabel = `${focused}?.querySelector('.keymove-action-label')?.textContent`;

async function checkSelectedRow(page: Page) {
  const layout = await page.evaluate(`(() => {
    const root = ${shadow};
    const row = root.querySelector('.keymove-action-menu-result');
    const body = row.querySelector('.keymove-suggestion-body');
    const rect = row.getBoundingClientRect();
    const bar = root.querySelector('#keymove-bar').getBoundingClientRect();
    return { belowBar: rect.top >= bar.bottom, visible: rect.bottom <= innerHeight,
      singleLine: rect.height <= 35 && body.scrollHeight <= body.clientHeight + 1,
      outsideMenu: !row.closest('#keymove-action-menu-container') };
  })()`);
  assert.deepEqual(layout, { belowBar: true, visible: true, singleLine: true, outsideMenu: true });
}

async function query(page: Page, text: string) {
  await replaceQuery(page, text);
  await expect(keymove(page).suggestions).toHaveAttribute('aria-busy', 'false');
  await expect(keymove(page).host.locator('#keymove-actions-hint')).toBeAttached();
}

export async function checkActionMenu(context: BrowserContext, origin: string) {
  const artifacts = path.resolve(import.meta.dirname, '../../../.artifacts');
  mkdirSync(artifacts, { recursive: true });
  const page = await openPage(context, `${origin}fixtures.html?menu`);
  try {
    await page.bringToFront();
    await expect(keymove(page).bar).toHaveAttribute('data-always-on', 'true');
    await page.evaluate(`(() => {
      const section = document.createElement('section');
      section.innerHTML = '<a id="menu-link" href="#menu-target">Menu demonstration link</a><button id="menu-next">Neighbour control</button><p id="menu-text">Menu standalone paragraph with complete text.</p><textarea id="menu-paste" aria-label="Paste check"></textarea>';
      document.body.prepend(section);
      document.getElementById('menu-link').addEventListener('click', e => { e.preventDefault(); document.body.dataset.menuActivated = 'yes'; });
    })()`);
    await query(page, 'menu demonstration');
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(`Boolean(${menu})`), false, 'Up alone is reserved');
    await page.keyboard.press('ArrowDown');
    await waitFor(page, `${focusedLabel} === 'Open link'`);
    assert.equal(await page.evaluate(`${menu}.querySelectorAll('[role="menuitem"]').length`), 7);
    assert.equal(
      await page.evaluate(`${shadow}.querySelectorAll('.keymove-suggestion').length`),
      1,
    );
    assert.equal(
      await page.evaluate(
        `${shadow}.querySelector('.keymove-action-menu-result .keymove-suggestion-label').textContent`,
      ),
      'Menu demonstration link',
    );
    assert.deepEqual(
      await page.evaluate(
        `Array.from(${menu}.querySelectorAll('.keymove-suggestion-position'), node => node.textContent)`,
      ),
      [1, 2, 3, 4, 5, 6, 7].map(
        number => `${process.platform === 'darwin' ? 'Option' : 'Alt'} + ${number}`,
      ),
    );
    await page.keyboard.press('ArrowDown');
    await waitFor(page, `${focusedLabel} === 'Open in new tab'`);
    await page.keyboard.press('ArrowUp');
    await waitFor(page, `${focusedLabel} === 'Open link'`);
    await page.keyboard.press('Escape');
    await waitFor(page, `!${menu} && ${focused} === ${input}`);
    assert.equal(await keymove(page).input.inputValue(), 'menu demonstration');
    const queryLength = 'menu demonstration'.length;
    await page.evaluate(`${input}.setSelectionRange(${queryLength}, ${queryLength})`);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(`${input}.selectionStart`), queryLength - 1);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(`${input}.selectionStart`), queryLength);
    await page.keyboard.press('ArrowDown');
    await waitFor(page, `${menu}`);
    await page.keyboard.press('ArrowLeft');
    await waitFor(page, `!${menu} && ${focused} === ${input}`);
    assert.equal(await keymove(page).input.inputValue(), 'menu demonstration');
    await page.keyboard.press('ArrowDown');
    await waitFor(page, `${menu}`);
    writeFileSync(path.join(artifacts, 'action-menu-extension.png'), await page.screenshot());
    await checkSelectedRow(page);
    await page.keyboard.press('Tab');
    await waitFor(page, `!${menu} && ${focused} === ${input}`);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Alt+4');
    await waitFor(page, `!${menu} && ${focused} === ${input}`);
    await page.evaluate(`document.getElementById('menu-paste').focus()`);
    await page.keyboard.press('ControlOrMeta+v');
    assert.equal(
      await page.evaluate(`document.getElementById('menu-paste').value`),
      `${origin}fixtures.html?menu#menu-target`,
    );
    await query(page, 'menu demonstration');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Alt+6');
    await waitFor(page, `!${menu} && ${focused} === ${input}`);
    await page.evaluate(
      `document.getElementById('menu-paste').value = ''; document.getElementById('menu-paste').focus()`,
    );
    await page.keyboard.press('ControlOrMeta+v');
    assert.equal(
      await page.evaluate(`document.getElementById('menu-paste').value`),
      'Menu demonstration link',
    );
    await query(page, 'menu demonstration');
    await page.keyboard.press('ArrowDown');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
    await waitFor(page, `${focusedLabel} === 'Focus without activating'`);
    await page.keyboard.press('ArrowRight');
    await waitFor(page, `document.activeElement?.id === 'menu-link' && !${menu}`);
    assert.equal(await page.evaluate('document.body.dataset.menuActivated'), undefined);
    await page.keyboard.press('Tab');
    await waitFor(page, `document.activeElement?.id === 'menu-next'`);
    await query(page, 'menu demonstration');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await waitFor(page, `document.body.dataset.menuActivated === 'yes' && !${menu}`);
    await query(page, 'menu standalone');
    await page.keyboard.press('ArrowDown');
    await waitFor(page, `${focusedLabel} === 'Copy text'`);
    assert.equal(await page.evaluate(`${menu}.querySelectorAll('[role="menuitem"]').length`), 2);
    await page.keyboard.press('Enter');
    await waitFor(page, `!${menu}`);
    await page.evaluate(
      `const paste = document.getElementById('menu-paste'); paste.value = ''; paste.focus();`,
    );
    await page.keyboard.press('ControlOrMeta+v');
    assert.equal(
      await page.evaluate(`document.getElementById('menu-paste').value`),
      'Menu standalone paragraph with complete text.',
    );
    await page.evaluate(`(() => {
      const dialog = document.createElement('dialog');
      dialog.innerHTML = '<button id="menu-modal-action">Menu dialog command</button>';
      document.body.append(dialog);
      dialog.querySelector('button').onclick = () => { document.body.dataset.menuModalActivated = 'yes'; dialog.close(); };
      dialog.showModal();
    })()`);
    await query(page, 'menu dialog command');
    await page.keyboard.press('ArrowDown');
    await waitFor(page, `${focusedLabel} === 'Activate control'`);
    await page.keyboard.press('Enter');
    await waitFor(page, `document.body.dataset.menuModalActivated === 'yes' && !${menu}`);
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
      await preview.bringToFront();
      const panel = `${shadow}?.querySelector('${scenario.startsWith('suggestions') ? '#keymove-suggestions' : '#keymove-action-menu-container'}')`;
      await waitFor(preview, panel);
      const bounds = (await preview.evaluate(`(() => {
        const node = ${panel}; const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight, font: getComputedStyle(node).fontFamily };
      })()`)) as {
        left: number;
        right: number;
        top: number;
        bottom: number;
        width: number;
        height: number;
        font: string;
      };
      assert(
        bounds.left >= 0 &&
          bounds.right <= bounds.width &&
          bounds.top >= 0 &&
          bounds.bottom <= bounds.height,
        JSON.stringify(bounds),
      );
      assert.match(bounds.font, /Helvetica/);
      if (scenario.startsWith('action-menu')) await checkSelectedRow(preview);
      writeFileSync(path.join(artifacts, `${scenario}-preview.png`), await preview.screenshot());
    } finally {
      await preview.close();
    }
  }
}
