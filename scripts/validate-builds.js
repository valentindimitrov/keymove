import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

const targets = [
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

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveOutputPath(buildDirectory, relativePath) {
  return path.join(buildDirectory, relativePath.replace(/^[/\\]+/, ''));
}

function readRequiredFile(buildDirectory, relativePath, targetName) {
  const filePath = resolveOutputPath(buildDirectory, relativePath);
  requireCondition(fs.existsSync(filePath), `${targetName}: ${relativePath} is missing`);
  return fs.readFileSync(filePath, 'utf8');
}

function validateTarget(target) {
  const buildDirectory = path.join(projectRoot, target.directory);
  const manifestPath = path.join(buildDirectory, 'manifest.json');
  requireCondition(fs.existsSync(manifestPath), `${target.name}: manifest.json is missing`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  requireCondition(
    manifest.manifest_version === target.manifestVersion,
    `${target.name}: expected Manifest V${target.manifestVersion}`,
  );
  requireCondition(manifest.name === 'YipYip', `${target.name}: extension name is incorrect`);
  requireCondition(
    manifest.version === packageJson.version,
    `${target.name}: extension version does not match package.json`,
  );
  requireCondition(
    Array.isArray(manifest.content_scripts) && manifest.content_scripts.length === 1,
    `${target.name}: exactly one content script is required`,
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
    pageStyles.includes('::highlight(yipyip-search-results)'),
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

    if (process.env.WXT_FIREFOX_EXTENSION_ID) {
      requireCondition(
        manifest.browser_specific_settings?.gecko?.id === process.env.WXT_FIREFOX_EXTENSION_ID,
        `${target.name}: extension ID does not match WXT_FIREFOX_EXTENSION_ID`,
      );
    }
  }

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
  ['api.comake.io', 'verify_login_email'].forEach(authToken => {
    requireCondition(
      !bundledSource.includes(authToken),
      `${target.name}: removed authentication token "${authToken}" is still bundled`,
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
  targets.forEach(validateTarget);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
