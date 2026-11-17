import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { attachFailure, openPage, snapshot } from '../pages.js';
import { keymove } from '../keymove.js';
import { settingsTab } from './settings-smoke.js';

type ColorScheme = 'light' | 'dark' | null;

function preference(popup: Page) {
  return popup.locator('.keymove-theme-setting select');
}

async function choose(popup: Page, theme: string) {
  await preference(popup).selectOption(theme);
}

async function colorScheme(page: Page, popup: Page, scheme: ColorScheme) {
  await page.emulateMedia({ colorScheme: scheme });
  await popup.emulateMedia({ colorScheme: scheme });
}

async function expectTheme(page: Page, popup: Page, theme: 'light' | 'dark') {
  const color = theme === 'light' ? 'rgb(30, 34, 43)' : 'rgb(255, 255, 255)';
  // Bring each context to the front before checking its rendered system appearance.
  await page.bringToFront();
  await expect(keymove(page).host).toHaveAttribute('data-keymove-theme', theme);
  await expect(keymove(page).host.locator('#keymove-input')).toHaveCSS('color', color);
  await popup.bringToFront();
  await expect(popup.locator('html')).toHaveAttribute('data-keymove-theme', theme);
  await expect(popup.locator('body')).toHaveCSS('color', color);
}

function hostAppearance(page: Page) {
  return page.evaluate(() => ({
    theme: document.documentElement.dataset['keymoveTheme'],
    scheme: getComputedStyle(document.documentElement).colorScheme,
  }));
}

export async function checkTheme(page: Page, popup: Page) {
  await settingsTab(popup, 'Appearance');
  const pageAppearance = await hostAppearance(page);
  await popup.setViewportSize({ width: 420, height: 1000 });
  try {
    await colorScheme(page, popup, 'light');
    await choose(popup, 'system');
    await expectTheme(page, popup, 'light');
    // System follows live appearance changes.
    await colorScheme(page, popup, 'dark');
    await expectTheme(page, popup, 'dark');
    await choose(popup, 'light');
    await expectTheme(page, popup, 'light');
    expect(
      await popup.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      'The popup must fit beside its vertical scrollbar',
    ).toBe(true);
    await snapshot(popup, 'settings-light');
    // An explicit choice overrides the system appearance and persists.
    await colorScheme(page, popup, 'light');
    await choose(popup, 'dark');
    await expectTheme(page, popup, 'dark');
    await snapshot(popup, 'settings-dark');
    expect(
      await popup.evaluate(() =>
        (
          globalThis as unknown as {
            chrome: { storage: { local: { get(key: string): Promise<{ theme?: string }> } } };
          }
        ).chrome.storage.local
          .get('theme')
          .then(data => data.theme),
      ),
    ).toBe('dark');
    await popup.reload();
    await expect(popup.getByRole('tab', { selected: true })).toHaveText('General');
    await settingsTab(popup, 'Appearance');
    await expect(preference(popup)).toHaveValue('dark');
    await expectTheme(page, popup, 'dark');
    await choose(popup, 'system');
    await expectTheme(page, popup, 'light');
    expect(
      await hostAppearance(page),
      'The extension must not change the host document theme',
    ).toEqual(pageAppearance);
  } finally {
    await colorScheme(page, popup, null);
    await popup.setViewportSize({ width: 1280, height: 900 });
    await settingsTab(popup, 'General');
  }
}

type PaneState = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  overflow: boolean;
  font: string;
  labels: number[];
  bar?: { top: number; bottom: number } | undefined;
  slate?: { top: number; bottom: number } | undefined;
};

