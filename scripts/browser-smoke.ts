import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import type { ChromiumClient } from 'web-ext';
import { boundedClient, openPage, waitFor } from './browser-driver.ts';
import type { TestPage } from './browser-driver.ts';
import { checkContextNavigation } from './context-navigation-smoke.ts';
import { checkRenderedText } from './rendered-text-smoke.ts';
import { checkReturnPosition } from './return-position-smoke.ts';
import { checkControlNavigation } from './control-navigation-smoke.ts';
import { checkActionMenu } from './action-menu-smoke.ts';
import { checkTooltipsMode } from './tooltips-mode-smoke.ts';
import { checkDynamicPage } from './dynamic-page-smoke.ts';
import { checkShadowSearch } from './shadow-search-smoke.ts';
import { checkActionFallback } from './action-fallback-smoke.ts';
import { checkTheme, checkThemePreviews } from './theme-smoke.ts';
import { settingsTab, setActivation, checkSiteSettings } from './settings-smoke.ts';

const shadow = `document.getElementById('keymove-root')?.shadowRoot`;
const input = `${shadow}?.querySelector('[aria-label="Search page"]')`;
const summary = `${shadow}?.querySelector('[role="status"]')?.textContent`;
const modifier = process.platform === 'darwin' ? 4 : 2;

async function type(page: TestPage, value: string) {
  for (const character of value) await page.key(character);
}

async function clear(page: TestPage) {
  await page.key('Backspace', modifier);
  await waitFor(page, `${input}?.value === ''`);
}

async function expectSummary(page: TestPage, expected: string) {
  await waitFor(page, `${summary} === ${JSON.stringify(expected)}`);
}

// Measure keydown to committed result text in the browser, excluding protocol
// round trips. Different counts for each prefix prevent stale results from passing.
async function timedCharacter(
  page: TestPage,
  character: string,
  expected: string,
): Promise<number> {
  await page.evaluate(`(() => {
    globalThis.__keymoveTiming = null;
    const root = ${shadow};
    let started = null;
    const start = () => { started = performance.now(); };
    // Start before the extension's document-capture handler can render results.
    window.addEventListener('keydown', start, { capture: true, once: true });
    const observer = new MutationObserver(() => {
      if (started !== null && ${summary} === ${JSON.stringify(expected)}) {
        globalThis.__keymoveTiming = performance.now() - started;
        observer.disconnect();
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    setTimeout(() => { observer.disconnect(); window.removeEventListener('keydown', start, true); }, 10000);
  })()`);
  await page.key(character);
  await waitFor(page, `typeof globalThis.__keymoveTiming === 'number'`);
  const duration = await page.evaluate('globalThis.__keymoveTiming');
  assert.equal(typeof duration, 'number');
  return duration as number;
}

