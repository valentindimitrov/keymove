import { spawn } from 'node:child_process';
import { accessSync, constants, cpSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import webExt from 'web-ext';
import type { ChromiumClient } from 'web-ext';

const projectRoot = path.resolve(import.meta.dirname, '..');
const repositoryUrl = 'https://github.com/valentindimitrov/keymove';
const browserOrder = ['vivaldi', 'chrome', 'firefox'] as const;
type Browser = (typeof browserOrder)[number];

export function createPreviewCopy(buildDirectory: string): {
  directory: string;
  cleanup: () => void;
} {
  const temporaryRoot = path.resolve(tmpdir());
  const directory = mkdtempSync(path.join(temporaryRoot, 'keymove-preview-'));
  const cleanup = () => {
    // Only remove the temporary directory created by this invocation.
    if (
      path.dirname(directory) !== temporaryRoot ||
      !path.basename(directory).startsWith('keymove-preview-')
    ) {
      throw new Error('Refusing to remove a directory outside the preview temporary location.');
    }
    rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
  };
  try {
    cpSync(buildDirectory, directory, { recursive: true });
  } catch (error) {
    cleanup();
    throw error;
  }
  return { directory, cleanup };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function openRepositoryPage(client: ChromiumClient): Promise<string> {
  // Vivaldi can replace its command-line start URL during first-run initialization.
  // Use the runner's existing connection only after it has installed the extension.
  const created = await client.sendCommand('Target.createTarget', { url: repositoryUrl });
  if (!isObject(created) || typeof created['targetId'] !== 'string') {
    throw new Error('The browser did not return a repository tab ID.');
  }
  const targetId = created['targetId'];
  const deadline = Date.now() + 30_000;
  let title = '';
  let lastPage = '';
  while (Date.now() < deadline) {
    const result = await client.sendCommand('Target.getTargetInfo', { targetId });
    const info = isObject(result) ? result['targetInfo'] : undefined;
    if (isObject(info)) lastPage = `${String(info['url'])} (${String(info['title'])})`;
    if (
      isObject(info) &&
      (info['url'] === repositoryUrl || info['url'] === `${repositoryUrl}/`) &&
      typeof info['title'] === 'string' &&
      info['title'].includes('GitHub')
    ) {
      title = info['title'];
      break;
    }
    await delay(200);
  }
  if (!title)
    throw new Error(`GitHub did not finish opening within 30 seconds. Last page: ${lastPage}`);

  const result = await client.sendCommand('Target.getTargets', {});
  const targets = isObject(result) ? result['targetInfos'] : undefined;
  if (Array.isArray(targets)) {
    for (const target of targets) {
      if (
        isObject(target) &&
        target['type'] === 'page' &&
        typeof target['targetId'] === 'string' &&
        target['targetId'] !== targetId &&
        typeof target['url'] === 'string' &&
        /^(?:vivaldi:welcome\/?|vivaldi:\/\/welcome\/?|chrome-extension:\/\/mpognobbkildjkofajifpdfhcoklimli\/components\/welcome\/welcome\.html)$/.test(
          target['url'],
        )
      ) {
        await client.sendCommand('Target.closeTarget', { targetId: target['targetId'] });
      }
    }
  }
  await client.sendCommand('Target.activateTarget', { targetId });
  return title;
}

// Vivaldi 8's UI checks completed pages independently of has_seen_welcome_page.
// Pass the list through the JS API: web-ext's CLI parses arrays as strings.
export const vivaldiPreviewPreferences = {
  'vivaldi.startup.has_seen_welcome_page': true,
  'vivaldi.system.show_exit_confirmation_dialog': false,
  'vivaldi.welcome.read_pages': [
    'intro',
    'a11y_settings',
    'account',
    'control',
    'import_data',
    'tracker_and_ad',
    'layouts',
    'personalize',
    'panel_internal',
    'panel_apps',
    'welcome_feature_amount',
    'mail_setup',
  ],
};

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

export function findBrowser(
  requested: string = 'auto',
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  available: (file: string) => boolean = isExecutable,
): { name: Browser; binary: string } {
  if (requested !== 'auto' && !browserOrder.some(name => name === requested)) {
    throw new Error(`Unknown browser: ${requested}. Choose auto, vivaldi, chrome, or firefox.`);
  }
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const relativeWindowsPaths = {
    vivaldi: 'Vivaldi/Application/vivaldi.exe',
    chrome: 'Google/Chrome/Application/chrome.exe',
    firefox: 'Mozilla Firefox/firefox.exe',
  };
  const appNames = { vivaldi: 'Vivaldi', chrome: 'Google Chrome', firefox: 'Firefox' };
  const executableNames = {
    vivaldi: ['vivaldi', 'vivaldi-stable'],
    chrome: ['google-chrome', 'google-chrome-stable', 'chrome'],
    firefox: ['firefox'],
  };
  for (const name of browserOrder) {
    if (requested !== 'auto' && requested !== name) continue;
    const override = env[`KEYMOVE_${name.toUpperCase()}_BINARY`];
    if (override) {
      if (!paths.isAbsolute(override) || !available(override)) {
        throw new Error(
          `KEYMOVE_${name.toUpperCase()}_BINARY must name an existing absolute executable.`,
        );
      }
      return { name, binary: override };
    }
    const candidates: string[] = [];
    if (platform === 'win32') {
      for (const root of [env['LOCALAPPDATA'], env['ProgramFiles'], env['ProgramFiles(x86)']]) {
        if (root) candidates.push(paths.join(root, relativeWindowsPaths[name]));
      }
    } else if (platform === 'darwin') {
      for (const root of ['/Applications', paths.join(homedir(), 'Applications')]) {
        candidates.push(
          paths.join(
            root,
            `${appNames[name]}.app`,
            'Contents/MacOS',
            name === 'firefox' ? 'firefox' : appNames[name],
          ),
        );
      }
    }
    for (const directory of (env['PATH'] ?? '').split(platform === 'win32' ? ';' : ':')) {
      if (!paths.isAbsolute(directory)) continue;
      for (const executable of platform === 'win32' ? [`${name}.exe`] : executableNames[name]) {
        candidates.push(paths.join(directory, executable));
      }
    }
    const binary = candidates.find(available);
    if (binary) return { name, binary };
  }
  throw new Error(
    `No ${requested === 'auto' ? 'Vivaldi, Chrome, or Firefox' : requested} executable found. Set KEYMOVE_<BROWSER>_BINARY for a custom installation.`,
  );
}

function run(script: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Argument arrays avoid shell interpretation of executable paths and URLs.
    const child = spawn(process.execPath, [script, ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(script)} exited with ${signal ?? code}.`));
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const requested =
    args.find(arg => arg.startsWith('--browser='))?.slice('--browser='.length) ?? 'auto';
  for (const arg of args) {
    if (arg !== '--no-build' && !arg.startsWith('--browser='))
      throw new Error(`Unknown argument: ${arg}`);
  }
  const browser = findBrowser(requested);
  const target = browser.name === 'firefox' ? 'firefox' : 'chrome';
  const sourceDir = path.join(projectRoot, '.output', `${target}-mv3`);
  console.log(`Using ${browser.name}: ${browser.binary}`);
  if (!args.includes('--no-build')) {
    await run(path.join(projectRoot, 'node_modules/wxt/bin/wxt.mjs'), [
      'build',
      '-b',
      target,
      '--mv3',
    ]);
  }
  if (!existsSync(path.join(sourceDir, 'manifest.json'))) {
    throw new Error(`Build missing at ${sourceDir}. Run yarn preview to build it first.`);
  }
  const preview = createPreviewCopy(sourceDir);
  process.once('exit', () => {
    try {
      preview.cleanup();
    } catch (error) {
      console.error('Could not remove the temporary preview build:', error);
    }
  });
  console.log(`Dedicated preview build: ${preview.directory}`);
  console.log(
    `Opening ${repositoryUrl} in a fresh test profile. Close the test browser or press Ctrl+C to end this session.`,
  );
  const runner = await webExt.cmd.run(
    {
      sourceDir: preview.directory,
      target: target === 'firefox' ? 'firefox-desktop' : 'chromium',
      ...(target === 'firefox' ? { firefox: browser.binary } : { chromiumBinary: browser.binary }),
      startUrl: [target === 'firefox' ? repositoryUrl : 'about:blank'],
      noReload: true,
      noInput: true,
      ...(browser.name === 'vivaldi' ? { chromiumPref: vivaldiPreviewPreferences } : {}),
    },
    { shouldExitProgram: true },
  );
  if (target === 'chrome') {
    const client = runner.extensionRunners[0]?.cdp;
    if (!client) throw new Error('The browser launcher did not provide a Chromium connection.');
    console.log(`Opened and focused: ${await openRepositoryPage(client)}`);
  }
}

if (import.meta.main) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
