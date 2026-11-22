// @vitest-environment node
import { patchProjectSettings, safariProjectArgs } from './safari-project.js';

test('creates only macOS targets and copies resources without overwriting or opening a project', () => {
  const args = safariProjectArgs('eu.example.keymove');
  expect(args).toContain('--macos-only');
  expect(args).not.toContain('--ios-only');
  expect(args).toContain('--copy-resources');
  expect(args).toContain('--no-open');
  expect(args).not.toContain('--force');
});

test.each(['', '--ios-only', 'keymove', 'eu.example/keymove', 'eu.example keymove'])(
  'rejects an invalid bundle identifier: %s',
  identifier => expect(() => safariProjectArgs(identifier)).toThrow(/bundle identifier/),
);

const settings = { bundleId: 'eu.example.keymove', version: '1.1.0' };

test('gives the Xcode 27 app target the requested identifier and the manifest version', () => {
  const project = `{
    "build-settings": { "MARKETING_VERSION": "1.0", "PRODUCT_BUNDLE_IDENTIFIER": "eu.example.KeyMove" },
    "build-settings": { "MARKETING_VERSION": "1.0", "PRODUCT_BUNDLE_IDENTIFIER": "eu.example.keymove.Extension" },
  }`;
  expect(patchProjectSettings(project, settings)).toBe(`{
    "build-settings": { "MARKETING_VERSION": "1.1.0", "PRODUCT_BUNDLE_IDENTIFIER": "eu.example.keymove" },
    "build-settings": { "MARKETING_VERSION": "1.1.0", "PRODUCT_BUNDLE_IDENTIFIER": "eu.example.keymove.Extension" },
  }`);
});

test('patches project.pbxproj settings from earlier Xcode versions', () => {
  const project = `MARKETING_VERSION = 1.0;
PRODUCT_BUNDLE_IDENTIFIER = "eu.example.KeyMove";
MARKETING_VERSION = 1.0;
PRODUCT_BUNDLE_IDENTIFIER = eu.example.keymove.Extension;`;
  expect(patchProjectSettings(project, settings)).toBe(`MARKETING_VERSION = 1.1.0;
PRODUCT_BUNDLE_IDENTIFIER = "eu.example.keymove";
MARKETING_VERSION = 1.1.0;
PRODUCT_BUNDLE_IDENTIFIER = eu.example.keymove.Extension;`);
});

test.each([
  [
    'no extension target',
    '"PRODUCT_BUNDLE_IDENTIFIER": "eu.example.KeyMove", "MARKETING_VERSION": "1.0"',
  ],
  [
    'a differently named extension',
    '"PRODUCT_BUNDLE_IDENTIFIER": "eu.example.KeyMove", "PRODUCT_BUNDLE_IDENTIFIER": "eu.example.KeyMove.Extension", "MARKETING_VERSION": "1.0"',
  ],
  [
    'no version',
    '"PRODUCT_BUNDLE_IDENTIFIER": "eu.example.KeyMove", "PRODUCT_BUNDLE_IDENTIFIER": "eu.example.keymove.Extension"',
  ],
])('refuses a project with %s', (_case, project) =>
  expect(() => patchProjectSettings(project, settings)).toThrow(/Xcode/),
);
