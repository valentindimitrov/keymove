import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor } from './browser-driver.ts';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const summary = `${shadow}?.querySelector('[role="status"]')?.textContent`;

export async function checkActionFallback(client: ChromiumClient, origin: string) {
  const page = await openPage(client, `${origin}action-fallback.html`);
  try {
    await page.activate();
    await waitFor(page, `${shadow}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`);
    await page.key('f', 1);
    for (const character of 'recher') await page.key(character);
    await waitFor(page, `${summary} === 'Actions 1 / 1'`);
    writeFileSync(
      path.resolve(import.meta.dirname, '../.artifacts/action-fallback.png'),
      await page.screenshot(),
    );
    await page.key('Tab');
    await page.key('Tab', 8);
    await page.key('Backspace');
    await waitFor(page, `${summary} === 'Text 1 / 1'`);
    assert.equal(await page.evaluate(`${input}.value`), 'reche');

    await page.key('r');
    await waitFor(page, `${summary} === 'Actions 1 / 1'`);
    await page.key('ArrowDown');
    await waitFor(page, `${shadow}.querySelector('[role="menu"]') !== null`);
    await page.key('Tab');
    await page.key('Backspace');
    await waitFor(page, `${summary} === 'Text 1 / 1'`);

    await page.key('r');
    await waitFor(page, `${summary} === 'Actions 1 / 1'`);
    await page.key('Enter');
    await waitFor(page, `document.activeElement.id === 'fallback-action'`);

    // A deliberate action-mode choice must survive the same Backspace transition.
    await page.key('f', 1);
    for (const character of 'recher') await page.key(character);
    await waitFor(page, `${summary} === 'Actions 1 / 1'`);
    await page.key('s', 1);
    await page.key('Backspace');
    await waitFor(page, `${summary} === 'Actions 1 / 1' && ${input}.value === 'reche'`);
  } finally {
    await page.close();
  }
}
