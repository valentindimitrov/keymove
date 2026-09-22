import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor } from './browser-driver.ts';
import type { TestPage } from './browser-driver.ts';

const root = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${root}?.querySelector('[aria-label="Search page"]')`;
const status = `${root}?.querySelector('[role="status"]')?.textContent`;
async function firstAction(page: TestPage) {
  await waitFor(page, `/^Actions [1-3] \\/ 3$/.test(${status})`);
  const current = Number(String(await page.evaluate(status)).match(/^Actions (\d+)/)?.[1]);
  for (let position = current; position > 1; position--) await page.key('Tab', 8);
  await waitFor(page, `${status} === 'Actions 1 / 3'`);
}
export async function checkIframes(client: ChromiumClient, origin: string) {
  const page = await openPage(client, `${origin}frames.html`);
  try {
    await page.activate();
    await waitFor(
      page,
      `${root}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true' && document.querySelector('iframe').contentDocument?.getElementById('price')`,
    );
    await page.key('f', 1);
    await waitFor(page, `${root}.activeElement === ${input}`);
    for (const key of '40') await page.key(key);
    await page.key('s', 1);
    await firstAction(page);
    const labels = await page.evaluate(`${root}.querySelector('[role="listbox"]').textContent`);
    assert(String(labels).includes('Minimum (EUR) — 40'));
    writeFileSync(path.resolve('.artifacts/iframe-search.png'), await page.screenshot());
    await page.key('Enter');
    await waitFor(
      page,
      `document.querySelector('iframe').contentDocument.activeElement?.id === 'price'`,
    );
    // From inside the embedded editor, the opening shortcut returns to the one top bar.
    await page.key('f', 1);
    await waitFor(page, `${root}.activeElement === ${input}`);
    for (const key of '40') await page.key(key);
    await page.key('s', 1);
    await firstAction(page);
    await page.key('Tab');
    await page.key('Enter');
    await waitFor(page, `document.activeElement?.id === 'cross'`);
    await page.key('f', 1);
    await waitFor(page, `${root}.activeElement === ${input}`);
    for (const key of 'otter') await page.key(key);
    await waitFor(page, `${status}?.endsWith('/ 4')`);
    await page.key('Tab');
    await waitFor(
      page,
      `document.querySelector('iframe').contentWindow.getSelection().toString() === 'local otter paragraph to copy.'`,
    );
    await waitFor(
      page,
      `document.querySelector('iframe').contentWindow.CSS.highlights.get('keymove-search-results')?.size > 0`,
    );
    await page.key('c', process.platform === 'darwin' ? 4 : 2);
    await page.evaluate(
      `(() => { const target = document.createElement('textarea'); target.id = 'paste'; document.body.append(target); target.focus(); })()`,
    );
    await page.key('v', process.platform === 'darwin' ? 4 : 2);
    await waitFor(
      page,
      `document.getElementById('paste').value === 'local otter paragraph to copy.'`,
    );
    await page.key('f', 1);
    await waitFor(page, `${root}.activeElement === ${input}`);
    for (const key of 'otter') await page.key(key);
    await waitFor(page, `${status}?.endsWith('/ 4')`);
    await page.evaluate(`document.getElementById('paste').remove()`);
    await waitFor(page, `${status}?.endsWith('/ 4')`);
    // Hiding the outer cross-origin frame removes it and its nested frame, not the local one.
    await page.evaluate(`document.getElementById('cross').hidden = true`);
    await waitFor(page, `${status}?.endsWith('/ 2')`);
    await page.evaluate(`document.getElementById('cross').hidden = false`);
    await waitFor(page, `${status}?.endsWith('/ 4')`);
    await page.evaluate(`document.getElementById('cross').src += '&reload=1'`);
    await waitFor(
      page,
      `${status}?.endsWith('/ 4') && ${root}.querySelector('[role="listbox"]')?.getAttribute('aria-busy') === 'false'`,
    );
    assert.equal(
      await page.evaluate(
        `document.querySelector('iframe').contentDocument.querySelector('[aria-label="Search page"]')`,
      ),
      null,
    );
    await page.key('Escape');
    await waitFor(
      page,
      `!document.querySelector('iframe').contentDocument.getElementById('keymove-root')`,
    );
  } finally {
    await page.close();
  }
}

export async function measureIframes(client: ChromiumClient, origin: string) {
  const samples: { frames: number; firstLocalMs: number; allFramesMs: number }[] = [];
  for (const count of [0, 3, 20]) {
    const page = await openPage(client, `${origin}frames.html?frames=${count}`);
    try {
      await page.activate();
      await waitFor(
        page,
        `document.documentElement.dataset.fixtureReady && ${root}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`,
      );
      await page.key('f', 1);
      await waitFor(page, `${root}.activeElement === ${input}`);
      await page.evaluate(`(() => {
        globalThis.__iframeTimes = { firstLocalMs: null, allFramesMs: null };
        let start;
        window.addEventListener('keydown', () => { start = performance.now(); }, { once: true, capture: true });
        const observer = new MutationObserver(() => {
          if (!start || ${input}.value !== '4') return;
          if (${status}?.startsWith('Text 1 /') && globalThis.__iframeTimes.firstLocalMs === null) globalThis.__iframeTimes.firstLocalMs = performance.now() - start;
          if (${status} === 'Text 1 / ${count + 1}') { globalThis.__iframeTimes.allFramesMs = performance.now() - start; observer.disconnect(); }
        });
        observer.observe(${root}, { subtree: true, childList: true, characterData: true });
      })()`);
      await page.key('4');
      await waitFor(page, `globalThis.__iframeTimes.allFramesMs !== null`);
      const value = (await page.evaluate('globalThis.__iframeTimes')) as {
        firstLocalMs: number;
        allFramesMs: number;
      };
      samples.push({ frames: count, ...value });
    } finally {
      await page.close();
    }
  }
  writeFileSync(
    path.resolve('.artifacts/iframe-performance.json'),
    JSON.stringify(samples, null, 2),
  );
  console.log('Iframe timing samples', samples);
}
