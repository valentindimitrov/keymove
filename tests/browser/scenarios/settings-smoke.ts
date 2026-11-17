import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import EXTENSION_IDENTITY from '../../../src/extension_identity.js';
import { snapshot } from '../pages.js';
import { keymove } from '../keymove.js';

type ChromeApi = {
  storage: { local: { set(items: object): Promise<void>; remove(keys: string[]): Promise<void> } };
  tabs: {
    getCurrent(): Promise<{ id?: number } | undefined>;
    query(query: object): Promise<{ id?: number; url?: string }[]>;
    update(id: number, properties: object): Promise<unknown>;
  };
};

/** Brings a tab to the front and waits until its document really has focus. */
export async function focusTab(page: Page) {
  await page.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
}

/** The bar's visibility: autohide removes its client rects while it is closed. */
export function barShown(page: Page) {
  return keymove(page).input.evaluate(field => field.getClientRects().length > 0);
}

export async function settingsTab(popup: Page, name: string) {
  const tab = popup.getByRole('tab', { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

export async function setActivation(popup: Page, value: 'type' | 'shortcut') {
  await settingsTab(popup, 'General');
  await popup
    .getByRole('combobox', { name: 'Default activation', exact: true })
    .selectOption(value);
}

/** Sets a labelled settings checkbox with a real click when it differs. */
export async function setCheckbox(popup: Page, label: string, checked: boolean) {
  await popup.getByLabel(label, { exact: true }).setChecked(checked);
}

export async function checkSiteSettings(page: Page, popup: Page) {
  const { input, bar } = keymove(page);
  const host = await page.evaluate(() => location.hostname);
  const pageUrl = page.url();
  // Exercise the same opener context as the background's standalone-settings fallback.
  // Extension-tab URLs are withheld without tabs permission, so do not identify this
  // settings tab through its URL in the tabs API.
  await popup.evaluate(async url => {
    const chrome = (globalThis as unknown as { chrome: ChromeApi }).chrome;
    const current = await chrome.tabs.getCurrent();
    const source = (await chrome.tabs.query({})).find(tab => tab.url === url);
    if (current?.id === undefined || source?.id === undefined) throw new Error('Tabs not found');
    await chrome.tabs.update(current.id, { openerTabId: source.id });
  }, pageUrl);
  // Reload only after the evaluation above has returned, so it cannot destroy its own context.
  await popup.reload();
  await settingsTab(popup, 'Sites');
  await expect(popup.locator('.keymove-current-site strong')).toHaveText(host);
  const siteBehavior = popup.getByRole('combobox', { name: 'Site behavior', exact: true });
  const chooseSite = async (value: string) => {
    await settingsTab(popup, 'Sites');
    await siteBehavior.selectOption(value);
  };
  await chooseSite('shortcut');
  // Record a new opening shortcut with real keys in the settings document.
  await settingsTab(popup, 'Shortcuts');
  await focusTab(popup);
  const recorder = popup.getByLabel('Open KeyMove', { exact: true });
  await recorder.focus();
  await popup.keyboard.press('Alt+k');
  // The settings label names the Alt key as macOS does; the browser runs on this host.
  const altLabel = process.platform === 'darwin' ? 'Option' : 'Alt';
  await expect(recorder).toHaveValue(`${altLabel}+K`);
  await popup.evaluate(() =>
    (globalThis as unknown as { chrome: ChromeApi }).chrome.storage.local.set({
      'siteBehavior:github.com': 'paused',
    }),
  );
  try {
    await settingsTab(popup, 'Sites');
    await expect(popup.locator('.keymove-site-overrides li')).toHaveCount(2);
    await expect(bar).toHaveAttribute('data-site-behavior', 'shortcut');
    await focusTab(page);
    await page.keyboard.press('Alt+k');
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue('');
    await expect(input).not.toBeFocused();
    // The replaced Alt+F no longer belongs to KeyMove: the page receives it unhandled.
    await page.evaluate(() => {
      const seen: boolean[] = [];
      (globalThis as typeof globalThis & { __altF: boolean[] }).__altF = seen;
      window.addEventListener('keydown', event => {
        if (event.code === 'KeyF' && event.altKey) seen.push(event.defaultPrevented);
      });
    });
    await page.keyboard.press('Alt+f');
    await expect
      .poll(() =>
        page.evaluate(() => (globalThis as typeof globalThis & { __altF: boolean[] }).__altF),
      )
      .toEqual([false]);
    // A shortcut-only site leaves ordinary typing to the page.
    await page.keyboard.press('g');
    await expect(input).toHaveValue('');
    await expect(input).not.toBeFocused();
    await page.keyboard.press('Alt+k');
    await page.keyboard.press('q');
    await expect(input).toHaveValue('q');
    // A paused site releases every key, including the opening shortcut.
    await chooseSite('paused');
    await expect(bar).toHaveAttribute('data-site-behavior', 'paused');
    await expect(input).toHaveValue('');
    await expect(popup.locator('.keymove-show-search-button')).toBeDisabled();
    await expect(popup.locator('.keymove-show-search')).toContainText('Resume in Sites');
    await page.keyboard.press('Alt+k');
    await page.keyboard.press('g');
    await expect(input).not.toBeFocused();
    // Removing the saved override restores the default behavior.
    await popup.getByRole('button', { name: `Remove override for ${host}`, exact: true }).click();
    await expect(bar).toHaveAttribute('data-site-behavior', 'type');
    await focusTab(page);
    await page.keyboard.press('q');
    await expect(input).toHaveValue('q');
    await page.keyboard.press('Escape');
    await settingsTab(popup, 'Shortcuts');
    await popup.getByRole('button', { name: 'Restore opening shortcut', exact: true }).click();
    await expect(recorder).toHaveValue(`${altLabel}+F`);
    await focusTab(page);
    await page.keyboard.press('Alt+f');
    await expect(input).toBeFocused();
  } finally {
    await popup.evaluate(
      keys => (globalThis as unknown as { chrome: ChromeApi }).chrome.storage.local.remove(keys),
      [`siteBehavior:${host}`, 'siteBehavior:github.com', 'openingShortcut'],
    );
    await settingsTab(popup, 'General');
  }
}

export async function checkShowSearch(page: Page, popup: Page) {
  const { input } = keymove(page);
  await focusTab(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => barShown(page)).toBe(false);
  await focusTab(popup);
  await settingsTab(popup, 'General');
  const show = popup.locator('.keymove-show-search-button');
  await expect(show).toBeEnabled();
  await popup.setViewportSize({ width: 456, height: 600 });
  const links = await popup.locator('.keymove-popup-links a').evaluateAll(anchors =>
    anchors.map(anchor => ({
      href: (anchor as HTMLAnchorElement).href,
      target: (anchor as HTMLAnchorElement).target,
      width: anchor.getBoundingClientRect().width,
    })),
  );
  expect(links.map(link => ({ href: link.href, target: link.target }))).toEqual([
    { href: new URL(EXTENSION_IDENTITY.sourceUrl).href, target: '_blank' },
    { href: new URL(EXTENSION_IDENTITY.demoUrl).href, target: '_blank' },
    { href: new URL(EXTENSION_IDENTITY.supportUrl).href, target: '_blank' },
    { href: EXTENSION_IDENTITY.contactUrl, target: '' },
  ]);
  expect(links.every(link => Math.abs(link.width - links[0]!.width) < 1)).toBe(true);
  await snapshot(popup, 'settings-show-search');
  // The settings document closes itself after showing the bar in its source page.
  const closed = popup.waitForEvent('close');
  await show.click({ noWaitAfter: true });
  await closed;
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  await expect.poll(() => barShown(page)).toBe(true);
  await expect(input).toBeFocused();
  await page.keyboard.press('q');
  await expect(input).toHaveValue('q');
  await page.keyboard.press('Escape');
}