export async function checkThemePreviews(context: BrowserContext, origin: string) {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [1280, 360]) {
      for (const scenario of [
        'theme-settings',
        'slate-above',
        'slate-below',
        'suggestion-spacing',
        'action-menu-narrow',
      ]) {
        const page = await openPage(context, `${origin}?scenario=${scenario}&theme=${theme}`);
        const { host } = keymove(page);
        try {
          await page.setViewportSize({ width, height: 900 });
          await expect(host).toHaveAttribute('data-keymove-theme', theme);
          await expect(
            host.locator(scenario === 'theme-settings' ? '#keymove-popup' : '#keymove-container'),
          ).toBeAttached();
          // Let ResizeObserver and React commit the new viewport geometry before measuring.
          await page.evaluate(
            () =>
              new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
          const state: PaneState = await page.evaluate(() => {
            const root = document.getElementById('keymove-root')!.shadowRoot!;
            const pane = root.querySelector('#keymove-popup, #keymove-container')!;
            const rect = pane.getBoundingClientRect();
            const labels = Array.from(root.querySelectorAll('.keymove-info-panel-setting-header'))
              .filter(node => !node.closest('.keymove-popup-layout-actions'))
              .map(node => node.getBoundingClientRect().left);
            const bar = root.querySelector('#keymove-bar')?.getBoundingClientRect();
            const slate = root.querySelector('.keymove-suggestions')?.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              overflow: pane.scrollWidth > pane.clientWidth,
              font: getComputedStyle(pane).fontFamily,
              labels,
              bar: bar && { top: bar.top, bottom: bar.bottom },
              slate: slate && { top: slate.top, bottom: slate.bottom },
            };
          });
          expect(
            state.left >= 0 && state.right <= width + 1 && state.top >= 0 && state.bottom <= 901,
            JSON.stringify(state),
          ).toBe(true);
          expect(state.overflow, `${scenario} overflows at ${width}px`).toBe(false);
          expect(state.font).toMatch(/Helvetica/);
          expect(
            state.labels.every(left => Math.abs(left - state.labels[0]!) < 1),
            'Settings labels must share one column',
          ).toBe(true);
          if (scenario === 'slate-above')
            expect(state.slate!.bottom).toBeLessThanOrEqual(state.bar!.top + 1);
          if (scenario === 'slate-below')
            expect(state.slate!.top).toBeGreaterThanOrEqual(state.bar!.bottom - 1);
          if (scenario === 'suggestion-spacing') {
            await host.getByRole('button', { name: 'Use short descriptions', exact: true }).click();
            for (const count of [5, 4, 3, 2, 1]) {
              await host
                .getByRole('combobox', { name: 'Results', exact: true })
                .selectOption(String(count));
              // Only result rows: the preview's own Results select has option elements too.
              await expect(host.locator('[role="option"]')).toHaveCount(count);
              const gap = await host.locator('.keymove-suggestions').evaluate(panel => {
                return (
                  panel.getBoundingClientRect().bottom -
                  panel.lastElementChild!.getBoundingClientRect().bottom
                );
              });
              expect(
                gap >= 4 && gap <= 6,
                `${count} compact rows must leave only bottom padding at ${width}px; got ${gap}`,
              ).toBe(true);
            }
          }
          await snapshot(page, `${scenario}-${theme}-${width}`);
          if (scenario === 'theme-settings') {
            for (const tab of ['General', 'Appearance', 'Shortcuts', 'Sites']) {
              const tabButton = host.getByRole('tab', { name: tab, exact: true });
              await tabButton.click();
              await expect(tabButton).toHaveAttribute('aria-selected', 'true');
              const aligned = await page.evaluate(() => {
                const root = document.getElementById('keymove-root')!.shadowRoot!;
                const popup = root.querySelector('#keymove-popup')!;
                const inputs = Array.from(
                  popup.querySelectorAll(
                    'input[type="checkbox"],input[type="color"],input[type="number"]',
                  ),
                );
                return (
                  popup.scrollWidth <= popup.clientWidth &&
                  inputs.every(input => {
                    const row = input
                      .closest('.keymove-info-panel-setting-row')!
                      .getBoundingClientRect();
                    const rect = input.getBoundingClientRect();
                    return Math.abs((rect.left + rect.right) / 2 - (row.right - 65)) < 1;
                  })
                );
              });
              expect(aligned, `${tab} controls align at ${width}px`).toBe(true);
              if (tab === 'Appearance' || tab === 'Shortcuts') {
                const selector =
                  tab === 'Appearance'
                    ? '.keymove-theme-setting select'
                    : '.keymove-settings-field input';
                const scrollbarGap = await page.evaluate(controlSelector => {
                  const root = document.getElementById('keymove-root')!.shadowRoot!;
                  const panel = root.querySelector('.keymove-settings-panel')!;
                  const control = panel.querySelector(controlSelector)!;
                  return (
                    panel.getBoundingClientRect().left +
                    panel.clientWidth -
                    control.getBoundingClientRect().right
                  );
                }, selector);
                expect(
                  scrollbarGap >= 10,
                  `${tab} controls need space before the scrollbar at ${width}px; got ${scrollbarGap}`,
                ).toBe(true);
              }
              await snapshot(page, `settings-${tab.toLowerCase()}-${theme}-${width}`);
            }
          }
        } catch (error) {
          await attachFailure(page);
          throw error;
        } finally {
          await page.close();
        }
      }
    }
  }
}
