import assert from 'node:assert/strict';
import type { BrowserContext } from '@playwright/test';
import { openPage, waitFor } from '../pages.js';
import { expect } from '@playwright/test';
import { keymove } from '../keymove.js';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const status = `${shadow}?.querySelector('[role="status"]')?.textContent`;
const automaticCapture = `${shadow}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`;
// Pending searches retain visible rows, but their shortcuts are deliberately disabled.
const enabledOptions = `${shadow}.querySelectorAll('[role="option"][aria-disabled="false"]')`;

export async function checkContextNavigation(context: BrowserContext, origin: string) {
  const first = await openPage(context, `${origin}fixtures.html?context=first`);
  let second: Awaited<ReturnType<typeof openPage>> | undefined;
  try {
    await first.bringToFront();
    await waitFor(first, `document.documentElement?.dataset.fixtureReady && ${input}`);
    await waitFor(first, automaticCapture);
    await waitFor(first, 'document.hasFocus()');
    await first.keyboard.press('c');
    await expect(keymove(first).input).toHaveValue('c');
    await first.evaluate(`(() => {
      const spacer = document.createElement('div');
      spacer.style.height = '2000px';
      const match = document.createElement('p');
      match.id = 'context-match'; match.textContent = 'Contexttarget heading';
      const below = document.createElement('p');
      below.textContent = 'Details below the selected heading'; below.style.height = '800px';
      document.body.append(spacer, match, below);
      ${input}.focus();
    })()`);
    for (const key of 'ontexttarget') await first.keyboard.type(key);
    await expect(keymove(first).status).toHaveText('Text 1 / 1');
    await waitFor(first, `${enabledOptions}.length === 1`);
    await first.keyboard.press('Alt+1');
    await waitFor(
      first,
      `(() => {
      const rect = document.getElementById('context-match').getBoundingClientRect();
      return rect.top > innerHeight * 0.2 && rect.bottom < innerHeight * 0.75;
    })()`,
    );

    await first.keyboard.press('Escape');
    for (const key of 'qxy') await first.keyboard.type(key);
    await expect(keymove(first).status).toHaveText('Text 1 / 2');
    await waitFor(first, `${enabledOptions}.length === 2`);
    await first.keyboard.press('Alt+2');
    await expect(keymove(first).status).toHaveText('Text 2 / 2');
    const suggestions = await first.evaluate(
      `${shadow}.querySelector('[role="listbox"]').textContent`,
    );
    second = await openPage(context, `${origin}fixtures.html?context=second`);
    await second.bringToFront();
    await waitFor(second, `document.documentElement?.dataset.fixtureReady && ${input}`);
    await waitFor(second, automaticCapture);
    await waitFor(second, 'document.hasFocus()');
    await second.keyboard.press('q');
    await expect(keymove(second).input).toHaveValue('q');
    await second.evaluate(`${input}.focus()`);
    for (const key of 'xyz') await second.keyboard.type(key);
    await expect(keymove(second).status).toHaveText('Text 1 / 1');
    await first.bringToFront();
    await waitFor(first, `document.hasFocus()`);
    assert.equal(await first.evaluate(`${input}.value`), 'qxy');
    assert.equal(await first.evaluate(status), 'Text 2 / 2');
    assert.equal(
      await first.evaluate(`${shadow}.querySelector('[role="listbox"]').textContent`),
      suggestions,
    );
    await second.bringToFront();
    await waitFor(second, `document.hasFocus()`);
    assert.equal(await second.evaluate(`${input}.value`), 'qxyz');
    assert.equal(await second.evaluate(status), 'Text 1 / 1');
  } catch (error) {
    console.log(
      'Context navigation diagnostic',
      await first.evaluate(`({
      scrollY, height: innerHeight,
      rect: document.getElementById('context-match')?.getBoundingClientRect().toJSON(),
      selected: getSelection().toString(),
      row: ${shadow}.querySelector('[role="option"]')?.outerHTML,
    })`),
    );
    throw error;
  } finally {
    await second?.close();
    await first.close();
  }
}
