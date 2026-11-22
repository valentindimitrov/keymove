import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { openPage, selectionText } from '../pages.js';
import { keymove } from '../keymove.js';
import { checkReturnPosition } from './return-position-smoke.js';
import { checkTooltipsMode } from './tooltips-mode-smoke.js';
import { checkTheme } from './theme-smoke.js';
import {
  barShown,
  checkShowSearch,
  checkSiteSettings,
  focusTab,
  setActivation,
  setCheckbox,
  settingsTab,
} from './settings-smoke.js';

type TimingWindow = typeof globalThis & {
  __keymoveTiming: number | null;
  __keymoveStopPanelCheck: () => Record<string, boolean>;
};

async function type(page: Page, value: string) {
  for (const character of value) await page.keyboard.type(character);
}

async function clear(page: Page) {
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await expect(keymove(page).input).toHaveValue('');
}

async function expectSummary(page: Page, expected: string) {
  await expect(keymove(page).status).toHaveText(expected);
}

async function setDynamic(page: Page, html: string) {
  await page.locator('#dynamic').evaluate((element, markup) => {
    element.innerHTML = markup;
  }, html);
}

// Measure keydown to committed result text in the browser, excluding protocol
// round trips. Different counts for each prefix prevent stale results from passing.
async function timedCharacter(page: Page, character: string, expected: string): Promise<number> {
  await page.evaluate(summary => {
    const state = globalThis as TimingWindow;
    state.__keymoveTiming = null;
    const root = document.getElementById('keymove-root')!.shadowRoot!;
    let started: number | null = null;
    const start = () => {
      started = performance.now();
    };
    // Start before the extension's document-capture handler can render results.
    window.addEventListener('keydown', start, { capture: true, once: true });
    const observer = new MutationObserver(() => {
      if (started !== null && root.querySelector('[role="status"]')?.textContent === summary) {
        state.__keymoveTiming = performance.now() - started;
        observer.disconnect();
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    setTimeout(() => {
      observer.disconnect();
      window.removeEventListener('keydown', start, true);
    }, 10000);
  }, expected);
  await page.keyboard.type(character);
  const timing = () => page.evaluate(() => (globalThis as TimingWindow).__keymoveTiming);
  await expect.poll(timing, { message: `Timing for ${expected}` }).not.toBeNull();
  return (await timing())!;
}

export async function checkCore(context: BrowserContext, origin: string, size: string) {
  const passed: string[] = [];
  const page = await openPage(context, `${origin}fixtures.html?size=${size}`);
  const { bar, input, suggestions, options, host } = keymove(page);
  await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', /.*/);
  // Mounting precedes storage hydration. The startup regression tests cover the
  // deliberate no-capture interval; these checks exercise the enabled behavior.
  await expect(bar).toHaveAttribute('data-always-on', 'true');
  await focusTab(page);
  expect(await barShown(page), 'Autohide is on in a fresh profile').toBe(false);
  const coldMs = await timedCharacter(page, 'q', 'Text 1 / 4');
  await page.keyboard.press('Tab');
  await expectSummary(page, 'Text 2 / 4');
  await page.keyboard.press('Shift+Tab');
  await expectSummary(page, 'Text 1 / 4');
  const warmMs: number[] = [];
  for (let repeat = 0; repeat < 3; repeat++) {
    if (repeat > 0) {
      // Retain the live index: return to q without ending the search.
      for (let index = 0; index < 3; index++) await page.keyboard.press('Backspace');
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
  const measurements = { size, coldMs, warmMs };
  await expect(input, 'Every character must be accepted').toHaveValue('qxyz');
  passed.push(
    `${size}: real typing, distinct prefix counts, hidden text excluded, automatic first selection, forward/backward Tab`,
  );
  // While a query is pending the same suggestion frame stays mounted at its height.
  await page.evaluate(() => {
    const root = document.getElementById('keymove-root')!.shadowRoot!;
    const panel = root.getElementById('keymove-suggestions')!;
    const keymoveBar = root.getElementById('keymove-bar')!;
    const top = keymoveBar.getBoundingClientRect().top;
    const height = panel.getBoundingClientRect().height;
    const check = { removed: false, shifted: false, collapsed: false };
    const observer = new MutationObserver(records => {
      if (
        records.some(record =>
          Array.from(record.removedNodes).some(node => node === panel || node.contains(panel)),
        )
      )
        check.removed = true;
      if (
        panel.getAttribute('aria-busy') === 'true' &&
        Math.abs(keymoveBar.getBoundingClientRect().top - top) > 1
      )
        check.shifted = true;
      if (
        (panel.getAttribute('aria-busy') === 'true' ||
          panel.querySelector('.keymove-suggestions-empty')) &&
        panel.getBoundingClientRect().height < height - 1
      )
        check.collapsed = true;
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true });
    (globalThis as TimingWindow).__keymoveStopPanelCheck = () => {
      observer.disconnect();
      return { ...check, samePanel: root.getElementById('keymove-suggestions') === panel };
    };
  });
  await page.keyboard.press('Backspace');
  await expectSummary(page, 'Text 1 / 2');
  await page.keyboard.press('z');
  await expectSummary(page, 'Text 1 / 1');
  expect(await page.evaluate(() => (globalThis as TimingWindow).__keymoveStopPanelCheck())).toEqual(
    { removed: false, shifted: false, collapsed: false, samePanel: true },
  );
  await type(page, 'zzzz');
  await expectSummary(page, 'Text ~ 0 / 0');
  await expect(suggestions).toHaveCount(0);
  // After an empty result, further keystrokes must not flash an empty frame while their
  // searches run. Fuzzy rows may legitimately appear on the way back; a frame without rows
  // never may. Deleting back to the matching query ends with a search that completes last.
  await page.evaluate(() => {
    const root = document.getElementById('keymove-root')!.shadowRoot!;
    const check = { flashed: false };
    const observer = new MutationObserver(() => {
      const panel = root.getElementById('keymove-suggestions');
      if (panel && !panel.querySelector('[role="option"]')) check.flashed = true;
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true });
    (globalThis as TimingWindow).__keymoveStopPanelCheck = () => {
      observer.disconnect();
      return check;
    };
  });
  await type(page, 'zz');
  for (let index = 0; index < 6; index++) await page.keyboard.press('Backspace');
  await expectSummary(page, 'Text 1 / 1');
  await expect(suggestions).toHaveCount(1);
  expect(await page.evaluate(() => (globalThis as TimingWindow).__keymoveStopPanelCheck())).toEqual(
    { flashed: false },
  );
  passed.push(
    `${size}: suggestion frame preserves pending height, closes on empty results, stays closed while typing on, and reopens on matches`,
  );
  // Tab selects the whole semantic block natively, so Ctrl/Command+C copies it.
  await page.keyboard.press('Tab');
  await expectSummary(page, 'Text 1 / 1');
  const wholeBlock = (await page.locator('#copy-block').textContent())!;
  await expect.poll(() => selectionText(page)).toBe(wholeBlock);
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('d');
  await expect(input).toHaveValue('qxyzd');
  await expectSummary(page, 'Text 1 / 1');
  const paste = page.getByRole('textbox', { name: 'Native paste target', exact: true });
  await paste.focus();
  await page.keyboard.press('ControlOrMeta+v');
  await expect(paste).toHaveValue(wholeBlock);
  // Exclude the paste target from subsequent query counts.
  await paste.fill('');
  await page.keyboard.press('Alt+f');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  passed.push(
    'Tab selects whole semantic block; native copy/paste; editing resumes after selection',
  );
  if (size === 'large') return { passed, measurements };

  await clear(page);
  await type(page, 'mango');
  await expectSummary(page, 'Text ~ 0 / 0');
  await setDynamic(page, '<p>mango added later</p>');
  await expectSummary(page, 'Text 0 / 1');
  await setDynamic(page, '');
  await expectSummary(page, 'Text ~ 0 / 0');
  passed.push('DOM insertion and removal refresh the active query');

  await clear(page);
  await setDynamic(page, '<p>unsaved drafts</p>'.repeat(60) + '<p>Save</p>');
  await type(page, 'save');
  await expectSummary(page, 'Text 1 / 61');
  // "sav" also has 61 matches, so the summary can come from the previous query. Navigating
  // before the "save" results commit would be reset when they arrive and select the first.
  await expect(suggestions).toHaveAttribute('aria-busy', 'false');
  await page.keyboard.press('Shift+Tab');
  await expectSummary(page, 'Text 61 / 61');
  await page.keyboard.press('Tab');
  await expectSummary(page, 'Text 1 / 61');
  await page.keyboard.press('Alt+1');
  await expectSummary(page, 'Text 61 / 61');
  await expect.poll(() => selectionText(page)).toBe('Save');
  await setDynamic(page, '');
  passed.push('All 61 results are navigable; Alt+1 selects the strongest late-page text match');

  await clear(page);
  await setDynamic(
    page,
    ['alpha', 'beta', 'gamma', 'delta']
      .map(
        (name, index) =>
          `<p id="stable-${name}" style="position:fixed;left:20px;top:${
            index === 3 ? '200vh' : `${20 + index * 30}px`
          }">zest ${name}</p>`,
      )
      .join(''),
  );
  await type(page, 'zes');
  await expectSummary(page, 'Text 1 / 4');
  const thirdLabel = host.locator('.keymove-suggestion-label').nth(2);
  await expect(thirdLabel).toHaveText('zest gamma');
  // The viewport bonus raises delta 10% over gamma, a near tie at the third-place boundary.
  await page.evaluate(() => {
    document.getElementById('stable-gamma')!.style.top = '200vh';
    document.getElementById('stable-delta')!.style.top = '80px';
    document
      .getElementById('dynamic')!
      .insertAdjacentHTML('beforeend', '<p style="position:fixed;top:200vh">zest epsilon</p>');
  });
  await expectSummary(page, 'Text 1 / 5');
  await expect(thirdLabel).toHaveText('zest gamma');
  await page.keyboard.press('t');
  await expect(host.locator('.keymove-suggestion-label mark').first()).toHaveText('zest');
  await expect(thirdLabel).toHaveText('zest gamma');
  // Losing the word-prefix boost is a decisive drop and must allow replacement.
  await page.locator('#stable-gamma').evaluate(element => {
    element.textContent = 'azest gamma';
  });
  await expect(thirdLabel).toHaveText('zest delta');
  await page.keyboard.press('Alt+3');
  await expectSummary(page, 'Text 4 / 5');
  await expect.poll(() => selectionText(page)).toBe('zest delta');
  await setDynamic(page, '');
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
  await host.getByRole('button', { name: 'Switch to actions', exact: true }).click();
  await expectSummary(page, 'Actions 1 / 1');
  await host.getByRole('button', { name: 'Switch to text', exact: true }).click();
  await expectSummary(page, 'Text 1 / 1');
  await expect(input).toHaveValue('nectarine');
  passed.push('Clicking Text/Actions switches mode without clearing the query');
  // The mode button took focus; click back into the input with the query intact.
  await input.click();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#destination');
  passed.push('Enter activates the action nested inside a text block');

  await input.blur();
  await page.keyboard.press('q');
  await expectSummary(page, 'Text 1 / 4');
  await expect(input).toHaveValue('q');
  passed.push('Always-on typing from the host page preserves the first character');

  // Open the actual bundled popup document. This checks its storage writes and
  // cross-context change events; it does not simulate toolbar browser chrome.
  // Opening settings wakes a suspended MV3 worker; its lifetime is not tied to
  // the duration of the browser checks that ran before this point.
  await host.getByRole('button', { name: 'Open KeyMove settings', exact: true }).click();
  const worker = context.serviceWorkers().find(worker => worker.url().endsWith('/background.js'));
  expect(worker, 'Installed extension service worker').toBeDefined();
  const popupURL = new URL('popup.html', worker!.url()).href;
  // action.openPopup creates browser chrome rather than an ordinary Page. Use a
  // browser CDP session only to verify and close that popup; its document and every
  // subsequent interaction use an ordinary tab and Playwright Page APIs.
  const session = await context.browser()!.newBrowserCDPSession();
  try {
    let settingsTarget: string | undefined;
    await expect
      .poll(
        async () => {
          const { targetInfos } = await session.send('Target.getTargets');
          settingsTarget = targetInfos.find(target => target.url === popupURL)?.targetId;
          return settingsTarget !== undefined;
        },
        { message: 'The color K logo opens the extension settings' },
      )
      .toBe(true);
    await session.send('Target.closeTarget', { targetId: settingsTarget! });
  } finally {
    await session.detach();
  }
  passed.push('The color K logo opens the actual extension settings');
  const popup = await openPage(context, popupURL);
  await expect(popup.locator('label').first()).toBeAttached();
  await checkTheme(page, popup);
  passed.push(
    'Appearance persists, syncs to an open page, follows system changes, and keeps explicit overrides',
  );
  await expect(popup.getByLabel('Autohide', { exact: true })).toBeChecked();
  const setCount = (count: number) => popup.getByRole('spinbutton').fill(String(count));
  await checkReturnPosition(page, popup);
  passed.push(
    'Alt+Backspace returns after Tab/Alt+1 and nested scrolling; Escape closes in one press and leaves new page focus alone',
  );
  await checkTooltipsMode(context, origin, popup);
  passed.push(
    'Tooltips mode in Appearance switches full and compact badges live without losing the selected menu, query or numbered shortcuts',
  );
  await focusTab(page);
  await page.keyboard.press('Alt+f');
  await expect(input).toBeFocused();
  await expect.poll(() => barShown(page)).toBe(true);
  await clear(page);
  await setDynamic(
    page,
    Array.from({ length: 30 }, (_, index) => `<p>countsample ${index}</p>`).join(''),
  );
  await type(page, 'countsample');
  await expectSummary(page, 'Text 1 / 30');
  for (const count of [5, 1, 5]) {
    await setCount(count);
    await expect(options).toHaveCount(count);
  }
  for (const number of [4, 5]) {
    await page.keyboard.press(`Alt+${number}`);
    await expect(options.nth(number - 1)).toHaveAttribute('aria-selected', 'true');
  }
  expect(
    await suggestions.evaluate(panel => {
      const rect = panel.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    }),
  ).toBe(true);
  await options.nth(4).click();
  const resolvedTheme = await host.getAttribute('data-keymove-theme');
  expect(['light', 'dark']).toContain(resolvedTheme);
  await expect(options.nth(4)).toHaveCSS(
    'background-color',
    resolvedTheme === 'light' ? 'rgb(225, 229, 237)' : 'rgb(65, 65, 65)',
  );
  await setCount(3);
  await expect(options).toHaveCount(3);
  await input.click();
  await clear(page);
  await setDynamic(page, '');
  passed.push(
    'Suggestion count updates live within 1–5; Alt+4/5 select rows and selected rows have a gray background',
  );
  await settingsTab(popup, 'Appearance');
  const lock = popup.getByLabel('Lock position and size', { exact: true });
  const container = host.locator('#keymove-container');
  const resizeHandles = host.locator('.keymove-resize-handle');
  await lock.click();
  await expect(container).toHaveAttribute('data-layout-locked', 'true');
  await expect(resizeHandles).toHaveCount(0);
  await expect(popup.locator('.keymove-position-cell').first()).toBeDisabled();
  await focusTab(page);
  await page.keyboard.press('Alt+f');
  await expect(input).toBeFocused();
  await clear(page);
  await type(page, 'qxyz');
  await expectSummary(page, 'Text 1 / 1');
  // The reloaded settings document hydrates the saved lock.
  await popup.reload();
  await settingsTab(popup, 'Appearance');
  await expect(lock).toBeChecked();
  await lock.click();
  await expect(container).toHaveAttribute('data-layout-locked', 'false');
  await expect(resizeHandles).toHaveCount(2);
  passed.push(
    'Layout lock persists when settings reopen and disables/re-enables resizing in the open page',
  );
  await setActivation(popup, 'shortcut');
  await expect(bar).toHaveAttribute('data-always-on', 'false');
  await popup.reload();
  await expect(
    popup.getByRole('combobox', { name: 'Default activation', exact: true }),
  ).toHaveValue('shortcut');
  await setCheckbox(popup, 'Autohide', true);
  await expect(popup.getByLabel('Autohide', { exact: true })).toBeChecked();
  await focusTab(page);
  await page.keyboard.press('Alt+f');
  await clear(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => barShown(page)).toBe(false);
  await page.keyboard.press('q');
  expect(await barShown(page), 'Always on disabled must not summon a hidden bar').toBe(false);
  await page.keyboard.press('Alt+f');
  await expect.poll(() => barShown(page)).toBe(true);
  await expect(input).toBeFocused();
  await type(page, 'qxyz');
  await expectSummary(page, 'Text 1 / 1');
  passed.push(
    'Actual popup settings persist after reload and propagate to an open tab; hidden bar reopens with Alt+F',
  );
  await setActivation(popup, 'type');
  await setCheckbox(popup, 'Autohide', true);
  await checkSiteSettings(page, popup);
  passed.push(
    'Opening shortcut remaps live; shortcut-only sites preserve page typing; paused sites release all keys; saved overrides can be removed to resume defaults',
  );
  await checkShowSearch(page, popup);
  passed.push(
    'Settings header opens and focuses the source page searchbar; footer links have equal widths and the website destination',
  );
  return { passed, measurements };
}
