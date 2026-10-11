import type { Page } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { waitFor } from '../pages.js';
import EXTENSION_IDENTITY from '../../../src/extension_identity.js';

export async function settingsTab(popup: Page, name: string) {
  const tab = `Array.from(document.querySelectorAll('[role="tab"]')).find(tab => tab.textContent === ${JSON.stringify(name)})`;
  await waitFor(popup, tab);
  await popup.evaluate(`${tab}.click()`);
  await waitFor(popup, `${tab}.getAttribute('aria-selected') === 'true'`);
}
export async function setActivation(popup: Page, value: 'type' | 'shortcut') {
  await settingsTab(popup, 'General');
  await popup.evaluate(
    `(() => {const select=document.querySelector('[aria-label="Default activation"]');select.value='${value}';select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
}

export async function checkSiteSettings(page: Page, popup: Page) {
  const shadow = `document.getElementById('keymove-root').shadowRoot`;
  const input = `${shadow}.querySelector('[aria-label="Search page"]')`;
  const container = `${shadow}.querySelector('#keymove-bar')`;
  const host = await page.evaluate('location.hostname');
  const siteKey = JSON.stringify('siteBehavior:' + String(host));
  const pageUrl = await page.evaluate('location.href');
  // Exercise the same opener context as the background's standalone-settings fallback.
  // Extension-tab URLs are withheld without tabs permission, so do not identify this
  // settings tab through its URL in the tabs API.
  await popup.evaluate(`(async () => {
    const current=await chrome.tabs.getCurrent();const tabs=await chrome.tabs.query({});
    const source=tabs.find(tab => tab.url === ${JSON.stringify(pageUrl)});
    await chrome.tabs.update(current.id,{openerTabId:source.id});
    document.documentElement.dataset.reloading='true';
    // Let this awaited browser-API evaluation return before destroying its context.
    setTimeout(() => location.reload(), 50);
  })()`);
  await waitFor(
    popup,
    `!document.documentElement?.dataset.reloading && document.querySelector('[role="tab"]')`,
  );
  await settingsTab(popup, 'Sites');
  await waitFor(
    popup,
    `document.querySelector('.keymove-current-site strong')?.textContent === ${JSON.stringify(host)}`,
  );
  const chooseSite = async (value: string) => {
    await settingsTab(popup, 'Sites');
    await popup.evaluate(
      `(() => {const select=document.querySelector('.keymove-settings-field select');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
  };
  await chooseSite('shortcut');
  await settingsTab(popup, 'Shortcuts');
  await popup.bringToFront();
  await waitFor(popup, 'document.hasFocus()');
  await popup.evaluate(`document.querySelector('[aria-label="Open KeyMove"]').focus()`);
  await popup.keyboard.press('Alt+k');
  await waitFor(popup, `document.querySelector('[aria-label="Open KeyMove"]').value === 'Alt+K'`);
  await popup.evaluate(`chrome.storage.local.set({'siteBehavior:github.com':'paused'})`);
  try {
    await settingsTab(popup, 'Sites');
    await waitFor(popup, `document.querySelectorAll('.keymove-site-overrides li').length === 2`);
    await waitFor(page, `${container}.dataset.siteBehavior === 'shortcut'`);
    await page.bringToFront();
    await waitFor(page, 'document.hasFocus()');
    await page.keyboard.press('Alt+k');
    await waitFor(page, `${shadow}.activeElement === ${input}`);
    await page.keyboard.press('Escape');
    await waitFor(page, `${input}.value === '' && ${shadow}.activeElement !== ${input}`);
    // The old Alt+F may now open the browser menu. Check page interception without
    // invoking that browser-level action, then use real keys for the new binding.
    assert.equal(
      await page.evaluate(
        `document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'f',code:'KeyF',altKey:true,bubbles:true,cancelable:true}))`,
      ),
      true,
    );
    await page.keyboard.press('g');
    assert.equal(await page.evaluate(`${input}.value`), '');
    assert.equal(await page.evaluate(`${shadow}.activeElement === ${input}`), false);
    await page.keyboard.press('Alt+k');
    await page.keyboard.press('q');
    await waitFor(page, `${input}.value === 'q'`);
    await chooseSite('paused');
    await waitFor(page, `${container}.dataset.siteBehavior === 'paused' && ${input}.value === ''`);
    await waitFor(
      popup,
      `document.querySelector('.keymove-show-search-button').disabled && document.querySelector('.keymove-show-search').textContent.includes('Resume in Sites')`,
    );
    await page.keyboard.press('Alt+k');
    await page.keyboard.press('g');
    assert.equal(await page.evaluate(`${shadow}.activeElement === ${input}`), false);
    await popup.evaluate(
      `document.querySelector('[aria-label="Remove override for ${String(host)}"]').click()`,
    );
    await waitFor(page, `${container}.dataset.siteBehavior === 'type'`);
    await page.keyboard.press('q');
    await waitFor(page, `${input}.value === 'q'`);
    await page.keyboard.press('Escape');
    await settingsTab(popup, 'Shortcuts');
    await popup.evaluate(
      `Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Restore opening shortcut').click()`,
    );
    await page.keyboard.press('Alt+f');
    await waitFor(page, `${shadow}.activeElement === ${input}`);
  } finally {
    await popup.evaluate(
      `chrome.storage.local.remove([${siteKey},'siteBehavior:github.com','openingShortcut'])`,
    );
    await settingsTab(popup, 'General');
  }
}

export async function checkShowSearch(page: Page, popup: Page) {
  const shadow = `document.getElementById('keymove-root').shadowRoot`;
  const input = `${shadow}.querySelector('[aria-label="Search page"]')`;
  await page.bringToFront();
  await waitFor(page, 'document.hasFocus()');
  await page.keyboard.press('Escape');
  await waitFor(page, `${input}.getClientRects().length === 0`);
  await popup.bringToFront();
  await waitFor(popup, 'document.hasFocus()');
  await settingsTab(popup, 'General');
  await waitFor(popup, `!document.querySelector('.keymove-show-search-button').disabled`);
  await popup.setViewportSize({ width: 456, height: 600 });
  const links = await popup.evaluate(
    `Array.from(document.querySelectorAll('.keymove-popup-links a')).map(a => ({href:a.href, target:a.target, width:a.getBoundingClientRect().width}))`,
  );
  assert(Array.isArray(links));
  assert.deepEqual(
    links.map(link => ({ href: link.href, target: link.target })),
    [
      { href: new URL(EXTENSION_IDENTITY.sourceUrl).href, target: '_blank' },
      { href: new URL(EXTENSION_IDENTITY.demoUrl).href, target: '_blank' },
      { href: new URL(EXTENSION_IDENTITY.supportUrl).href, target: '_blank' },
      { href: EXTENSION_IDENTITY.contactUrl, target: '' },
    ],
  );
  assert(links.every(link => Math.abs(link.width - links[0].width) < 1));
  writeFileSync(
    path.resolve(import.meta.dirname, '../../../.artifacts/settings-show-search.png'),
    await popup.screenshot(),
  );
  // Return from evaluation before this settings document closes itself.
  await popup.evaluate(
    `setTimeout(() => document.querySelector('.keymove-show-search-button').click(), 0)`,
  );
  await waitFor(
    page,
    `document.hasFocus() && ${input}.getClientRects().length > 0 && ${shadow}.activeElement === ${input}`,
  );
  await page.keyboard.press('q');
  await waitFor(page, `${input}.value === 'q'`);
  await page.keyboard.press('Escape');
}
