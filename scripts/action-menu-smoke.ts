import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor } from './browser-driver.ts';
import type { TestPage } from './browser-driver.ts';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const menu = `${shadow}?.querySelector('[role="menu"]')`;
const focused = `${shadow}?.activeElement`;
const focusedLabel = `${focused}?.querySelector('.keymove-action-label')?.textContent`;

async function checkSelectedRow(page: TestPage) {
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

async function query(page: TestPage, text: string) {
  await page.key('f', 1);
  await page.key('Backspace', process.platform === 'darwin' ? 4 : 2);
  for (const character of text) await page.key(character);
  await waitFor(
    page,
    `${shadow}?.querySelector('#keymove-suggestions')?.getAttribute('aria-busy') === 'false'`,
  );
  await waitFor(page, `${shadow}?.querySelector('#keymove-actions-hint')`);
}

export async function checkActionMenu(client: ChromiumClient, origin: string) {
  const artifacts = path.resolve(import.meta.dirname, '../.artifacts');
  mkdirSync(artifacts, { recursive: true });
  const page = await openPage(client, `${origin}fixtures.html?menu`);
  try {
    await page.activate();
    await waitFor(page, `${shadow}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`);
    await page.evaluate(`(() => {
      const section = document.createElement('section');
      section.innerHTML = '<a id="menu-link" href="#menu-target">Menu demonstration link</a><button id="menu-next">Neighbour control</button><p id="menu-text">Menu standalone paragraph with complete text.</p><textarea id="menu-paste" aria-label="Paste check"></textarea>';
      document.body.prepend(section);
      document.getElementById('menu-link').addEventListener('click', e => { e.preventDefault(); document.body.dataset.menuActivated = 'yes'; });
    })()`);
    await query(page, 'menu demonstration');
    await page.key('ArrowUp');
    assert.equal(await page.evaluate(`Boolean(${menu})`), false, 'Up alone is reserved');
    await page.key('ArrowDown');
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
    await page.key('ArrowDown');
    await waitFor(page, `${focusedLabel} === 'Open in new tab'`);
    await page.key('ArrowUp');
    await waitFor(page, `${focusedLabel} === 'Open link'`);
    await page.key('Escape');
    await waitFor(page, `!${menu} && ${focused} === ${input}`);
    assert.equal(await page.evaluate(`${input}.value`), 'menu demonstration');
    const queryLength = 'menu demonstration'.length;
    await page.evaluate(`${input}.setSelectionRange(${queryLength}, ${queryLength})`);
    await page.key('ArrowLeft');
    assert.equal(await page.evaluate(`${input}.selectionStart`), queryLength - 1);
    await page.key('ArrowRight');
    assert.equal(await page.evaluate(`${input}.selectionStart`), queryLength);
    await page.key('ArrowDown');
    await waitFor(page, `${menu}`);
    await page.key('ArrowLeft');
    await waitFor(page, `!${menu} && ${focused} === ${input}`);
    assert.equal(await page.evaluate(`${input}.value`), 'menu demonstration');
    await page.key('ArrowDown');
    await waitFor(page, `${menu}`);
    writeFileSync(path.join(artifacts, 'action-menu-extension.png'), await page.screenshot());
    await checkSelectedRow(page);
    await page.key('Tab');
    await waitFor(page, `!${menu} && ${focused} === ${input}`);
    await page.key('ArrowDown');
    await page.key('4', 1);
    await waitFor(page, `!${menu} && ${focused} === ${input}`);
    await page.evaluate(`document.getElementById('menu-paste').focus()`);
    await page.key('v', process.platform === 'darwin' ? 4 : 2);
    assert.equal(
      await page.evaluate(`document.getElementById('menu-paste').value`),
      `${origin}fixtures.html?menu#menu-target`,
    );
    await query(page, 'menu demonstration');
    await page.key('ArrowDown');
    await page.key('6', 1);
    await waitFor(page, `!${menu} && ${focused} === ${input}`);
    await page.evaluate(
      `document.getElementById('menu-paste').value = ''; document.getElementById('menu-paste').focus()`,
    );
    await page.key('v', process.platform === 'darwin' ? 4 : 2);
    assert.equal(
      await page.evaluate(`document.getElementById('menu-paste').value`),
      'Menu demonstration link',
    );
    await query(page, 'menu demonstration');
    await page.key('ArrowDown');
    for (let i = 0; i < 4; i++) await page.key('ArrowDown');
    await waitFor(page, `${focusedLabel} === 'Focus without activating'`);
    await page.key('ArrowRight');
    await waitFor(page, `document.activeElement?.id === 'menu-link' && !${menu}`);
    assert.equal(await page.evaluate('document.body.dataset.menuActivated'), undefined);
    await page.key('Tab');
    await waitFor(page, `document.activeElement?.id === 'menu-next'`);
    await query(page, 'menu demonstration');
    await page.key('ArrowDown');
    await page.key('Enter');
    await waitFor(page, `document.body.dataset.menuActivated === 'yes' && !${menu}`);
    await query(page, 'menu standalone');
    await page.key('ArrowDown');
    await waitFor(page, `${focusedLabel} === 'Copy text'`);
    assert.equal(await page.evaluate(`${menu}.querySelectorAll('[role="menuitem"]').length`), 2);
    await page.key('Enter');
    await waitFor(page, `!${menu}`);
    await page.evaluate(
      `const paste = document.getElementById('menu-paste'); paste.value = ''; paste.focus();`,
    );
    await page.key('v', process.platform === 'darwin' ? 4 : 2);
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
    await page.key('ArrowDown');
    await waitFor(page, `${focusedLabel} === 'Activate control'`);
    await page.key('Enter');
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
    const preview = await openPage(client, `${origin}?scenario=${scenario}`);
    try {
      await preview.activate();
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
