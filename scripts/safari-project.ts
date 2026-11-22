import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

type ProjectSettings = { bundleId: string; version: string };

// Apple's packager derives the app's identifier from the prefix of --bundle-identifier plus
// the app name (eu.example.keymove becomes eu.example.KeyMove) but gives the extension
// <bundle-identifier>.Extension, so Xcode refuses to build an extension whose identifier
// does not start with the app's. It also leaves the app version at 1.0.
export function patchProjectSettings(
  project: string,
  { bundleId, version }: ProjectSettings,
): string {
  const extensionId = `${bundleId}.Extension`;
  const identifiers: string[] = [];
  let patched = rewriteSetting(project, 'PRODUCT_BUNDLE_IDENTIFIER', value => {
    const next = value === extensionId ? value : bundleId;
    identifiers.push(next);
    return next;
  });
  if (!identifiers.includes(bundleId) || !identifiers.includes(extensionId)) {
    throw new Error(
      `Expected an app target and an extension target identified as ${extensionId}; check PRODUCT_BUNDLE_IDENTIFIER in Xcode.`,
    );
  }
  let versions = 0;
  patched = rewriteSetting(patched, 'MARKETING_VERSION', () => {
    versions += 1;
    return version;
  });
  if (versions === 0) throw new Error('Found no MARKETING_VERSION to set; set it in Xcode.');
  return patched;
}

// Xcode 27 writes project.xcproj with quoted JSON-style settings; earlier Xcode writes
// project.pbxproj with `KEY = value;` settings.
function rewriteSetting(project: string, key: string, rewrite: (value: string) => string) {
  return project
    .replace(
      new RegExp(`("${key}"\\s*:\\s*")([^"]*)(")`, 'g'),
      (_match, before: string, value: string, after: string) => before + rewrite(value) + after,
    )
    .replace(
      new RegExp(`(\\b${key}\\s*=\\s*)("?)([^";\\s]*)\\2(\\s*;)`, 'g'),
      (_match, before: string, quote: string, value: string, after: string) =>
        before + quote + rewrite(value) + quote + after,
    );
}

function manifestVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(path.join(root, '.output/safari-mv3/manifest.json'), 'utf8'),
  );
  const version =
    typeof manifest === 'object' && manifest !== null && 'version' in manifest
      ? manifest.version
      : null;
  if (typeof version !== 'string' || !/^\d+(?:\.\d+){0,2}$/.test(version)) {
    throw new Error('The Safari manifest has no usable version; rebuild with pnpm build:safari.');
  }
  return version;
}

function patchGeneratedProject(settings: ProjectSettings) {
  const projectDirectory = path.join(root, '.output/safari-xcode', identity.name);
  const bundle = path.join(projectDirectory, `${identity.name}.xcodeproj`);
  const file = ['project.xcproj', 'project.pbxproj']
    .map(name => path.join(bundle, name))
    .find(candidate => existsSync(candidate));
  if (!file) throw new Error(`Found no project file in ${bundle}.`);
  writeFileSync(file, patchProjectSettings(readFileSync(file, 'utf8'), settings));
  const controller = path.join(projectDirectory, identity.name, 'ViewController.swift');
  if (
    existsSync(controller) &&
    !readFileSync(controller, 'utf8').includes(`"${settings.bundleId}.Extension"`)
  ) {
    throw new Error(
      `ViewController.swift does not refer to ${settings.bundleId}.Extension; fix extensionBundleIdentifier in Xcode.`,
    );
  }
}

if (import.meta.main) {
  try {
    if (process.platform !== 'darwin') {
      throw new Error(
        'Xcode project generation requires macOS and Xcode. On this OS, run pnpm zip:safari and use the macOS-only App Store Connect route in docs/safari.md.',
      );
    }
    const args = safariProjectArgs(process.argv[2] ?? '');
    if (process.argv.length !== 3)
      throw new Error('Usage: pnpm safari:project <bundle-identifier>');
    if (!existsSync(path.join(root, '.output/safari-mv3/manifest.json'))) {
      throw new Error('Run pnpm build:safari before generating the Xcode project.');
    }
    if (existsSync(path.join(root, '.output/safari-xcode'))) {
      throw new Error(
        'Move the existing .output/safari-xcode project aside before generating another.',
      );
    }
    const version = manifestVersion();
    const result = spawnSync('xcrun', args, {
      cwd: root,
      stdio: 'inherit',
      timeout: 120_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`Safari packager failed (${result.status ?? result.signal}).`);
    try {
      patchGeneratedProject({ bundleId: process.argv[2] ?? '', version });
    } catch (error) {
      throw new Error(
        `Created the Xcode project but could not correct its identifiers and version: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    console.log(
      'Created the macOS-only Xcode project. Signing, Safari testing and distribution remain manual; see docs/safari.md.',
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
