import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EXTENSION_IDENTITY from '../src/extension_identity.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type BuildTarget = {
  name: string;
  directory: string;
  manifestVersion: 3;
  backgroundType: 'service-worker' | 'script';
  isFirefox?: boolean;
};

type ContentScriptManifest = {
  matches: string[];
  js: string[];
  css: string[];
};

type BuildManifest = {
  manifest_version: number;
  name: string;
  version: string;
  content_scripts: [ContentScriptManifest];
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
    directory: '.output/chrome-mv3',
    manifestVersion: 3,
    backgroundType: 'service-worker',
  },
  {
    name: 'Firefox',
    directory: '.output/firefox-mv3',
    manifestVersion: 3,
    backgroundType: 'script',
    isFirefox: true,
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

function readPackageVersion(): string {
  const packagePath = path.join(projectRoot, 'package.json');
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
    Array.isArray(value['content_scripts']) && value['content_scripts'].length === 1,
    `${targetName}: exactly one content script is required`,
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

function resolveOutputPath(buildDirectory: string, relativePath: string) {
  return path.join(buildDirectory, relativePath.replace(/^[/\\]+/, ''));
}

function readRequiredFile(buildDirectory: string, relativePath: string, targetName: string) {
  const filePath = resolveOutputPath(buildDirectory, relativePath);
  requireCondition(fs.existsSync(filePath), `${targetName}: ${relativePath} is missing`);
  return fs.readFileSync(filePath, 'utf8');
}

function validateTarget(target: BuildTarget, packageVersion: string) {
  const buildDirectory = path.join(projectRoot, target.directory);
  const manifestPath = path.join(buildDirectory, 'manifest.json');
  requireCondition(fs.existsSync(manifestPath), `${target.name}: manifest.json is missing`);

  const license = readRequiredFile(buildDirectory, 'LICENSE', target.name);
  requireCondition(
    license === fs.readFileSync(path.join(projectRoot, 'LICENSE'), 'utf8'),
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
  const contentScript = manifest.content_scripts[0];
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
  requireCondition(manifest.action, `${target.name}: toolbar action is missing`);
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

    if (process.env['WXT_FIREFOX_EXTENSION_ID']) {
      requireCondition(
        manifest.browser_specific_settings?.gecko?.id === process.env['WXT_FIREFOX_EXTENSION_ID'],
        `${target.name}: extension ID does not match WXT_FIREFOX_EXTENSION_ID`,
      );
    }
  }

  requireCondition(
    typeof backgroundPath === 'string',
    `${target.name}: background path is invalid`,
  );
  const backgroundBundle = readRequiredFile(buildDirectory, backgroundPath, target.name);
  const bundledSource = `${backgroundBundle}\n${contentBundle}`;
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

  ['login.html', 'login.js', 'login.css'].forEach(removedFile => {
    requireCondition(
      !fs.existsSync(path.join(buildDirectory, removedFile)),
      `${target.name}: ${removedFile} should not be packaged`,
    );
  });

  console.log(
    `Validated ${target.name} build ${manifest.version} (MV${manifest.manifest_version}).`,
  );
}

try {
  const packageVersion = readPackageVersion();
  targets.forEach(target => validateTarget(target, packageVersion));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
