import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { openPage, waitFor } from '../pages.js';

const root = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${root}?.querySelector('[aria-label="Search page"]')`;
const status = `${root}?.querySelector('[role="status"]')?.textContent`;
const outlines = `${root}.querySelectorAll('.keymove-selection')`;
const marks = `CSS.highlights.has('keymove-search-results')`;

export async function checkHighlightDensity(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}highlights.html`);
  try {
    await page.bringToFront();
    await waitFor(
      page,
      `document.hasFocus() && ${root}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`,
    );
    await page.keyboard.press('Alt+f');
    await waitFor(page, `${root}.activeElement === ${input}`);
    await page.keyboard.press('s');
    await waitFor(page, `${status}?.startsWith('Text 1 /')`);
    await page.keyboard.press('Alt+s');
    await waitFor(page, `${status} === 'Actions 1 / 12'`);
    for (let index = 1; index <= 12; index++) {
      await waitFor(page, `${status} === 'Actions ${index} / 12'`);
      assert.equal(await page.evaluate(`${outlines}.length`), 1);
      assert.equal(await page.evaluate(marks), false);
      await page.keyboard.press('Tab');
    }
    await waitFor(page, `${status} === 'Actions 1 / 12'`);
    writeFileSync(path.resolve('.artifacts/highlights-short.png'), await page.screenshot());
    await page.keyboard.press('n');
    await waitFor(page, `${input}.value === 'sn' && ${status} === 'Actions 1 / 12'`);
    assert.equal(await page.evaluate(marks), false);
    await page.keyboard.press('e');
    await waitFor(page, `${input}.value === 'sne' && ${status} === 'Actions 1 / 12' && ${marks}`);
    assert.equal(await page.evaluate(`${outlines}.length`), 12);
    assert.equal(
      await page.evaluate(`${root}.querySelectorAll('.keymove-selected-selection').length`),
      1,
    );
    assert.equal(await page.evaluate(`CSS.highlights.get('keymove-search-results').size`), 12);
    writeFileSync(path.resolve('.artifacts/highlights-long.png'), await page.screenshot());
    await page.keyboard.press('Alt+s');
    await waitFor(page, `${status} === 'Text 1 / 12'`);
    assert.equal(await page.evaluate(`${outlines}.length`), 12);
    assert.equal(
      await page.evaluate(`${root}.querySelectorAll('.keymove-selected-selection').length`),
      1,
    );
    writeFileSync(path.resolve('.artifacts/highlights-long-text.png'), await page.screenshot());
    await page.keyboard.press('Backspace');
    await waitFor(page, `${input}.value === 'sn' && !${marks}`);
    await waitFor(page, `${status} === 'Text 1 / 12'`);
    assert.equal(await page.evaluate(`${outlines}.length`), 1);
    assert.equal(await page.evaluate('getSelection().toString()'), 'Sneakers classic');
    await page.keyboard.press('Tab');
    await waitFor(page, `${status} === 'Text 2 / 12'`);
    assert.equal(await page.evaluate('getSelection().toString()'), 'Sneakers canvas');
    await page.keyboard.press('Escape');
    await waitFor(page, `${outlines}.length === 0 && !${marks}`);
    await page.keyboard.press('Alt+f');
    await waitFor(page, `${root}.activeElement === ${input}`);
    await page.keyboard.press('4');
    await waitFor(page, `${root}.querySelectorAll('[role="option"]').length === 2`);
    await page.keyboard.press('0');
    await waitFor(page, `${input}.value === '40' && ${status} === 'Text 1 / 1'`);
    await waitFor(
      page,
      `${root}.querySelector('[role="option"]')?.textContent.includes('Minimum (EUR) — 40')`,
    );
    assert.equal(await page.evaluate(`${outlines}.length`), 1);
    assert.equal(await page.evaluate(marks), false);
    writeFileSync(path.resolve('.artifacts/short-input-suggestion.png'), await page.screenshot());
    await page.keyboard.press('Alt+1');
    await waitFor(page, `${status} === 'Actions 1 / 1'`);
    await page.keyboard.press('Enter');
    await waitFor(page, `document.activeElement === document.getElementById('minimum')`);
  } finally {
    await page.close();
  }
}
