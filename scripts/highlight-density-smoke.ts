import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor } from './browser-driver.ts';

const root = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${root}?.querySelector('[aria-label="Search page"]')`;
const status = `${root}?.querySelector('[role="status"]')?.textContent`;
const outlines = `${root}.querySelectorAll('.keymove-selection')`;
const marks = `CSS.highlights.has('keymove-search-results')`;

export async function checkHighlightDensity(client: ChromiumClient, origin: string) {
  const page = await openPage(client, `${origin}highlights.html`);
  try {
    await page.activate();
    await waitFor(
      page,
      `document.hasFocus() && ${root}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`,
    );
    await page.key('f', 1);
    await waitFor(page, `${root}.activeElement === ${input}`);
    await page.key('s');
    await waitFor(page, `${status}?.startsWith('Text 1 /')`);
    await page.key('s', 1);
    await waitFor(page, `${status} === 'Actions 1 / 12'`);
    for (let index = 1; index <= 12; index++) {
      await waitFor(page, `${status} === 'Actions ${index} / 12'`);
      assert.equal(await page.evaluate(`${outlines}.length`), 1);
      assert.equal(await page.evaluate(marks), false);
      await page.key('Tab');
    }
    await waitFor(page, `${status} === 'Actions 1 / 12'`);
    writeFileSync(path.resolve('.artifacts/highlights-short.png'), await page.screenshot());
    await page.key('n');
    await waitFor(page, `${input}.value === 'sn' && ${status} === 'Actions 1 / 12'`);
    assert.equal(await page.evaluate(marks), false);
    await page.key('e');
    await waitFor(page, `${input}.value === 'sne' && ${status} === 'Actions 1 / 12' && ${marks}`);
    assert.equal(await page.evaluate(`${outlines}.length`), 12);
    assert.equal(
      await page.evaluate(`${root}.querySelectorAll('.keymove-selected-selection').length`),
      1,
    );
    assert.equal(await page.evaluate(`CSS.highlights.get('keymove-search-results').size`), 12);
    writeFileSync(path.resolve('.artifacts/highlights-long.png'), await page.screenshot());
    await page.key('s', 1);
    await waitFor(page, `${status} === 'Text 1 / 12'`);
    assert.equal(await page.evaluate(`${outlines}.length`), 12);
    assert.equal(
      await page.evaluate(`${root}.querySelectorAll('.keymove-selected-selection').length`),
      1,
    );
    writeFileSync(path.resolve('.artifacts/highlights-long-text.png'), await page.screenshot());
    await page.key('Backspace');
    await waitFor(page, `${input}.value === 'sn' && !${marks}`);
    await waitFor(page, `${status} === 'Text 1 / 12'`);
    assert.equal(await page.evaluate(`${outlines}.length`), 1);
    assert.equal(await page.evaluate('getSelection().toString()'), 'Sneakers classic');
    await page.key('Tab');
    await waitFor(page, `${status} === 'Text 2 / 12'`);
    assert.equal(await page.evaluate('getSelection().toString()'), 'Sneakers canvas');
    await page.key('Escape');
    await waitFor(page, `${outlines}.length === 0 && !${marks}`);
    await page.key('f', 1);
    await waitFor(page, `${root}.activeElement === ${input}`);
    await page.key('4');
    await waitFor(page, `${root}.querySelectorAll('[role="option"]').length === 2`);
    await page.key('0');
    await waitFor(page, `${input}.value === '40' && ${status} === 'Text 1 / 1'`);
    await waitFor(
      page,
      `${root}.querySelector('[role="option"]')?.textContent.includes('Minimum (EUR) — 40')`,
    );
    assert.equal(await page.evaluate(`${outlines}.length`), 1);
    assert.equal(await page.evaluate(marks), false);
    writeFileSync(path.resolve('.artifacts/short-input-suggestion.png'), await page.screenshot());
    await page.key('1', 1);
    await waitFor(page, `${status} === 'Actions 1 / 1'`);
    await page.key('Enter');
    await waitFor(page, `document.activeElement === document.getElementById('minimum')`);
  } finally {
    await page.close();
  }
}