export async function runBrowserSmoke(client: ChromiumClient, browser: string): Promise<void> {
  client = boundedClient(client);
  const root = path.resolve(import.meta.dirname, '..');
  const server = await createServer({
    configFile: path.join(root, 'preview/vite.config.ts'),
    server: { host: '127.0.0.1', port: 0, open: false },
  });
  const measurements: { size: string; coldMs: number; warmMs: number[] }[] = [];
  let dynamicPage: Awaited<ReturnType<typeof checkDynamicPage>> | null = null;
  const passed: string[] = [];
  let failure: string | null = null;
  const output = path.join(root, '.artifacts');
  mkdirSync(output, { recursive: true });
  try {
    await server.listen();
    const origin = server.resolvedUrls?.local[0];
    assert(origin, 'Fixture server did not expose its address');
    await checkActionFallback(client, origin);
    passed.push(
      'Temporary text-to-action fallback, Tab/menu navigation, Backspace restoration and Enter focus',
    );
    await checkShadowSearch(client, origin);
    passed.push(
      'Open/nested Shadow DOM, slots, highlight ranges, native selection/copy, editing, activation, mutations and modal scoping',
    );
    dynamicPage = await checkDynamicPage(client, origin);
    console.log('Dynamic-page search timing', dynamicPage);
    passed.push(
      'Search completes through continuous DOM changes; interface clicks stay isolated and page clicks work',
    );
    await checkThemePreviews(client, origin);
    passed.push(
      'Light/dark shadow-root previews: narrow and desktop layouts, shared settings columns, and above/below suggestions',
    );
    await checkActionMenu(client, origin);
    passed.push(
      'Down action menu, arrow navigation, Escape/Tab return, copy/paste, activation, focus-only and real shadow-root preview layouts',
    );
    await checkControlNavigation(client, origin);
    passed.push(
      'Linked labels, checkbox/radio/submit/disclosure activation, editor focus, disabled actions, native and ARIA modal scoping and restoration; transformed drawers retain layout and viewport-aligned overlays',
    );
    await checkRenderedText(client, origin);
    passed.push(
      'Rendered whitespace, line breaks and preformatted text: search, highlights and real copy/paste agree',
    );
    await checkContextNavigation(client, origin);
    passed.push(
      'Off-screen matches leave context below; switching tabs preserves independent queries and selections',
    );
    for (const size of ['small', 'large']) {
      console.log(`Checking ${size} fixture at ${origin}`);
      const page = await openPage(client, `${origin}fixtures.html?size=${size}`);
      await page.activate();
      await waitFor(page, `document.documentElement?.dataset.fixtureReady && ${input}`);
      // Mounting precedes storage hydration. The startup regression tests cover the
      // deliberate no-capture interval; these checks exercise the enabled behavior.
      await waitFor(page, `${shadow}?.querySelector('#keymove-bar')?.dataset.alwaysOn === 'true'`);
      console.log(`${size}: extension mounted; checking typing and latency`);
      await waitFor(page, 'document.hasFocus()');
      assert.equal(
        await page.evaluate(`${input}.getClientRects().length`),
        0,
        'Autohide is on in a fresh profile',
      );
      const coldMs = await timedCharacter(page, 'q', 'Text 1 / 4');
      await page.key('Tab');
      await expectSummary(page, 'Text 2 / 4');
      await page.key('Tab', 8); // Shift+Tab
      await expectSummary(page, 'Text 1 / 4');
      const warmMs: number[] = [];
      for (let repeat = 0; repeat < 3; repeat++) {
        if (repeat > 0) {
          // Retain the live index: return to q without ending the search.
          for (let index = 0; index < 3; index++) await page.key('Backspace');
          await expectSummary(page, 'Text 1 / 4');
        }
        for (const [character, count] of [
          ['x', 3],
          ['y', 2],
          ['z', 1],
        ] as const) {
          warmMs.push(await timedCharacter(page, character, `Text 1 / ${count}`));
        }
      }
      measurements.push({ size, coldMs, warmMs });
      assert.equal(
        await page.evaluate(`${input}.value`),
        'qxyz',
        'Every character must be accepted',
      );
      passed.push(
        `${size}: real typing, distinct prefix counts, hidden text excluded, automatic first selection, forward/backward Tab`,
      );
      await page.evaluate(`(() => {
        const root = ${shadow};
        const panel = root.getElementById('keymove-suggestions');
        const bar = root.getElementById('keymove-bar');
        const top = bar.getBoundingClientRect().top;
        const height = panel.getBoundingClientRect().height;
        const check = globalThis.__keymovePanelCheck = { removed: false, shifted: false, collapsed: false };
        const observer = new MutationObserver(records => {
          if (records.some(record => Array.from(record.removedNodes).some(node => node === panel || node.contains(panel)))) check.removed = true;
          if (panel.getAttribute('aria-busy') === 'true' && Math.abs(bar.getBoundingClientRect().top - top) > 1) check.shifted = true;
          if (panel.getBoundingClientRect().height < height - 1) check.collapsed = true;
        });
        observer.observe(root, { subtree: true, childList: true, attributes: true });
        globalThis.__keymoveStopPanelCheck = () => {
          observer.disconnect();
          return { ...check, samePanel: root.getElementById('keymove-suggestions') === panel };
        };
      })()`);
      await page.key('Backspace');
      await expectSummary(page, 'Text 1 / 2');
      await page.key('z');
      await expectSummary(page, 'Text 1 / 1');
      await type(page, 'zzzz');
      await expectSummary(page, 'Text ~ 0 / 0');
      await waitFor(
        page,
        `${shadow}.querySelector('.keymove-suggestions-empty')?.textContent === 'No matches'`,
      );
      for (let index = 0; index < 4; index++) await page.key('Backspace');
      await expectSummary(page, 'Text 1 / 1');
      assert.deepEqual(await page.evaluate('globalThis.__keymoveStopPanelCheck()'), {
        removed: false,
        shifted: false,
        collapsed: false,
        samePanel: true,
      });
      passed.push(
        `${size}: suggestion frame stays mounted without shrinking through typing, deletion and empty results`,
      );
      if (size === 'large') continue;

      await page.key('Tab');
      await expectSummary(page, 'Text 1 / 1');
      const wholeBlock = await page.evaluate(`document.getElementById('copy-block').textContent`);
      assert.equal(await page.evaluate('getSelection().toString()'), wholeBlock);
      await page.key('c', modifier);
      await page.key('d');
      await waitFor(page, `${input}.value === 'qxyzd'`);
      await expectSummary(page, 'Text 1 / 1');
      await page.evaluate(`document.querySelector('textarea').focus()`);
      await page.key('v', modifier);
      await waitFor(
        page,
        `document.querySelector('textarea').value === ${JSON.stringify(wholeBlock)}`,
      );
      // Exclude the paste target from subsequent query counts.
      await page.evaluate(`document.querySelector('textarea').value = ''`);
      await page.key('f', 1);
      passed.push(
        'Tab selects whole semantic block; native copy/paste; editing resumes after selection',
      );

      await clear(page);
      await type(page, 'mango');
      await expectSummary(page, 'Text ~ 0 / 0');
      await page.evaluate(
        `document.getElementById('dynamic').innerHTML = '<p>mango added later</p>'`,
      );
      await expectSummary(page, 'Text 0 / 1');
      await page.evaluate(`document.getElementById('dynamic').replaceChildren()`);
      await expectSummary(page, 'Text ~ 0 / 0');
      passed.push('DOM insertion and removal refresh the active query');

      await clear(page);
      await page.evaluate(`document.getElementById('dynamic').innerHTML =
        '<p>unsaved drafts</p>'.repeat(60) + '<p>Save</p>'`);
      await type(page, 'save');
      await expectSummary(page, 'Text 1 / 61');
      await page.key('Tab', 8);
      await expectSummary(page, 'Text 61 / 61');
      await page.key('Tab');
      await expectSummary(page, 'Text 1 / 61');
      await page.key('1', 1);
      await expectSummary(page, 'Text 61 / 61');
      assert.equal(await page.evaluate('getSelection().toString()'), 'Save');
      await page.evaluate(`document.getElementById('dynamic').replaceChildren()`);
      passed.push('All 61 results are navigable; Alt+1 selects the strongest late-page text match');

      await clear(page);
      await page.evaluate(`document.getElementById('dynamic').innerHTML =
        ['alpha', 'beta', 'gamma', 'delta'].map((name, index) =>
          '<p id="stable-' + name + '" style="position:fixed;left:20px;top:' +
          (index === 3 ? '200vh' : (20 + index * 30) + 'px') + '">zest ' + name + '</p>'
        ).join('')`);
      await type(page, 'zes');
      await expectSummary(page, 'Text 1 / 4');
      const thirdLabel = `${shadow}?.querySelectorAll('.keymove-suggestion-label')[2]?.textContent`;
      await waitFor(page, `${thirdLabel} === 'zest gamma'`);
      // The viewport bonus raises delta 10% over gamma, a near tie at the third-place boundary.
      await page.evaluate(`(() => {
        document.getElementById('stable-gamma').style.top = '200vh';
        document.getElementById('stable-delta').style.top = '80px';
        document.getElementById('dynamic').insertAdjacentHTML('beforeend',
          '<p style="position:fixed;top:200vh">zest epsilon</p>');
      })()`);
      await expectSummary(page, 'Text 1 / 5');
      await waitFor(page, `${thirdLabel} === 'zest gamma'`);
      await page.key('t');
      await waitFor(
        page,
        `${shadow}?.querySelector('.keymove-suggestion-label mark')?.textContent === 'zest'`,
      );
      assert.equal(await page.evaluate(thirdLabel), 'zest gamma');
      // Losing the word-prefix boost is a decisive drop and must allow replacement.
      await page.evaluate(`document.getElementById('stable-gamma').textContent = 'azest gamma'`);
      await waitFor(page, `${thirdLabel} === 'zest delta'`);
      await page.key('3', 1);
      await expectSummary(page, 'Text 4 / 5');
      assert.equal(await page.evaluate('getSelection().toString()'), 'zest delta');
      await page.evaluate(`document.getElementById('dynamic').replaceChildren()`);
      passed.push(
        'Third-row membership survives near ties, DOM refresh and typing; decisive wins replace it and Alt+3 follows',
      );

      await clear(page);
      await type(page, 'apricot');
      await expectSummary(page, 'Actions 1 / 1');
      passed.push('Attribute-only matches automatically use the action fallback');

      await clear(page);
      await type(page, 'nectarine');
      await expectSummary(page, 'Text 1 / 1');
      await page.evaluate(`${shadow}.querySelector('.keymove-mode-button').click()`);
      await expectSummary(page, 'Actions 1 / 1');
      await page.evaluate(`${shadow}.querySelector('.keymove-mode-button').click()`);
      await expectSummary(page, 'Text 1 / 1');
      assert.equal(await page.evaluate(`${input}.value`), 'nectarine');
      passed.push('Clicking Text/Actions switches mode without clearing the query');
      await page.key('Tab');
      await page.key('Enter');
      await waitFor(page, `location.hash === '#destination'`);
      passed.push('Enter activates the action nested inside a text block');

      await page.evaluate(`${input}.blur()`);
      await page.key('q');
      await expectSummary(page, 'Text 1 / 4');
      assert.equal(await page.evaluate(`${input}.value`), 'q');
      passed.push('Always-on typing from the host page preserves the first character');

      // Open the actual bundled popup document. This checks its storage writes and
      // cross-context change events; it does not simulate toolbar browser chrome.
      // Opening settings wakes a suspended MV3 worker; its lifetime is not tied to
      // the duration of the browser checks that ran before this point.
      await page.evaluate(`${shadow}.querySelector('.keymove-settings-button').click()`);
      await waitFor(page, '!document.hasFocus()');
      const targets = await client.sendCommand('Target.getTargets', {});
      assert(
        targets &&
          typeof targets === 'object' &&
          'targetInfos' in targets &&
          Array.isArray(targets.targetInfos),
        'Malformed browser targets',
      );
      const worker = targets.targetInfos.find((target: unknown): target is { url: string } =>
        Boolean(
          target &&
          typeof target === 'object' &&
          'type' in target &&
          target.type === 'service_worker' &&
          'url' in target &&
          typeof target.url === 'string' &&
          /^chrome-extension:\/\/[a-p]+\/background\.js$/.test(target.url),
        ),
      );
      assert(worker, 'Installed extension service worker not found');
      const opened = await client.sendCommand('Target.getTargets', {});
      assert(
        opened &&
          typeof opened === 'object' &&
          'targetInfos' in opened &&
          Array.isArray(opened.targetInfos),
      );
      const settingsTarget = opened.targetInfos.find(
        (target: { url?: string }) => target.url === new URL('popup.html', worker.url).href,
      );
      assert(
        settingsTarget && typeof settingsTarget.targetId === 'string',
        'Logo did not open the extension settings',
      );
      await client.sendCommand('Target.closeTarget', { targetId: settingsTarget.targetId });
      passed.push('The color K logo opens the actual extension settings');
      const popup = await openPage(client, new URL('popup.html', worker.url).href);
      await waitFor(popup, `document.querySelector('label')`);
      await checkTheme(page, popup);
      passed.push(
        'Appearance persists, syncs to an open page, follows system changes, and keeps explicit overrides',
      );
      assert.equal(
        await popup.evaluate(
          `Array.from(document.querySelectorAll('label')).find(label => label.textContent === 'Autohide').control.checked`,
        ),
        true,
      );
      const setCount = async (count: number) => {
        await popup.evaluate(`(() => {
          const input = document.querySelector('input[type="number"]');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '${count}');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
      };
      await checkReturnPosition(page, popup);
      await checkTooltipsMode(client, origin, popup);
      passed.push(
        'Tooltips mode in Appearance switches full and compact badges live without losing the selected menu, query or numbered shortcuts',
      );
      passed.push(
        'Alt+Backspace returns after Tab/Alt+1 and nested scrolling; Escape closes in one press and leaves new page focus alone',
      );
      await page.activate();
      await waitFor(page, 'document.hasFocus()');
      await page.key('f', 1);
      await waitFor(
        page,
        `${shadow}.activeElement === ${input} && ${input}.getClientRects().length > 0`,
      );
      await clear(page);
      await page.evaluate(
        `document.getElementById('dynamic').innerHTML = Array.from({length:30}, (_,index) => '<p>countsample ' + index + '</p>').join('')`,
      );
      await type(page, 'countsample');
      await expectSummary(page, 'Text 1 / 30');
      for (const count of [5, 1, 5]) {
        await setCount(count);
        await waitFor(page, `${shadow}.querySelectorAll('[role="option"]').length === ${count}`);
      }
      for (const number of [4, 5]) {
        await page.key(String(number), 1);
        await waitFor(
          page,
          `${shadow}.querySelectorAll('[role="option"]')[${number - 1}]?.getAttribute('aria-selected') === 'true'`,
        );
      }
      assert.equal(
        await page.evaluate(
          `(() => { const panel = ${shadow}.querySelector('[role="listbox"]').getBoundingClientRect(); return panel.top >= 0 && panel.bottom <= innerHeight; })()`,
        ),
        true,
      );
      await page.evaluate(`${shadow}.querySelectorAll('[role="option"]')[4].click()`);
      assert.equal(
        await page.evaluate(
          `getComputedStyle(${shadow}.querySelectorAll('[role="option"]')[4]).backgroundColor`,
        ),
        'rgb(65, 65, 65)',
      );
      await setCount(3);
      await waitFor(page, `${shadow}.querySelectorAll('[role="option"]').length === 3`);
      await clear(page);
      await page.evaluate(`document.getElementById('dynamic').replaceChildren()`);
      passed.push(
        'Suggestion count updates live within 1–5; Alt+4/5 select rows and selected rows have a gray background',
      );
      await settingsTab(popup, 'Appearance');
      const lockButton = `Array.from(document.querySelectorAll('label')).find(label => label.textContent === 'Lock position and size')?.control`;
      const pageContainer = `${shadow}?.getElementById('keymove-container')`;
      await popup.evaluate(`${lockButton}.click()`);
      await waitFor(page, `${pageContainer}?.dataset.layoutLocked === 'true'`);
      assert.equal(
        await page.evaluate(`${shadow}.querySelectorAll('.keymove-resize-handle').length`),
        0,
      );
      assert.equal(
        await popup.evaluate(`document.querySelector('.keymove-position-cell').disabled`),
        true,
      );
      await page.activate();
      await waitFor(page, 'document.hasFocus()');
      await page.key('f', 1);
      await waitFor(page, `${shadow}?.activeElement === ${input}`);
      await clear(page);
      await type(page, 'qxyz');
      await expectSummary(page, 'Text 1 / 1');
      // reload() returns before navigation starts. Do not accept the old document's
      // already-checked control as proof that the new document hydrated its settings.
      await popup.evaluate(
        `document.documentElement.dataset.reloadPending = 'true'; location.reload()`,
      );
      await waitFor(
        popup,
        `!document.documentElement?.dataset.reloadPending && document.querySelector('[role="tab"]')`,
      );
      await settingsTab(popup, 'Appearance');
      await waitFor(
        popup,
        `!document.documentElement?.dataset.reloadPending && ${lockButton}?.checked === true`,
      );
      await popup.evaluate(`${lockButton}.click()`);
      await waitFor(
        page,
        `${pageContainer}?.dataset.layoutLocked === 'false' && ${shadow}.querySelectorAll('.keymove-resize-handle').length === 2`,
      );
      passed.push(
        'Layout lock persists when settings reopen and disables/re-enables resizing in the open page',
      );
      await setActivation(popup, 'shortcut');
      for (const label of ['Autohide']) {
        await popup.evaluate(
          `(() => { const label = Array.from(document.querySelectorAll('label')).find(label => label.textContent === ${JSON.stringify(label)}); if (label.control.checked !== ${label === 'Autohide'}) label.click(); })()`,
        );
      }
      await waitFor(
        popup,
        `document.querySelector('[aria-label="Default activation"]').value === 'shortcut' && Array.from(document.querySelectorAll('label')).find(label => label.textContent === 'Autohide').control.checked === true`,
      );
      await page.activate();
      await page.key('f', 1);
      await clear(page);
      await page.key('Escape');
      await waitFor(page, `!${input} || ${input}.getClientRects().length === 0`);
      await page.key('q');
      assert.equal(
        await page.evaluate(`Boolean(${input}?.getClientRects().length)`),
        false,
        'Always on disabled must not summon a hidden bar',
      );
      await page.key('f', 1);
      await waitFor(
        page,
        `${input}?.getClientRects().length > 0 && ${shadow}.activeElement === ${input}`,
      );
      await type(page, 'qxyz');
      await expectSummary(page, 'Text 1 / 1');
      passed.push('Actual popup settings propagate to an open tab; hidden bar reopens with Alt+F');
      await setActivation(popup, 'type');
      for (const label of ['Autohide']) {
        await popup.evaluate(
          `(() => { const label = Array.from(document.querySelectorAll('label')).find(label => label.textContent === ${JSON.stringify(label)}); if (!label.control.checked) label.click(); })()`,
        );
      }
      await checkSiteSettings(page, popup);
      passed.push(
        'Opening shortcut remaps live; shortcut-only sites preserve page typing; paused sites release all keys; saved overrides can be removed to resume defaults',
      );
    }
    console.log(JSON.stringify({ passed, measurements }, null, 2));
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    try {
      const report = {
        recordedAt: new Date().toISOString(),
        browser,
        browserVersion: await client.sendCommand('Browser.getVersion', {}),
        node: process.version,
        commit: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8',
          windowsHide: true,
        }).trim(),
        dirty: Boolean(
          execFileSync('git', ['status', '--porcelain'], {
            cwd: root,
            encoding: 'utf8',
            windowsHide: true,
          }).trim(),
        ),
        passed,
        measurements,
        dynamicPage,
        success: failure === null,
        failure,
      };
      writeFileSync(
        path.join(output, 'browser-smoke.json'),
        JSON.stringify(report, null, 2) + '\n',
      );
    } finally {
      await server.close();
    }
  }
}
