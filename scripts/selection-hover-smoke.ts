import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor } from './browser-driver.ts';
import type { TestPage } from './browser-driver.ts';

const root = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${root}.querySelector('[aria-label="Search page"]')`;
const status = `${root}.querySelector('[role="status"]').textContent`;
const modifier = process.platform === 'darwin' ? 4 : 2;
async function search(page: TestPage, text: string, mode = 'Actions') {
  await page.activate();
  await waitFor(page, 'document.hasFocus()');
  await page.key('f', 1);
  await waitFor(page, `${root}.activeElement === ${input}`);
  await page.key('a', modifier);
  await page.key('Backspace');
  for (const char of text) await page.key(char);
  await waitFor(
    page,
    `${root}.querySelector('[role="listbox"]')?.getAttribute('aria-busy') === 'false'`,
  );
  if (!((await page.evaluate(status)) as string).startsWith(mode)) await page.key('s', 1);
  await waitFor(page, `${status} === '${mode} 1 / 1'`);
}

export async function checkSelectionHover(client: ChromiumClient, origin: string) {
  const page = await openPage(client, `${origin}hover.html`);
  try {
    await page.activate();
    await waitFor(
      page,
      `document.documentElement.dataset.fixtureReady && ${root}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`,
    );
    await search(page, 'hommes');
    assert.equal(await page.evaluate(`document.getElementById('submenu').hidden`), true);
    await page.key('1', 1);
    await waitFor(page, `!document.getElementById('submenu').hidden`);
    assert.equal(await page.evaluate(`document.documentElement.dataset.clicked ?? null`), null);
    assert.equal(await page.evaluate(`${root}.activeElement === ${input}`), true);
    await search(page, 'sneakers');
    await page.key('Tab');
    assert.equal(await page.evaluate(`document.getElementById('submenu').hidden`), false);
    writeFileSync(path.resolve('.artifacts/selection-hover.png'), await page.screenshot());
    await page.key('Enter');
    await waitFor(page, `document.documentElement.dataset.clicked === 'sneakers'`);
    await waitFor(page, `document.getElementById('submenu').hidden`);
    await search(page, 'hommes');
    await page.key('Tab');
    await waitFor(page, `!document.getElementById('submenu').hidden`);
    await search(page, 'outside menu');
    assert.equal(await page.evaluate(`document.getElementById('submenu').hidden`), false);
    await page.key('Tab');
    await waitFor(page, `document.getElementById('submenu').hidden`);
    await search(page, 'collections');
    await page.key('Tab');
    const panel = `document.getElementById('component').shadowRoot.querySelector('p')`;
    await waitFor(page, `!${panel}.hidden`);
    await search(page, 'velvet footwear', 'Text');
    await page.key('Tab');
    assert.equal(await page.evaluate(`${panel}.hidden`), false);
    await page.key('Escape');
    await waitFor(page, `${panel}.hidden`);
    await search(page, 'hommes');
    await page.key('Tab');
    await waitFor(page, `!document.getElementById('submenu').hidden`);
    const point = await page.evaluate(`(() => {
      const rect = document.getElementById('sneakers').getBoundingClientRect();
      return [rect.left + rect.width / 2, rect.top + rect.height / 2];
    })()`);
    assert(Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number');
    await page.movePointer(point[0], point[1]);
    assert.equal(await page.evaluate(`document.getElementById('submenu').hidden`), false);
    await page.key('Escape');
    // The physical pointer now owns the menu; ending keyboard hover must not close it.
    assert.equal(await page.evaluate(`document.getElementById('submenu').hidden`), false);
    await page.movePointer(1, 1);
    await waitFor(page, `document.getElementById('submenu').hidden`);
  } finally {
    await page.close();
  }
}
