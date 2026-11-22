// @vitest-environment node
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type ZipEntry, zip } from './zip-fixture.js';
import {
  SANDBOX_SUPPORT_URL,
  readZip,
  validateBuilds,
  validatePackages,
} from './validate-builds.js';
import identity from '../src/extension_identity.js';

let root: string;
beforeEach(() => {
  vi.stubEnv('WXT_FIREFOX_EXTENSION_ID', 'keymove-test@example.invalid');
  root = mkdtempSync(path.join(tmpdir(), 'keymove-build-validation-'));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '1.0.0' }));
  writeFileSync(path.join(root, 'LICENSE'), 'Fixture license');
  for (const target of ['chrome', 'firefox', 'safari']) {
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
          target !== 'firefox'
            ? { service_worker: 'background.js' }
            : { scripts: ['background.js'] },
        ...(target === 'firefox'
          ? {
              browser_specific_settings: {
                gecko: {
                  id: 'keymove-test@example.invalid',
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
  vi.unstubAllEnvs();
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

test.each(['chrome', 'firefox', 'safari'])(
  'rejects store listing files in the %s build',
  target => {
    const directory = path.join(root, '.output', `${target}-mv3`, 'store-listings');
    mkdirSync(directory);
    writeFileSync(path.join(directory, 'description.txt'), 'Store copy');
    expect(() => validateBuilds(root)).toThrow(/store-listings should not be packaged/);
  },
);

test('rejects a Firefox ID that differs from the configured one', () => {
  vi.stubEnv('WXT_FIREFOX_EXTENSION_ID', 'other@example.invalid');
  expect(() => validateBuilds(root)).toThrow(/does not match WXT_FIREFOX_EXTENSION_ID/);
});

test('rejects a packaged Firefox ID when none is configured', () => {
  vi.stubEnv('WXT_FIREFOX_EXTENSION_ID', '');
  expect(() => validateBuilds(root)).toThrow(/packaged although WXT_FIREFOX_EXTENSION_ID/);
});

function filesIn(directory: string, prefix = ''): ZipEntry[] {
  return readdirSync(path.join(directory, prefix), { withFileTypes: true }).flatMap(entry => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? filesIn(directory, name)
      : [{ name, data: readFileSync(path.join(directory, name)) }];
  });
}

const packageFile = (suffix: string) =>
  path.join(root, '.output', `${identity.artifactName}-v1.0.0-${suffix}.zip`);

function writePackages(change: (suffix: string, entries: ZipEntry[]) => ZipEntry[] = (_, e) => e) {
  for (const target of ['chrome', 'firefox', 'safari']) {
    const suffix = `${target}-mv3`;
    writeFileSync(
      packageFile(suffix),
      zip(change(suffix, filesIn(path.join(root, '.output', suffix)))),
    );
  }
  const sources: ZipEntry[] = [
    { name: 'package.json', data: Buffer.from(JSON.stringify({ version: '1.0.0' })) },
    { name: 'pnpm-lock.yaml', data: Buffer.from('lockfileVersion: 9.0') },
    { name: 'wxt.config.ts', data: Buffer.from('export default {}') },
    { name: 'LICENSE', data: Buffer.from('Fixture license') },
    { name: 'src/', data: Buffer.alloc(0), method: 0 },
    { name: 'src/index.ts', data: Buffer.from('export {}'), method: 0 },
  ];
  writeFileSync(packageFile('sources'), zip(change('sources', sources)));
}

const replace = (entries: ZipEntry[], name: string, data: string) =>
  entries.map(entry => (entry.name === name ? { ...entry, data: Buffer.from(data) } : entry));

describe('release packages', () => {
  test('accepts packages that match their validated builds', () => {
    writePackages();
    expect(() => validatePackages(root)).not.toThrow();
  });

  test('validates packages on their own when the unpacked builds are absent', () => {
    writePackages();
    rmSync(path.join(root, '.output/chrome-mv3'), { recursive: true });
    expect(() => validatePackages(root)).not.toThrow();
  });

  test('rejects a missing package', () => {
    writePackages();
    unlinkSync(packageFile('sources'));
    expect(() => validatePackages(root)).toThrow(/sources.zip is missing/);
  });

  test('rejects a package whose manifest version differs', () => {
    writePackages((suffix, entries) => {
      if (suffix !== 'firefox-mv3') return entries;
      const manifest = JSON.parse(
        entries.find(entry => entry.name === 'manifest.json')!.data.toString(),
      ) as Record<string, unknown>;
      return replace(entries, 'manifest.json', JSON.stringify({ ...manifest, version: '0.9.0' }));
    });
    rmSync(path.join(root, '.output/firefox-mv3'), { recursive: true });
    expect(() => validatePackages(root)).toThrow(/firefox-mv3.zip: extension version/);
  });

  test('rejects a package without the repository LICENSE', () => {
    writePackages((suffix, entries) =>
      suffix === 'safari-mv3' ? entries.filter(entry => entry.name !== 'LICENSE') : entries,
    );
    expect(() => validatePackages(root)).toThrow(/safari-mv3.zip: bundled LICENSE/);
  });

  test('rejects a package missing a file its manifest references', () => {
    writePackages((suffix, entries) =>
      suffix === 'chrome-mv3' ? entries.filter(entry => entry.name !== 'background.js') : entries,
    );
    rmSync(path.join(root, '.output/chrome-mv3'), { recursive: true });
    expect(() => validatePackages(root)).toThrow(/chrome-mv3.zip: background.js is missing/);
  });

  test('rejects a package that differs from its validated build', () => {
    writePackages((suffix, entries) =>
      suffix === 'chrome-mv3' ? replace(entries, 'background.js', 'tampered()') : entries,
    );
    expect(() => validatePackages(root)).toThrow(/background.js differs from .output\/chrome-mv3/);
  });

  test('rejects a Firefox package with a different extension ID', () => {
    writePackages();
    rmSync(path.join(root, '.output/firefox-mv3'), { recursive: true });
    vi.stubEnv('WXT_FIREFOX_EXTENSION_ID', 'other@example.invalid');
    expect(() => validatePackages(root)).toThrow(/firefox-mv3.zip: extension ID does not match/);
  });

  test.each([
    ['node_modules/react/index.js', /dependency file/],
    ['.env', /environment file/],
    ['website/.env.production', /environment file/],
  ])('rejects %s in the sources package', (name, error) => {
    writePackages((suffix, entries) =>
      suffix === 'sources' ? [...entries, { name, data: Buffer.from('x') }] : entries,
    );
    expect(() => validatePackages(root)).toThrow(error);
  });

  test('allows .env.example in the sources package', () => {
    writePackages((suffix, entries) =>
      suffix === 'sources'
        ? [...entries, { name: '.env.example', data: Buffer.from('KEY=') }]
        : entries,
    );
    expect(() => validatePackages(root)).not.toThrow();
  });

  test('rejects a sources package for another version', () => {
    writePackages((suffix, entries) =>
      suffix === 'sources'
        ? replace(entries, 'package.json', JSON.stringify({ version: '2.0.0' }))
        : entries,
    );
    expect(() => validatePackages(root)).toThrow(/sources.zip: package.json version/);
  });
});

describe('ZIP reader', () => {
  const file = { name: 'a.txt', data: Buffer.from('hello hello hello') };

  test('reads stored and deflated entries and skips directories', () => {
    const files = readZip(
      zip([
        file,
        { name: 'dir/', data: Buffer.alloc(0), method: 0 },
        { ...file, name: 'b', method: 0 },
      ]),
    );
    expect([...files.keys()]).toEqual(['a.txt', 'b']);
    expect(files.get('a.txt')!.toString()).toBe('hello hello hello');
  });

  test('rejects a corrupted entry', () => {
    expect(() => readZip(zip([{ ...file, crc: 1 }]))).toThrow(/CRC-32/);
  });

  test.each(['../escape.txt', '/absolute.txt', 'dir\\file.txt', 'C:/file.txt'])(
    'rejects the unsafe entry name %s',
    name => {
      expect(() => readZip(zip([{ ...file, name }]))).toThrow(/unsafe entry name/);
    },
  );

  test('rejects duplicate entries', () => {
    expect(() => readZip(zip([file, file]))).toThrow(/more than once/);
  });

  test('rejects data that is not a ZIP archive', () => {
    expect(() => readZip(Buffer.from('not a zip archive at all, just text'))).toThrow(
      /not a ZIP archive/,
    );
  });
});
