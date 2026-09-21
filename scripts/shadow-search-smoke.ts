import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor } from './browser-driver.ts';
import type { TestPage } from './browser-driver.ts';

const shadow = 'globalThis.__shadowKeyMove.shadowRoot';
const input = `${shadow}.querySelector('[aria-label="Search page"]')`;
const status = `${shadow}.querySelector('[role="status"]').textContent`;
const component = `document.getElementById('component').shadowRoot`;
const modifier = process.platform === 'darwin' ? 4 : 2;
async function search(page: TestPage, query: string, mode: 'Text' | 'Actions', count = 1) {
  await page.key('f', 1);
  await waitFor(page, `${shadow}.activeElement === ${input}`);
  await page.key('a', modifier);
  await page.key('Backspace');
  await waitFor(page, `${input}.value === ''`);
  for (const char of query) await page.key(char);
  await waitFor(
    page,
    `${shadow}.querySelector('[role="listbox"]')?.getAttribute('aria-busy') === 'false'`,
  );
  if (!((await page.evaluate(status)) as string).startsWith(mode)) await page.key('s', 1);
  await waitFor(page, `${status} === '${mode} 1 / ${count}'`);
}

export async function checkShadowSearch(client: ChromiumClient, origin: string) {
  const page = await openPage(client, `${origin}shadow.html`);
  try {
    await page.activate();
    await waitFor(
      page,
      `document.documentElement.dataset.fixtureReady && document.getElementById('keymove-root')?.shadowRoot?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`,
    );
    await page.evaluate(`globalThis.__shadowKeyMove = document.getElementById('keymove-root')`);
    // Opening a native shadow dialog before the first query must not strand the UI
    // outside its inert boundary while no search index exists yet.
    await page.evaluate(`${component}.querySelector('dialog').showModal()`);
    await waitFor(
      page,
      `globalThis.__shadowKeyMove.parentElement === ${component}.querySelector('dialog')`,
    );
    await search(page, 'close component dialog', 'Actions');
    await page.key('Enter');
    await waitFor(page, `globalThis.__shadowKeyMove.parentElement === document.body`);
    await search(page, 'orbit', 'Text', 4);
    for (const expected of [
      'Orbit before',
      'Orbit middle paragraph.',
      'Orbit nested paragraph.',
      'Orbit after',
    ]) {
      assert.equal(await page.evaluate('getSelection().toString()'), expected);
      await page.key('Tab');
    }
    await waitFor(page, `CSS.highlights.get('keymove-search-results')?.size === 4`);
    assert.equal(
      await page.evaluate(
        `${component}.adoptedStyleSheets.some(sheet => [...sheet.cssRules].some(rule => rule.cssText.includes('keymove-search-results')))`,
      ),
      true,
    );
    writeFileSync(path.resolve('.artifacts/shadow-highlights.png'), await page.screenshot());
    await search(page, 'bright comet ahead', 'Text');
    // Chromium's Selection.toString() can omit assigned slot text. Verify composed
    // endpoints and the actual clipboard separately instead of treating it as an oracle.
    assert.equal(
      await page.evaluate(`(() => {
      const range = getSelection().getComposedRanges({ shadowRoots: [${component}] })[0];
      const block = ${component}.getElementById('slotted');
      return range.startContainer === block.firstChild && range.startOffset === 0 && range.endContainer === block.lastChild && range.endOffset === block.lastChild.length;
    })()`),
      true,
    );
    assert.deepEqual(
      await page.evaluate(
        `[...CSS.highlights.get('keymove-search-results')].map(range => range.toString())`,
      ),
      ['Bright ', 'comet', ' ahead'],
    );
    writeFileSync(path.resolve('.artifacts/shadow-search.png'), await page.screenshot());
    await page.key('c', modifier);
    await page.evaluate(`document.querySelector('textarea').focus()`);
    await page.key('v', modifier);
    await waitFor(page, `document.querySelector('textarea').value === 'Bright comet ahead'`);
    await search(page, 'component mailbox', 'Actions');
    await page.key('Enter');
    await waitFor(page, `${component}.activeElement?.id === 'mailbox'`);
    for (const char of 'hello') await page.key(char);
    assert.equal(await page.evaluate(`${component}.getElementById('mailbox').value`), 'hello');
    await search(page, 'component digest', 'Actions');
    await page.key('Enter');
    assert.equal(await page.evaluate(`${component}.getElementById('digest').checked`), true);
    await search(page, 'nested ignition', 'Actions');
    await page.key('Enter');
    assert.equal(await page.evaluate(`document.getElementById('component').dataset.nested`), 'yes');
    await search(page, 'orbit nested', 'Text');
    await page.evaluate(
      `${component}.getElementById('nested').shadowRoot.querySelector('p').textContent = 'Changed starlight'`,
    );
    await waitFor(page, `${status}.endsWith('0 / 0')`);
    await search(page, 'changed starlight', 'Text');
    await search(page, 'open component dialog', 'Actions');
    await page.key('Enter');
    await waitFor(
      page,
      `globalThis.__shadowKeyMove.parentElement === ${component}.querySelector('dialog')`,
    );
    await search(page, 'save component', 'Actions');
    await page.key('Enter');
    assert.equal(await page.evaluate(`document.getElementById('component').dataset.saved`), 'yes');
    await search(page, 'close component dialog', 'Actions');
    await page.key('Enter');
    await waitFor(page, `globalThis.__shadowKeyMove.parentElement === document.body`);
    await search(page, 'launch capsule', 'Actions');
    await page.evaluate(`document.getElementById('component').style.display = 'none'`);
    await waitFor(page, `${status}.endsWith('0 / 0')`);
    await waitFor(page, `${component}.adoptedStyleSheets.length === 1`);
    assert.equal(
      await page.evaluate(
        `${component}.adoptedStyleSheets[0].cssRules[0].cssText.includes('--page-owned-sheet')`,
      ),
      true,
    );
  } finally {
    await page.close();
  }
}
