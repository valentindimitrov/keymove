import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ChromiumClient } from 'web-ext';
import { openPage, waitFor, type TestPage } from './browser-driver.ts';
import { settingsTab } from './settings-smoke.ts';

const artifacts = path.resolve(import.meta.dirname, '../.artifacts');
const host = `document.getElementById('keymove-root')`;
const shadow = `${host}?.shadowRoot`;
const preference = `document.querySelector('.keymove-theme-setting select')`;

async function choose(popup: TestPage, theme: string) {
  await popup.evaluate(`(() => {
    const select = ${preference};
    select.value = ${JSON.stringify(theme)};
    select.dispatchEvent(new Event('change', {bubbles: true}));
  })()`);
}

async function expectTheme(page: TestPage, popup: TestPage, theme: string) {
  // Activate each context before checking its rendered system appearance.
  await page.activate();
  await waitFor(page, `${host}?.dataset.keymoveTheme === '${theme}'`);
  const color = theme === 'light' ? 'rgb(30, 34, 43)' : 'rgb(255, 255, 255)';
  assert.equal(
    await page.evaluate(`getComputedStyle(${shadow}.querySelector('#keymove-input')).color`),
    color,
  );
  await popup.activate();
  await waitFor(popup, `document.documentElement.dataset.keymoveTheme === '${theme}'`);
  assert.equal(await popup.evaluate(`getComputedStyle(document.body).color`), color);
}

export async function checkTheme(page: TestPage, popup: TestPage) {
  await settingsTab(popup, 'Appearance');
  mkdirSync(artifacts, { recursive: true });
  const pageAppearance =
    await page.evaluate(`({theme: document.documentElement.dataset.keymoveTheme,
    scheme: getComputedStyle(document.documentElement).colorScheme})`);
  await popup.setViewport(420, 1000);
  try {
    await page.setColorScheme('light');
    await popup.setColorScheme('light');
    await choose(popup, 'system');
    await expectTheme(page, popup, 'light');
    await page.setColorScheme('dark');
    await popup.setColorScheme('dark');
    await expectTheme(page, popup, 'dark');
    await choose(popup, 'light');
    await expectTheme(page, popup, 'light');
    assert.equal(
      await popup.evaluate(
        'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
      ),
      true,
      'The popup must fit beside its vertical scrollbar',
    );
    writeFileSync(path.join(artifacts, 'settings-light.png'), await popup.screenshot());
    await page.setColorScheme('light');
    await popup.setColorScheme('light');
    await choose(popup, 'dark');
    await expectTheme(page, popup, 'dark');
    writeFileSync(path.join(artifacts, 'settings-dark.png'), await popup.screenshot());
    assert.equal(
      await popup.evaluate(`chrome.storage.local.get('theme').then(data => data.theme)`),
      'dark',
    );
    await popup.evaluate('location.reload()');
    await waitFor(
      popup,
      `document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === 'General'`,
    );
    await settingsTab(popup, 'Appearance');
    await waitFor(popup, `${preference}?.value === 'dark'`);
    await expectTheme(page, popup, 'dark');
    await choose(popup, 'system');
    await expectTheme(page, popup, 'light');
    assert.deepEqual(
      await page.evaluate(`({theme: document.documentElement.dataset.keymoveTheme,
      scheme: getComputedStyle(document.documentElement).colorScheme})`),
      pageAppearance,
      'The extension must not change the host document theme',
    );
  } finally {
    await page.setColorScheme('');
    await popup.setColorScheme('');
    await popup.setViewport(1280, 900);
    await settingsTab(popup, 'General');
  }
}

export async function checkThemePreviews(client: ChromiumClient, origin: string) {
  mkdirSync(artifacts, { recursive: true });
  for (const theme of ['light', 'dark']) {
    for (const width of [1280, 360]) {
      for (const scenario of [
        'theme-settings',
        'slate-above',
        'slate-below',
        'action-menu-narrow',
      ]) {
        const page = await openPage(client, `${origin}?scenario=${scenario}&theme=${theme}`);
        try {
          await page.activate();
          await page.setViewport(width, 900);
          await waitFor(page, `${host}?.dataset.keymoveTheme === '${theme}'`);
          await waitFor(
            page,
            `${shadow}?.querySelector('${scenario === 'theme-settings' ? '#keymove-popup' : '#keymove-container'}')`,
          );
          // Let ResizeObserver and React commit the new viewport geometry before measuring.
          await page.evaluate(
            'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
          );
          const state = (await page.evaluate(`(() => {
            const root = ${shadow};
            const pane = root.querySelector('#keymove-popup, #keymove-container');
            const rect = pane.getBoundingClientRect();
            const labels = Array.from(root.querySelectorAll('.keymove-info-panel-setting-header'))
              .filter(node => !node.closest('.keymove-popup-layout-actions')).map(node => node.getBoundingClientRect().left);
            const bar = root.querySelector('#keymove-bar')?.getBoundingClientRect();
            const slate = root.querySelector('.keymove-suggestions')?.getBoundingClientRect();
            return {left:rect.left, right:rect.right, top:rect.top, bottom:rect.bottom,
              overflow: pane.scrollWidth > pane.clientWidth, font: getComputedStyle(pane).fontFamily, labels,
              bar: bar && {top:bar.top, bottom:bar.bottom}, slate: slate && {top:slate.top, bottom:slate.bottom}};
          })()`)) as {
            left: number;
            right: number;
            top: number;
            bottom: number;
            overflow: boolean;
            font: string;
            labels: number[];
            bar?: { top: number; bottom: number };
            slate?: { top: number; bottom: number };
          };
          assert(
            state.left >= 0 && state.right <= width + 1 && state.top >= 0 && state.bottom <= 901,
            JSON.stringify(state),
          );
          assert.equal(state.overflow, false, `${scenario} overflows at ${width}px`);
          assert.match(state.font, /Helvetica/);
          assert(
            state.labels.every(left => Math.abs(left - state.labels[0]!) < 1),
            'Settings labels must share one column',
          );
          if (scenario === 'slate-above') assert(state.slate!.bottom <= state.bar!.top + 1);
          if (scenario === 'slate-below') assert(state.slate!.top >= state.bar!.bottom - 1);
          writeFileSync(
            path.join(artifacts, `${scenario}-${theme}-${width}.png`),
            await page.screenshot(),
          );
          if (scenario === 'theme-settings') {
            for (const tab of ['General', 'Appearance', 'Shortcuts', 'Sites']) {
              await page.evaluate(
                `Array.from(${shadow}.querySelectorAll('[role="tab"]')).find(tab => tab.textContent === '${tab}').click()`,
              );
              await waitFor(
                page,
                `${shadow}.querySelector('[role="tab"][aria-selected="true"]').textContent === '${tab}'`,
              );
              const aligned = await page.evaluate(`(() => {
                const root=${shadow};const popup=root.querySelector('#keymove-popup');
                const inputs=Array.from(popup.querySelectorAll('input[type="checkbox"],input[type="color"],input[type="number"]'));
                return popup.scrollWidth <= popup.clientWidth && inputs.every(input => {
                  const row=input.closest('.keymove-info-panel-setting-row').getBoundingClientRect();
                  const rect=input.getBoundingClientRect();return Math.abs((rect.left+rect.right)/2-(row.right-65))<1;
                });
              })()`);
              assert.equal(aligned, true, `${tab} controls align at ${width}px`);
              writeFileSync(
                path.join(artifacts, `settings-${tab.toLowerCase()}-${theme}-${width}.png`),
                await page.screenshot(),
              );
            }
          }
        } finally {
          await page.close();
        }
      }
    }
  }
}
