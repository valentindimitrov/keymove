import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import type { ChromiumClient } from 'web-ext';
import { boundedClient, openPage, waitFor } from './browser-driver.ts';
import type { TestPage } from './browser-driver.ts';
import { checkContextNavigation } from './context-navigation-smoke.ts';

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

// Measure input-event to committed result text in the browser, excluding protocol
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
    root.addEventListener('input', start, { capture: true, once: true });
    const observer = new MutationObserver(() => {
      if (started !== null && ${summary} === ${JSON.stringify(expected)}) {
        globalThis.__keymoveTiming = performance.now() - started;
        observer.disconnect();
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    setTimeout(() => { observer.disconnect(); root.removeEventListener('input', start, true); }, 10000);
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
  const passed: string[] = [];
  let failure: string | null = null;
  const output = path.join(root, '.artifacts');
  mkdirSync(output, { recursive: true });
  try {
    await server.listen();
    const origin = server.resolvedUrls?.local[0];
    assert(origin, 'Fixture server did not expose its address');
    await checkContextNavigation(client, origin);
    passed.push(
      'Off-screen matches leave context below; switching tabs preserves independent queries and selections',
    );
    for (const size of ['small', 'large']) {
      console.log(`Checking ${size} fixture at ${origin}`);
      const page = await openPage(client, `${origin}fixtures.html?size=${size}`);
      await page.activate();
      await waitFor(page, `document.documentElement.dataset.fixtureReady && ${input}`);
      console.log(`${size}: extension mounted; checking typing and latency`);
      await page.key('f', 1); // Alt+F, including when always-on is disabled.
      await waitFor(page, `${shadow}?.activeElement === ${input}`);
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
      await expectSummary(page, 'Text 0 / 0');
      await page.key('s', 1);
      await expectSummary(page, 'Actions 1 / 1');
      passed.push('Attribute-only matches appear in action mode and stay out of text mode');
      await page.key('s', 1);
      await expectSummary(page, 'Text 0 / 0');

      await clear(page);
      await type(page, 'nectarine');
      await expectSummary(page, 'Text 1 / 1');
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
      const popup = await openPage(client, new URL('popup.html', worker.url).href);
      await waitFor(popup, `document.querySelector('label')`);
      for (const label of ['Always on', 'Autohide']) {
        await popup.evaluate(
          `Array.from(document.querySelectorAll('label')).find(label => label.textContent === ${JSON.stringify(label)}).click()`,
        );
      }
      await waitFor(
        popup,
        `document.querySelectorAll('input[type="checkbox"]')[0].checked === false && document.querySelectorAll('input[type="checkbox"]')[4].checked === true`,
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
      for (const label of ['Always on', 'Autohide']) {
        await popup.evaluate(
          `Array.from(document.querySelectorAll('label')).find(label => label.textContent === ${JSON.stringify(label)}).click()`,
        );
      }
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
