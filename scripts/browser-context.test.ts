// @vitest-environment node
import { expect, test } from 'vitest';
import { captureBrowser, extensionLaunchArgs, testBrowser } from './browser-context.js';
import { chooseTestBrowser } from './test-browser.js';
import type { findBrowser } from './preview-extension.js';

test('selects bundled Chromium by default and rejects unknown browsers', () => {
  expect(testBrowser({})).toBe('chromium');
  expect(testBrowser({ KEYMOVE_TEST_BROWSER: 'vivaldi' })).toBe('vivaldi');
  expect(() => testBrowser({ KEYMOVE_TEST_BROWSER: 'firefox' })).toThrow(/chromium, vivaldi/);
  // Captures keep using installed Vivaldi unless a run names another browser.
  expect(captureBrowser({})).toBe('vivaldi');
  expect(captureBrowser({ KEYMOVE_TEST_BROWSER: 'chromium' })).toBe('chromium');
});

test('loads the snapshot by flag, except in branded Chrome, and uses the Vivaldi shell', () => {
  expect(extensionLaunchArgs('/tmp/build', 'chromium')).toEqual([
    '--disable-extensions-except=/tmp/build',
    '--load-extension=/tmp/build',
  ]);
  expect(extensionLaunchArgs('/tmp/build', 'vivaldi')).toEqual([
    '--disable-vivaldi',
    '--disable-extensions-except=/tmp/build',
    '--load-extension=/tmp/build',
  ]);
  expect(extensionLaunchArgs('/tmp/build', 'chrome')).toEqual([
    '--enable-unsafe-extension-debugging',
  ]);
});

test('chooses the installed browser like the preview, but never Firefox', () => {
  const installed =
    (name: 'vivaldi' | 'chrome' | 'firefox'): typeof findBrowser =>
    requested => {
      if (requested !== 'auto' && requested !== name) throw new Error(`No ${requested}`);
      return { name, binary: `/bin/${name}` };
    };
  expect(chooseTestBrowser([], installed('vivaldi'))).toBe('vivaldi');
  expect(chooseTestBrowser(['--grep', 'frames'], installed('chrome'))).toBe('chrome');
  expect(() => chooseTestBrowser([], installed('firefox'))).toThrow(/preview:firefox/);
  // Bundled Chromium needs no installed browser.
  expect(chooseTestBrowser(['--browser=chromium'], installed('firefox'))).toBe('chromium');
  expect(() => chooseTestBrowser(['--browser=chrome'], installed('vivaldi'))).toThrow(/No chrome/);
  expect(() => chooseTestBrowser(['--browser=safari'], installed('vivaldi'))).toThrow(
    /Unknown test browser/,
  );
});
