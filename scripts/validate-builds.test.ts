// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SANDBOX_SUPPORT_URL, validateBuilds } from './validate-builds.js';
import identity from '../src/extension_identity.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'keymove-build-validation-'));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '1.0.0' }));
  writeFileSync(path.join(root, 'LICENSE'), 'Fixture license');
  for (const target of ['chrome', 'firefox']) {
    const build = path.join(root, '.output', `${target}-mv3`);
    mkdirSync(path.join(build, 'content-scripts'), { recursive: true });
    for (const [name, text] of Object.entries({
      LICENSE: 'Fixture license',
      'background.js': '',
      'content-scripts/content.js': 'attachShadow MutationObserver',
      'content-scripts/frames.js': 'MutationObserver',
      'content-scripts/content.css': '::highlight(keymove-search-results) {}',
      'popup.html':
        '<script type="module" src="/popup.js"></script><link rel="stylesheet" href="/popup.css">',
      'popup.js': `export {}; ${identity.supportUrl}`,
      'popup.css': '',
    }))
      writeFileSync(path.join(build, name), text);
    writeFileSync(
      path.join(build, 'manifest.json'),
      JSON.stringify({
        manifest_version: 3,
        name: identity.name,
        version: '1.0.0',
        action: { default_popup: 'popup.html' },
        permissions: ['storage', 'scripting'],
        host_permissions: ['*://*/*'],
        content_scripts: [
          {
            matches: ['<all_urls>'],
            all_frames: false,
            js: ['content-scripts/content.js'],
            css: ['content-scripts/content.css'],
          },
          { matches: ['<all_urls>'], all_frames: true, js: ['content-scripts/frames.js'] },
        ],
        background:
          target === 'chrome'
            ? { service_worker: 'background.js' }
            : { scripts: ['background.js'] },
        ...(target === 'firefox'
          ? {
              browser_specific_settings: {
                gecko: {
                  ...(process.env['WXT_FIREFOX_EXTENSION_ID']
                    ? { id: process.env['WXT_FIREFOX_EXTENSION_ID'] }
                    : {}),
                  data_collection_permissions: { required: ['none'] },
                },
              },
            }
          : {}),
      }),
    );
  }
});
afterEach(() => {
  if (
    path.dirname(root) !== path.resolve(tmpdir()) ||
    !path.basename(root).startsWith('keymove-build-validation-')
  )
    throw new Error('Unsafe test cleanup path');
  rmSync(root, { recursive: true, force: true });
});

test('accepts complete popup artifacts', () => expect(() => validateBuilds(root)).not.toThrow());
test.each(['popup.html', 'popup.js', 'popup.css'])('rejects missing %s', file => {
  unlinkSync(path.join(root, '.output/chrome-mv3', file));
  expect(() => validateBuilds(root)).toThrow(/missing/);
});
test('checks popup JavaScript for unresolved CommonJS', () => {
  writeFileSync(
    path.join(root, '.output/chrome-mv3/popup.js'),
    `require("missing"); ${identity.supportUrl}`,
  );
  expect(() => validateBuilds(root)).toThrow(/CommonJS/);
});

test('follows popup imports and rejects missing chunks', () => {
  writeFileSync(path.join(root, '.output/chrome-mv3/popup.js'), 'import "./missing-chunk.js"');
  expect(() => validateBuilds(root)).toThrow(/missing-chunk.js is missing/);
});

test('rejects remote popup assets', () => {
  writeFileSync(
    path.join(root, '.output/chrome-mv3/popup.html'),
    '<script src="https://example.com/popup.js"></script><link rel="stylesheet" href="popup.css">',
  );
  expect(() => validateBuilds(root)).toThrow(/must be local/);
});

test('rejects a production popup without the live tip destination', () => {
  writeFileSync(path.join(root, '.output/chrome-mv3/popup.js'), 'export {}');
  expect(() => validateBuilds(root)).toThrow(/production tip link is missing/);
});

test('rejects a production popup containing the Stripe sandbox destination', () => {
  writeFileSync(
    path.join(root, '.output/chrome-mv3/popup.js'),
    `${identity.supportUrl} ${SANDBOX_SUPPORT_URL}`,
  );
  expect(() => validateBuilds(root)).toThrow(/sandbox tip link must not ship/);
});

test.each(['chrome', 'firefox'])('rejects store listing files in the %s build', target => {
  const directory = path.join(root, '.output', `${target}-mv3`, 'store-listings');
  mkdirSync(directory);
  writeFileSync(path.join(directory, 'description.txt'), 'Store copy');
  expect(() => validateBuilds(root)).toThrow(/store-listings should not be packaged/);
});
