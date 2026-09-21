import assert from 'node:assert/strict';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor } from './browser-driver.ts';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const status = `${shadow}?.querySelector('[role="status"]')?.textContent`;

export async function checkDynamicPage(client: ChromiumClient, origin: string) {
  const page = await openPage(client, `${origin}fixtures.html?size=large&dynamic`);
  try {
    await page.activate();
    await waitFor(page, `document.documentElement?.dataset.fixtureReady && ${input}`);
    await waitFor(page, `${shadow}.querySelector('#keymove-bar').dataset.alwaysOn === 'true'`);
    await waitFor(page, 'document.hasFocus()');
    await page.evaluate(`(() => {
      globalThis.__dynamicChanges = 0;
      globalThis.__dynamicTiming = null;
      const changing = document.getElementById('dynamic');
      globalThis.__dynamicTimer = setInterval(() => {
        changing.style.opacity = (++globalThis.__dynamicChanges % 2) ? '0.9' : '1';
      }, 16);
      let started;
      window.addEventListener('keydown', () => { started = performance.now(); }, {capture:true, once:true});
      const observer = new MutationObserver(() => {
        if (started !== undefined && ${status} === 'Text 1 / 4') {
          globalThis.__dynamicTiming = performance.now() - started;
          observer.disconnect();
        }
      });
      observer.observe(${shadow}, {subtree:true, childList:true, characterData:true});
    })()`);
    await page.key('q');
    await waitFor(page, `typeof globalThis.__dynamicTiming === 'number'`);
    const searchMs = await page.evaluate('globalThis.__dynamicTiming');
    assert.equal(typeof searchMs, 'number');
    // Keep the animation running through subsequent keystrokes and selection changes.
    for (const character of 'xyz') await page.key(character);
    await waitFor(page, `${status} === 'Text 1 / 1'`);
    await waitFor(page, `globalThis.__dynamicChanges >= 5`);
    await page.key('Tab');
    await waitFor(page, `getSelection().toString().includes('semantic block')`);
    await page.key('ArrowDown');
    await waitFor(page, `${shadow}.querySelector('[role="menu"]')`);
    const changes = await page.evaluate('globalThis.__dynamicChanges');
    assert.equal(typeof changes, 'number');
    await waitFor(page, `globalThis.__dynamicChanges >= ${Number(changes) + 12}`);
    assert.equal(
      await page.evaluate(`Boolean(${shadow}.querySelector('[role="menu"]'))`),
      true,
      'Page animation must not dismiss the action menu',
    );
    assert.equal(await page.evaluate(`${shadow}.activeElement?.getAttribute('role')`), 'menuitem');
    await page.key('Escape');
    await waitFor(page, `${shadow}.activeElement === ${input}`);
    await page.evaluate(`(() => {
      globalThis.__pageClicks = 0;
      globalThis.__pageClickErrors = 0;
      addEventListener('error', () => { globalThis.__pageClickErrors++; });
      document.onclick = event => {
        globalThis.__pageClicks++;
        // Same shallow-target failure as the Elgato tracking handler.
        event.target.parentNode.parentNode.parentNode.parentNode.className;
      };
      ${input}.click();
    })()`);
    assert.equal(await page.evaluate('globalThis.__pageClicks'), 0);
    assert.equal(await page.evaluate('globalThis.__pageClickErrors'), 0);
    // Page controls still reach their own handlers and the document listener.
    await page.evaluate(`document.querySelector('button[aria-label="apricot"]').click()`);
    assert.equal(await page.evaluate('globalThis.__pageClicks'), 1);
    assert.equal(await page.evaluate('globalThis.__pageClickErrors'), 0);
    return { searchMs };
  } finally {
    await page.close();
  }
}
