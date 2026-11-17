import { spawn } from 'node:child_process';
import path from 'node:path';
import { testBrowsers } from './browser-context.ts';
import type { TestBrowser } from './browser-context.ts';
import { findBrowser } from './preview-extension.ts';

const root = path.resolve(import.meta.dirname, '..');

/**
 * Chooses the browser for `pnpm test:browser`: an explicit --browser, otherwise the first
 * installed of Vivaldi and Chrome, the same preference order as the interactive preview.
 */
export function chooseTestBrowser(
  args: string[],
  find: typeof findBrowser = findBrowser,
): TestBrowser {
  const choice = args.find(arg => arg.startsWith('--browser='))?.slice('--browser='.length);
  if (choice === undefined || choice === 'auto') {
    const browser = find('auto');
    if (browser.name === 'firefox') {
      throw new Error(
        'Automated extension tests need Vivaldi or Chrome, or --browser=chromium for Playwright Chromium. Use pnpm preview:firefox for manual Firefox checks.',
      );
    }
    return browser.name;
  }
  const browser = testBrowsers.find(name => name === choice);
  if (!browser)
    throw new Error(`Unknown test browser: ${choice}. Choose ${testBrowsers.join(', ')}.`);
  if (browser !== 'chromium') find(browser);
  return browser;
}

export async function runBrowserTests(args: string[]): Promise<void> {
  const browser = chooseTestBrowser(args);
  console.log(`Running the Playwright browser suite in ${browser}.`);
  const run = (script: string, scriptArgs: string[]) =>
    new Promise<void>((resolve, reject) => {
      // Argument arrays avoid shell interpretation of paths and Playwright filters.
      const child = spawn(process.execPath, [script, ...scriptArgs], {
        cwd: root,
        env: { ...process.env, KEYMOVE_TEST_BROWSER: browser },
        stdio: 'inherit',
        windowsHide: true,
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`${path.basename(script)} exited with ${signal ?? code}.`));
      });
    });
  if (!args.includes('--no-build')) {
    await run(path.join(root, 'node_modules/wxt/bin/wxt.mjs'), ['build', '-b', 'chrome', '--mv3']);
  }
  await run(path.join(root, 'node_modules/@playwright/test/cli.js'), [
    'test',
    ...args.filter(arg => arg !== '--no-build' && !arg.startsWith('--browser=')),
  ]);
}

if (import.meta.main) {
  void runBrowserTests(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
