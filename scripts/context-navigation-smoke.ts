import assert from 'node:assert/strict';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor } from './browser-driver.ts';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const status = `${shadow}?.querySelector('[role="status"]')?.textContent`;
const automaticCapture = `${shadow}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`;
// Pending searches retain visible rows, but their shortcuts are deliberately disabled.
const enabledOptions = `${shadow}.querySelectorAll('[role="option"][aria-disabled="false"]')`;

export async function checkContextNavigation(client: ChromiumClient, origin: string) {
  const first = await openPage(client, `${origin}fixtures.html?context=first`);
  let second: Awaited<ReturnType<typeof openPage>> | undefined;
  try {
    await first.activate();
    await waitFor(first, `document.documentElement?.dataset.fixtureReady && ${input}`);
    await waitFor(first, automaticCapture);
    await waitFor(first, 'document.hasFocus()');
    await first.key('c');
    await waitFor(first, `${input}.value === 'c'`);
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
    for (const key of 'ontexttarget') await first.key(key);
    await waitFor(first, `${status} === 'Text 1 / 1'`);
    await waitFor(first, `${enabledOptions}.length === 1`);
    await first.key('1', 1);
    await waitFor(
      first,
      `(() => {
      const rect = document.getElementById('context-match').getBoundingClientRect();
      return rect.top > innerHeight * 0.2 && rect.bottom < innerHeight * 0.75;
    })()`,
    );

    await first.key('Escape');
    for (const key of 'qxy') await first.key(key);
    await waitFor(first, `${status} === 'Text 1 / 2'`);
    await waitFor(first, `${enabledOptions}.length === 2`);
    await first.key('2', 1);
    await waitFor(first, `${status} === 'Text 2 / 2'`);
    const suggestions = await first.evaluate(
      `${shadow}.querySelector('[role="listbox"]').textContent`,
    );
    second = await openPage(client, `${origin}fixtures.html?context=second`);
    await second.activate();
    await waitFor(second, `document.documentElement?.dataset.fixtureReady && ${input}`);
    await waitFor(second, automaticCapture);
    await waitFor(second, 'document.hasFocus()');
    await second.key('q');
    await waitFor(second, `${input}.value === 'q'`);
    await second.evaluate(`${input}.focus()`);
    for (const key of 'xyz') await second.key(key);
    await waitFor(second, `${status} === 'Text 1 / 1'`);
    await first.activate();
    await waitFor(first, `document.hasFocus()`);
    assert.equal(await first.evaluate(`${input}.value`), 'qxy');
    assert.equal(await first.evaluate(status), 'Text 2 / 2');
    assert.equal(
      await first.evaluate(`${shadow}.querySelector('[role="listbox"]').textContent`),
      suggestions,
    );
    await second.activate();
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
