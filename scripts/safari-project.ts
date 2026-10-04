import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import identity from '../src/extension_identity.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function safariProjectArgs(bundleId: string, projectRoot = root): string[] {
  if (!/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(bundleId)) {
    throw new Error('Pass a reverse-DNS bundle identifier, for example eu.example.keymove.');
  }
  return [
    'safari-web-extension-packager',
    path.join(projectRoot, '.output/safari-mv3'),
    '--project-location',
    path.join(projectRoot, '.output/safari-xcode'),
    '--app-name',
    identity.name,
    '--bundle-identifier',
    bundleId,
    '--macos-only',
    '--swift',
    '--copy-resources',
    '--no-open',
    '--no-prompt',
  ];
}

if (import.meta.main) {
  try {
    if (process.platform !== 'darwin') {
      throw new Error(
        'Xcode project generation requires macOS and Xcode. On this OS, run yarn zip:safari and use the macOS-only App Store Connect route in docs/safari.md.',
      );
    }
    const args = safariProjectArgs(process.argv[2] ?? '');
    if (process.argv.length !== 3)
      throw new Error('Usage: yarn safari:project <bundle-identifier>');
    if (!existsSync(path.join(root, '.output/safari-mv3/manifest.json'))) {
      throw new Error('Run yarn build:safari before generating the Xcode project.');
    }
    if (existsSync(path.join(root, '.output/safari-xcode'))) {
      throw new Error(
        'Move the existing .output/safari-xcode project aside before generating another.',
      );
    }
    const result = spawnSync('xcrun', args, {
      cwd: root,
      stdio: 'inherit',
      timeout: 120_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`Safari packager failed (${result.status ?? result.signal}).`);
    console.log(
      'Created the macOS-only Xcode project. Signing, Safari testing and distribution remain manual; see docs/safari.md.',
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
