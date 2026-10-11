import { spawn } from 'node:child_process';
import path from 'node:path';
import { findBrowser } from './preview-extension.ts';

const root = path.resolve(import.meta.dirname, '..');

export async function runBrowserTests(args: string[]): Promise<void> {
  const choice =
    args.find(arg => arg.startsWith('--browser='))?.slice('--browser='.length) ?? 'auto';
  const browser = findBrowser(choice);
  if (browser.name === 'firefox') {
    throw new Error(
      'Automated extension tests require Vivaldi or Chrome. Use pnpm preview:firefox for manual checks.',
    );
  }
  const run = (script: string, scriptArgs: string[]) =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [script, ...scriptArgs], {
        cwd: root,
        env: { ...process.env, KEYMOVE_TEST_BROWSER: browser.name },
        stdio: 'inherit',
        windowsHide: true,
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`Browser tests exited with ${signal ?? code}.`));
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
