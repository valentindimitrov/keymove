import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, inflateRawSync } from 'node:zlib';
import EXTENSION_IDENTITY from '../src/extension_identity.ts';

// This module imports only Node built-ins and the identity constants, so the release
// signing job can run it from a fresh checkout without installing dependencies.

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SANDBOX_SUPPORT_URL = 'https://buy.stripe.com/test_cNieVe2GhbdMaeq6sd5os00';

type BuildTarget = {
  name: string;
  browser: 'chrome' | 'firefox' | 'safari';
  directory: string;
  manifestVersion: 3;
  backgroundType: 'service-worker' | 'script';
  isFirefox?: boolean;
};

type ContentScriptManifest = {
  matches: string[];
  js: string[];
  css: string[];
  all_frames?: boolean;
};

type BuildManifest = {
  manifest_version: number;
  name: string;
  version: string;
  content_scripts: ContentScriptManifest[];
  action?: unknown;
  browser_action?: unknown;
  permissions: string[];
  host_permissions: string[];
  background: {
    service_worker?: string;
    scripts?: string[];
  };
  browser_specific_settings?: {
    gecko?: {
      id?: string;
      data_collection_permissions?: { required?: string[] };
    };
  };
};

const targets: BuildTarget[] = [
  {
    name: 'Chromium/Vivaldi',
    browser: 'chrome',
    directory: '.output/chrome-mv3',
    manifestVersion: 3,
    backgroundType: 'service-worker',
  },
  {
    name: 'Firefox',
    browser: 'firefox',
    directory: '.output/firefox-mv3',
    manifestVersion: 3,
    backgroundType: 'script',
    isFirefox: true,
  },
  {
    name: 'Safari (macOS; runtime unverified)',
    browser: 'safari',
    directory: '.output/safari-mv3',
    manifestVersion: 3,
    backgroundType: 'service-worker',
  },
];

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function parseJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${path.relative(projectRoot, filePath)} is not valid JSON: ${message}`);
  }
}

function readPackageVersion(root: string): string {
  const packagePath = path.join(root, 'package.json');
  const packageJson = parseJsonFile(packagePath);
  requireCondition(isObject(packageJson), 'package.json must contain an object');
  requireCondition(typeof packageJson['version'] === 'string', 'package.json.version is missing');
  return packageJson['version'];
}

function validateManifestShape(value: unknown, targetName: string): asserts value is BuildManifest {
  requireCondition(isObject(value), `${targetName}: manifest must contain an object`);
  requireCondition(
    typeof value['manifest_version'] === 'number',
    `${targetName}: manifest_version must be a number`,
  );
  requireCondition(typeof value['name'] === 'string', `${targetName}: name must be a string`);
  requireCondition(typeof value['version'] === 'string', `${targetName}: version must be a string`);
  requireCondition(
    Array.isArray(value['content_scripts']) && value['content_scripts'].length === 2,
    `${targetName}: UI and frame helper content scripts are required`,
  );

  const contentScript: unknown = value['content_scripts'][0];
  requireCondition(isObject(contentScript), `${targetName}: content script must be an object`);
  requireCondition(
    isStringArray(contentScript['matches']),
    `${targetName}: content script matches must be a string array`,
  );
  requireCondition(
    isStringArray(contentScript['js']),
    `${targetName}: content script js must be a string array`,
  );
  requireCondition(
    isStringArray(contentScript['css']),
    `${targetName}: content script css must be a string array`,
  );
  const helper = value['content_scripts'][1];
  requireCondition(
    isObject(helper) &&
      isStringArray(helper['matches']) &&
      isStringArray(helper['js']) &&
      helper['all_frames'] === true,
    `${targetName}: frame helper manifest is invalid`,
  );
  requireCondition(
    isStringArray(value['permissions']),
    `${targetName}: permissions must be a string array`,
  );
  requireCondition(
    isStringArray(value['host_permissions']),
    `${targetName}: host_permissions must be a string array`,
  );
  requireCondition(isObject(value['background']), `${targetName}: background must be an object`);

  const browserSettings = value['browser_specific_settings'];
  if (browserSettings !== undefined) {
    requireCondition(
      isObject(browserSettings),
      `${targetName}: browser_specific_settings must be an object`,
    );
    const gecko = browserSettings['gecko'];
    if (gecko !== undefined) {
      requireCondition(isObject(gecko), `${targetName}: gecko settings must be an object`);
      const collectionPermissions = gecko['data_collection_permissions'];
      if (collectionPermissions !== undefined) {
        requireCondition(
          isObject(collectionPermissions),
          `${targetName}: data collection permissions must be an object`,
        );
        requireCondition(
          isStringArray(collectionPermissions['required']),
          `${targetName}: required data collection permissions must be a string array`,
        );
      }
    }
  }
}

/**
 * The packaged Firefox ID must be exactly the one the build was configured with: equal to
 * WXT_FIREFOX_EXTENSION_ID when it is set, and absent when it is not. CI sets a placeholder
 * ID so pull requests exercise the configured path without a repository variable.
 */
function validateFirefoxId(manifest: BuildManifest, targetName: string) {
  const expected = process.env['WXT_FIREFOX_EXTENSION_ID'] || undefined;
  const actual = manifest.browser_specific_settings?.gecko?.id;
  requireCondition(
    actual === expected,
    expected
      ? `${targetName}: extension ID does not match WXT_FIREFOX_EXTENSION_ID`
      : `${targetName}: extension ID is packaged although WXT_FIREFOX_EXTENSION_ID is not set`,
  );
}

function resolveOutputPath(buildDirectory: string, relativePath: string) {
  requireCondition(
    !/^[a-z][a-z\d+.-]*:/i.test(relativePath) && !relativePath.startsWith('//'),
    'Build resources must be local',
  );
  const resolved = path.resolve(buildDirectory, relativePath.replace(/^[/\\]+/, ''));
  requireCondition(
    resolved.startsWith(path.resolve(buildDirectory) + path.sep),
    'Build resource escapes its output directory',
  );
  return resolved;
}

function readRequiredFile(buildDirectory: string, relativePath: string, targetName: string) {
  const filePath = resolveOutputPath(buildDirectory, relativePath);
  requireCondition(fs.existsSync(filePath), `${targetName}: ${relativePath} is missing`);
  return fs.readFileSync(filePath, 'utf8');
}

function validatePopup(buildDirectory: string, action: unknown, targetName: string) {
  requireCondition(
    isObject(action) && action['default_popup'] === 'popup.html',
    `${targetName}: settings popup must be popup.html`,
  );
  const html = readRequiredFile(buildDirectory, action['default_popup'], targetName);
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(
    match => match[1]!,
  );
  const styles = [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter(match => /\brel=["']stylesheet["']/i.test(match[0]))
    .map(match => /\bhref=["']([^"']+)["']/i.exec(match[0])?.[1]);
  requireCondition(
    scripts.length > 0 && styles.length > 0,
    `${targetName}: popup script or stylesheet reference is missing`,
  );
  for (const file of styles) {
    requireCondition(file, `${targetName}: popup stylesheet href is missing`);
    readRequiredFile(buildDirectory, file, targetName);
  }
  const visited = new Set<string>();
  const sources: string[] = [];
  const visitScript = (file: string) => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = readRequiredFile(buildDirectory, file, targetName);
    sources.push(source);
    // Vite emits local ES module imports when the popup is split into chunks.
    for (const match of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)) {
      const specifier = match[1]!;
      requireCondition(
        specifier.startsWith('.') || specifier.startsWith('/'),
        `${targetName}: popup contains a non-local import`,
      );
      visitScript(
        specifier.startsWith('/')
          ? specifier
          : path.posix.join(path.posix.dirname(file), specifier),
      );
    }
  };
  scripts.forEach(visitScript);
  return sources.join('\n');
}

function validateTarget(target: BuildTarget, packageVersion: string, root: string) {
  const buildDirectory = path.join(root, target.directory);
  const manifestPath = path.join(buildDirectory, 'manifest.json');
  requireCondition(fs.existsSync(manifestPath), `${target.name}: manifest.json is missing`);

  const license = readRequiredFile(buildDirectory, 'LICENSE', target.name);
  requireCondition(
    license === fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    `${target.name}: bundled LICENSE must match the repository license`,
  );

  const manifest = parseJsonFile(manifestPath);
  validateManifestShape(manifest, target.name);
  requireCondition(
    manifest.manifest_version === target.manifestVersion,
    `${target.name}: expected Manifest V${target.manifestVersion}`,
  );
  requireCondition(
    manifest.name === EXTENSION_IDENTITY.name,
    `${target.name}: extension name is incorrect`,
  );
  requireCondition(
    manifest.version === packageVersion,
    `${target.name}: extension version does not match package.json`,
  );
  const contentScript = manifest.content_scripts[0]!;
  const helper = manifest.content_scripts[1]!;
  requireCondition(
    contentScript.all_frames === false,
    `${target.name}: the UI must remain top-frame-only`,
  );
  requireCondition(
    helper.matches.includes('<all_urls>') &&
      helper.js.length === 1 &&
      helper.js[0] === 'content-scripts/frames.js',
    `${target.name}: frame helper output is missing`,
  );
  const frameBundle = readRequiredFile(buildDirectory, helper.js[0], target.name);
  requireCondition(
    !/\brequire\s*\(/.test(frameBundle),
    `${target.name}: frame helper contains CommonJS`,
  );
  requireCondition(
    contentScript.matches.includes('<all_urls>'),
    `${target.name}: content script host matches are missing`,
  );
  requireCondition(
    contentScript.js.length === 1 && contentScript.js[0] === 'content-scripts/content.js',
    `${target.name}: unexpected content script output path`,
  );
  requireCondition(
    contentScript.css.length === 1 && contentScript.css[0] === 'content-scripts/content.css',
    `${target.name}: unexpected content stylesheet output path`,
  );

  const contentBundle = readRequiredFile(buildDirectory, contentScript.js[0], target.name);
  const pageStyles = readRequiredFile(buildDirectory, contentScript.css[0], target.name);
  requireCondition(
    pageStyles.includes('::highlight(keymove-search-results)'),
    `${target.name}: page-level CSS highlight styles are missing`,
  );
  requireCondition(
    contentBundle.includes('attachShadow'),
    `${target.name}: Shadow DOM mounting is missing`,
  );
  requireCondition(
    contentBundle.includes('MutationObserver'),
    `${target.name}: incremental page indexing is missing`,
  );
  const popupBundle = validatePopup(buildDirectory, manifest.action, target.name);
  requireCondition(
    popupBundle.includes(EXTENSION_IDENTITY.supportUrl),
    `${target.name}: production tip link is missing from the settings popup`,
  );
  requireCondition(
    !popupBundle.includes(SANDBOX_SUPPORT_URL),
    `${target.name}: sandbox tip link must not ship in production`,
  );
  requireCondition(!manifest.browser_action, `${target.name}: legacy browser action is present`);
  requireCondition(
    manifest.permissions?.includes('scripting'),
    `${target.name}: scripting permission is missing`,
  );
  requireCondition(
    manifest.permissions?.includes('storage'),
    `${target.name}: storage permission is missing`,
  );
  requireCondition(
    !manifest.permissions?.includes('<all_urls>'),
    `${target.name}: MV2-style host permission is present`,
  );
  requireCondition(
    manifest.host_permissions?.includes('*://*/*'),
    `${target.name}: host permissions are missing`,
  );

  let backgroundPath;
  if (target.backgroundType === 'service-worker') {
    requireCondition(
      manifest.background?.service_worker,
      `${target.name}: service worker is missing`,
    );
    backgroundPath = manifest.background.service_worker;
  } else {
    requireCondition(
      Array.isArray(manifest.background?.scripts) && manifest.background.scripts.length === 1,
      `${target.name}: background script is missing`,
    );
    backgroundPath = manifest.background.scripts[0];
  }

  if (target.isFirefox) {
    requireCondition(
      manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required?.includes(
        'none',
      ),
      `${target.name}: no-data-collection declaration is missing`,
    );

    validateFirefoxId(manifest, target.name);
  } else {
    requireCondition(
      !manifest.browser_specific_settings?.gecko,
      `${target.name}: Firefox-only settings must not be packaged`,
    );
  }

  requireCondition(
    typeof backgroundPath === 'string',
    `${target.name}: background path is invalid`,
  );
  const backgroundBundle = readRequiredFile(buildDirectory, backgroundPath, target.name);
  const bundledSource = `${backgroundBundle}\n${contentBundle}\n${popupBundle}`;
  requireCondition(
    !/\brequire(?:\.context)?\s*\(/.test(bundledSource),
    `${target.name}: unresolved CommonJS require call is bundled`,
  );
  ['.browserAction', '.tabs.executeScript', '.tabs.insertCSS'].forEach(legacyApi => {
    requireCondition(
      !backgroundBundle.includes(legacyApi),
      `${target.name}: legacy MV2 API "${legacyApi}" is still bundled`,
    );
  });

  ['login.html', 'login.js', 'login.css', 'store-listings'].forEach(removedFile => {
    requireCondition(
      !fs.existsSync(path.join(buildDirectory, removedFile)),
      `${target.name}: ${removedFile} should not be packaged`,
    );
  });

  console.log(
    `Validated ${target.name} build ${manifest.version} (MV${manifest.manifest_version}).`,
  );
}

const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_CENTRAL_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

/**
 * Reads every file in a ZIP archive into memory. Release archives are small, so this
 * deliberately supports only what WXT writes: stored or deflated entries without ZIP64,
 * encryption or multiple disks. Names, sizes and CRC-32 values are all checked.
 */
export function readZip(archive: Buffer, label = 'ZIP archive'): Map<string, Buffer> {
  const searchStart = Math.max(0, archive.length - 0xffff - 22);
  let end = -1;
  for (let offset = archive.length - 22; offset >= searchStart; offset--) {
    if (archive.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      end = offset;
      break;
    }
  }
  requireCondition(end >= 0, `${label}: not a ZIP archive`);
  const entryCount = archive.readUInt16LE(end + 10);
  const directorySize = archive.readUInt32LE(end + 12);
  const directoryOffset = archive.readUInt32LE(end + 16);
  requireCondition(
    archive.readUInt16LE(end + 4) === 0 &&
      archive.readUInt16LE(end + 6) === 0 &&
      archive.readUInt16LE(end + 8) === entryCount,
    `${label}: multi-disk archives are not supported`,
  );
  requireCondition(
    entryCount !== 0xffff && directoryOffset !== 0xffffffff,
    `${label}: ZIP64 archives are not supported`,
  );
  requireCondition(
    directoryOffset + directorySize <= end,
    `${label}: central directory is out of bounds`,
  );

  const files = new Map<string, Buffer>();
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index++) {
    requireCondition(
      cursor + 46 <= end && archive.readUInt32LE(cursor) === ZIP_CENTRAL_HEADER,
      `${label}: central directory entry ${index} is malformed`,
    );
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const checksum = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const size = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;

    requireCondition(
      name.length > 0 &&
        !name.includes('\\') &&
        !name.startsWith('/') &&
        !/^[a-z]:/i.test(name) &&
        !name.split('/').some(part => part === '..' || part === '.'),
      `${label}: unsafe entry name ${JSON.stringify(name)}`,
    );
    requireCondition((flags & 1) === 0, `${label}: ${name} is encrypted`);
    requireCondition(!files.has(name), `${label}: ${name} appears more than once`);
    if (name.endsWith('/')) continue;

    requireCondition(
      localOffset + 30 <= directoryOffset && archive.readUInt32LE(localOffset) === ZIP_LOCAL_HEADER,
      `${label}: local header for ${name} is malformed`,
    );
    const dataStart =
      localOffset +
      30 +
      archive.readUInt16LE(localOffset + 26) +
      archive.readUInt16LE(localOffset + 28);
    requireCondition(
      dataStart + compressedSize <= directoryOffset,
      `${label}: ${name} is out of bounds`,
    );
    const stored = archive.subarray(dataStart, dataStart + compressedSize);
    let data: Buffer;
    if (method === 0) data = Buffer.from(stored);
    else if (method === 8) {
      try {
        data = inflateRawSync(stored, { maxOutputLength: Math.max(size, 1) });
      } catch {
        throw new Error(`${label}: ${name} cannot be decompressed`);
      }
    } else throw new Error(`${label}: ${name} uses unsupported compression method ${method}`);
    requireCondition(
      data.length === size && crc32(data) === checksum,
      `${label}: ${name} fails its size or CRC-32 check`,
    );
    files.set(name, data);
  }
  return files;
}

function listFiles(directory: string, prefix = ''): string[] {
  return fs.readdirSync(path.join(directory, prefix), { withFileTypes: true }).flatMap(entry => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listFiles(directory, relative);
    return entry.isFile() ? [relative] : [];
  });
}

function packagePath(root: string, version: string, suffix: string) {
  return path.join(root, '.output', `${EXTENSION_IDENTITY.artifactName}-v${version}-${suffix}.zip`);
}

function readPackage(root: string, version: string, suffix: string) {
  const file = packagePath(root, version, suffix);
  const label = path.basename(file);
  requireCondition(fs.existsSync(file), `${label} is missing`);
  return { label, files: readZip(fs.readFileSync(file), label) };
}

function validateBrowserPackage(
  target: BuildTarget,
  packageVersion: string,
  root: string,
  license: Buffer,
) {
  const { label, files } = readPackage(root, packageVersion, `${target.browser}-mv3`);
  const manifestBytes = files.get('manifest.json');
  requireCondition(manifestBytes, `${label}: manifest.json is missing`);
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8')) as unknown;
  } catch {
    throw new Error(`${label}: manifest.json is not valid JSON`);
  }
  validateManifestShape(manifest, label);
  requireCondition(
    manifest.manifest_version === target.manifestVersion,
    `${label}: expected Manifest V${target.manifestVersion}`,
  );
  requireCondition(
    manifest.name === EXTENSION_IDENTITY.name,
    `${label}: extension name is incorrect`,
  );
  requireCondition(
    manifest.version === packageVersion,
    `${label}: extension version does not match package.json`,
  );
  requireCondition(
    files.get('LICENSE')?.equals(license),
    `${label}: bundled LICENSE must match the repository license`,
  );
  if (target.isFirefox) validateFirefoxId(manifest, label);
  else
    requireCondition(
      !manifest.browser_specific_settings?.gecko,
      `${label}: Firefox-only settings must not be packaged`,
    );

  const action = manifest.action;
  const referenced = [
    ...manifest.content_scripts.flatMap(script => [...script.js, ...(script.css ?? [])]),
    manifest.background.service_worker,
    ...(manifest.background.scripts ?? []),
    isObject(action) && typeof action['default_popup'] === 'string'
      ? action['default_popup']
      : undefined,
  ];
  for (const file of referenced) {
    if (file !== undefined)
      requireCondition(files.has(file.replace(/^\/+/, '')), `${label}: ${file} is missing`);
  }
  requireCondition(
    ![...files.keys()].some(name => name.startsWith('store-listings/')),
    `${label}: store listing files should not be packaged`,
  );

  // When the unpacked build is present (the release build job), the archive must be that
  // validated build exactly, not merely a plausible one.
  const buildDirectory = path.join(root, target.directory);
  if (fs.existsSync(buildDirectory)) {
    const expected = listFiles(buildDirectory).sort();
    const actual = [...files.keys()].sort();
    requireCondition(
      JSON.stringify(actual) === JSON.stringify(expected),
      `${label}: files differ from ${target.directory}`,
    );
    for (const name of expected) {
      requireCondition(
        files.get(name)!.equals(fs.readFileSync(path.join(buildDirectory, name))),
        `${label}: ${name} differs from ${target.directory}`,
      );
    }
  }
  console.log(`Validated ${label} (${files.size} files, version ${manifest.version}).`);
}

function validateSourcesPackage(packageVersion: string, root: string, license: Buffer) {
  const { label, files } = readPackage(root, packageVersion, 'sources');
  for (const required of ['package.json', 'pnpm-lock.yaml', 'wxt.config.ts', 'LICENSE']) {
    requireCondition(files.has(required), `${label}: ${required} is missing`);
  }
  let metadata: unknown;
  try {
    metadata = JSON.parse(files.get('package.json')!.toString('utf8')) as unknown;
  } catch {
    throw new Error(`${label}: package.json is not valid JSON`);
  }
  requireCondition(
    isObject(metadata) && metadata['version'] === packageVersion,
    `${label}: package.json version does not match`,
  );
  requireCondition(
    files.get('LICENSE')!.equals(license),
    `${label}: LICENSE must match the repository license`,
  );
  for (const name of files.keys()) {
    const parts = name.split('/');
    requireCondition(
      !parts.some(part => ['node_modules', '.output', '.wxt', '.git'].includes(part)),
      `${label}: generated or dependency file ${name} should not be packaged`,
    );
    requireCondition(
      !/^\.env(?:\..*)?$/.test(parts.at(-1)!) || parts.at(-1) === '.env.example',
      `${label}: environment file ${name} must never be packaged`,
    );
  }
  console.log(`Validated ${label} (${files.size} files).`);
}

/**
 * Validates the release ZIPs themselves rather than the directories they were made from:
 * each browser package's manifest, version, LICENSE and referenced files, and the sources
 * package's metadata and exclusions.
 */
export function validatePackages(root = projectRoot) {
  const packageVersion = readPackageVersion(root);
  const license = fs.readFileSync(path.join(root, 'LICENSE'));
  targets.forEach(target => validateBrowserPackage(target, packageVersion, root, license));
  validateSourcesPackage(packageVersion, root, license);
}

export function validateBuilds(root = projectRoot) {
  const packageVersion = readPackageVersion(root);
  targets.forEach(target => validateTarget(target, packageVersion, root));
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.some(argument => argument !== '--packages'))
      throw new Error('Usage: node scripts/validate-builds.ts [--packages]');
    if (args.includes('--packages')) validatePackages();
    else validateBuilds();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
