import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { openPage, waitFor } from '../pages.js';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const summary = `${shadow}?.querySelector('[role="status"]')?.textContent`;

export async function checkActionFallback(context: BrowserContext, origin: string) {
  const page = await openPage(context, `${origin}action-fallback.html`);
  try {
    await page.bringToFront();
    await waitFor(page, `${shadow}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`);
    await page.keyboard.press('Alt+f');
    for (const character of 'recher') await page.keyboard.type(character);
    await waitFor(page, `${summary} === 'Actions 1 / 1'`);
    writeFileSync(
      path.resolve(import.meta.dirname, '../../../.artifacts/action-fallback.png'),
      await page.screenshot(),
    );
    for (const character of 'zzzzzz') await page.keyboard.type(character);
    await waitFor(
      page,
      `${summary}?.endsWith('0 / 0') && !${shadow}.querySelector('[role="listbox"]')`,
    );
    assert.equal(await page.evaluate(`${input}.getAttribute('aria-expanded')`), 'false');
    assert.equal(await page.evaluate(`${shadow}.activeElement === ${input}`), true);
    writeFileSync(
      path.resolve(import.meta.dirname, '../../../.artifacts/action-fallback-empty.png'),
      await page.screenshot(),
    );
    for (let index = 0; index < 6; index++) await page.keyboard.press('Backspace');
    await waitFor(
      page,
      `${summary} === 'Actions 1 / 1' && ${shadow}.querySelector('[role="listbox"]') !== null`,
    );
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Backspace');
    await waitFor(page, `${summary} === 'Text 1 / 1'`);
    assert.equal(await page.evaluate(`${input}.value`), 'reche');

    await page.keyboard.press('r');
    await waitFor(page, `${summary} === 'Actions 1 / 1'`);
    await page.keyboard.press('ArrowDown');
    await waitFor(page, `${shadow}.querySelector('[role="menu"]') !== null`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Backspace');
    await waitFor(page, `${summary} === 'Text 1 / 1'`);

    await page.keyboard.press('r');
    await waitFor(page, `${summary} === 'Actions 1 / 1'`);
    await page.keyboard.press('Enter');
    await waitFor(page, `document.activeElement.id === 'fallback-action'`);

    // A deliberate action-mode choice must survive the same Backspace transition.
    await page.keyboard.press('Alt+f');
    for (const character of 'recher') await page.keyboard.type(character);
    await waitFor(page, `${summary} === 'Actions 1 / 1'`);
    await page.keyboard.press('Alt+s');
    await page.keyboard.press('Backspace');
    await waitFor(page, `${summary} === 'Actions 1 / 1' && ${input}.value === 'reche'`);
  } finally {
    await page.close();
  }
}
