// @vitest-environment node
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { signCrx3 } from './crx3.js';
import {
  type Clock,
  amoToken,
  packageFile,
  publishChrome,
  publishFirefox,
  verifyStorePackages,
} from './publish-stores.js';
import { zip } from './zip-fixture.js';
import identity from '../src/extension_identity.js';

const VERSION = '1.2.0';
const FIREFOX_ID = 'keymove-test@example.invalid';
const key = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem = key.privateKey.export({ format: 'pem', type: 'pkcs8' });
const publicPem = key.publicKey.export({ format: 'pem', type: 'spki' });

let directory: string;
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function manifest(extra: object = {}, version = VERSION) {
  return Buffer.from(
    JSON.stringify({ manifest_version: 3, name: identity.name, version, ...extra }),
  );
}

function writePackages({
  chromeVersion = VERSION,
  firefoxId = FIREFOX_ID,
  crxKey = privatePem,
  crxPublicKey = publicPem,
} = {}) {
  directory = mkdtempSync(path.join(tmpdir(), 'keymove-store-packages-'));
  const file = (suffix: string) => packageFile(VERSION, suffix, directory);
  const chromeZip = zip([{ name: 'manifest.json', data: manifest({}, chromeVersion) }]);
  writeFileSync(file('chrome-mv3.zip'), chromeZip);
  writeFileSync(file('chrome-mv3.crx'), signCrx3(chromeZip, crxKey, crxPublicKey));
  writeFileSync(
    file('firefox-mv3.zip'),
    zip([
      {
        name: 'manifest.json',
        data: manifest({ browser_specific_settings: { gecko: { id: firefoxId } } }),
      },
    ]),
  );
  writeFileSync(
    file('sources.zip'),
    zip([{ name: 'package.json', data: Buffer.from(JSON.stringify({ version: VERSION })) }]),
  );
}

const verify = () => verifyStorePackages(VERSION, FIREFOX_ID, { directory, publicKey: publicPem });

test('accepts release packages that match the version, signing key and add-on ID', () => {
  writePackages();
  expect(verify).not.toThrow();
});

test.each([
  [
    'a CRX signed by another key',
    () => {
      const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
      writePackages({
        crxKey: other.privateKey.export({ format: 'pem', type: 'pkcs8' }),
        crxPublicKey: other.publicKey.export({ format: 'pem', type: 'spki' }),
      });
    },
    /public key|signature/,
  ],
  ['a package of another version', () => writePackages({ chromeVersion: '1.1.0' }), /1\.1\.0/],
  [
    'a different Firefox add-on ID',
    () => writePackages({ firefoxId: 'other@example.invalid' }),
    /add-on ID/,
  ],
])('rejects %s before any store upload', (_, prepare, message) => {
  prepare();
  expect(verify).toThrow(message);
});

test('signs AMO tokens with HS256 and a short expiry', () => {
  const token = amoToken('user:1:2', 'amo-secret', 1_000, 'nonce');
  const [header, payload, signature] = token.split('.');
  expect(JSON.parse(Buffer.from(header!, 'base64url').toString())).toEqual({
    alg: 'HS256',
    typ: 'JWT',
  });
  expect(JSON.parse(Buffer.from(payload!, 'base64url').toString())).toEqual({
    iss: 'user:1:2',
    jti: 'nonce',
    iat: 1_000,
    exp: 1_060,
  });
  expect(signature).toBe(
    createHmac('sha256', 'amo-secret').update(`${header}.${payload}`).digest('base64url'),
  );
});

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Array<[RegExp, number, unknown]>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const next = responses.shift();
    if (!next || !next[0].test(url)) throw new Error(`Unexpected request to ${url}`);
    return new Response(JSON.stringify(next[2]), { status: next[1] });
  }) as typeof fetch;
  return { calls, fetchImpl, remaining: responses };
}

function fakeClock(): Clock & { slept: number } {
  let time = 1_000_000;
  return {
    slept: 0,
    now: () => time,
    async sleep(milliseconds) {
      this.slept += milliseconds;
      time += milliseconds;
    },
  };
}

const chromeConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  refreshToken: 'refresh-token',
  publisherId: 'publisher',
  extensionId: 'extension',
  publishType: 'STAGED_PUBLISH' as const,
};

test('uploads the signed CRX, waits for processing and submits it', async () => {
  writePackages();
  const store = fakeFetch([
    [/oauth2\.googleapis\.com\/token$/, 200, { access_token: 'access' }],
    [
      /\/upload\/v2\/publishers\/publisher\/items\/extension:upload$/,
      200,
      { uploadState: 'IN_PROGRESS' },
    ],
    [/:fetchStatus$/, 200, { lastAsyncUploadState: 'IN_PROGRESS' }],
    [/:fetchStatus$/, 200, { lastAsyncUploadState: 'SUCCEEDED' }],
    [/\/v2\/publishers\/publisher\/items\/extension:publish$/, 200, { state: 'PENDING_REVIEW' }],
  ]);
  const clock = fakeClock();

  await expect(
    publishChrome(VERSION, chromeConfig, { directory, fetchImpl: store.fetchImpl, clock }),
  ).resolves.toEqual({ state: 'PENDING_REVIEW', warnings: [] });

  expect(store.remaining).toEqual([]);
  expect(clock.slept).toBeGreaterThan(0);
  const upload = store.calls[1]!.init;
  expect(upload.headers).toMatchObject({
    Authorization: 'Bearer access',
    'X-Goog-Upload-Protocol': 'raw',
    'X-Goog-Upload-File-Name': `${identity.artifactName}-v${VERSION}-chrome-mv3.crx`,
  });
  expect(JSON.parse(String(store.calls[4]!.init.body))).toEqual({
    publishType: 'STAGED_PUBLISH',
  });
});

test('stops before publishing when the Chrome upload fails', async () => {
  writePackages();
  const store = fakeFetch([
    [/token$/, 200, { access_token: 'access' }],
    [/:upload$/, 200, { uploadState: 'FAILED' }],
  ]);
  await expect(
    publishChrome(VERSION, chromeConfig, { directory, fetchImpl: store.fetchImpl }),
  ).rejects.toThrow('ended as FAILED');
  expect(store.calls).toHaveLength(2);
});

test('reports API errors without echoing credentials', async () => {
  writePackages();
  const store = fakeFetch([
    [/token$/, 400, { error: 'invalid_grant', error_description: 'Bad refresh-token here' }],
  ]);
  const failure = publishChrome(VERSION, chromeConfig, { directory, fetchImpl: store.fetchImpl });
  await expect(failure).rejects.toThrow('Chrome OAuth token: HTTP 400 (Bad [redacted] here)');
});

const firefoxConfig = { issuer: 'user:1:2', secret: 'amo-secret', addonId: FIREFOX_ID };

test('uploads to AMO, waits for validation and creates the version with sources', async () => {
  writePackages();
  const store = fakeFetch([
    [/\/api\/v5\/addons\/upload\/$/, 201, { uuid: 'abc-123', processed: false }],
    [
      /\/addons\/upload\/abc-123\/$/,
      200,
      { uuid: 'abc-123', processed: true, valid: true, version: VERSION },
    ],
    [
      new RegExp(`/addons/addon/${encodeURIComponent(FIREFOX_ID)}/versions/$`),
      201,
      { version: VERSION, file: { status: 'unreviewed' } },
    ],
  ]);

  await expect(
    publishFirefox(VERSION, firefoxConfig, {
      directory,
      fetchImpl: store.fetchImpl,
      clock: fakeClock(),
    }),
  ).resolves.toEqual({ version: VERSION, fileStatus: 'unreviewed' });

  expect(store.remaining).toEqual([]);
  for (const { init } of store.calls) {
    expect(String((init.headers as Record<string, string>)['Authorization'])).toMatch(/^JWT /);
  }
  const uploadForm = store.calls[0]!.init.body as FormData;
  expect(uploadForm.get('channel')).toBe('listed');
  expect((uploadForm.get('upload') as File).name).toBe(
    `${identity.artifactName}-v${VERSION}-firefox-mv3.zip`,
  );
  const versionForm = store.calls[2]!.init.body as FormData;
  expect(versionForm.get('upload')).toBe('abc-123');
  expect((versionForm.get('source') as File).name).toBe(
    `${identity.artifactName}-v${VERSION}-sources.zip`,
  );
});

test('stops before creating a version when AMO validation fails', async () => {
  writePackages();
  const store = fakeFetch([
    [
      /\/addons\/upload\/$/,
      201,
      {
        uuid: 'abc-123',
        processed: true,
        valid: false,
        validation: { messages: [{ type: 'error', message: 'Bad manifest' }] },
      },
    ],
  ]);
  await expect(
    publishFirefox(VERSION, firefoxConfig, { directory, fetchImpl: store.fetchImpl }),
  ).rejects.toThrow('AMO validation failed, 1 error(s): Bad manifest');
  expect(store.calls).toHaveLength(1);
});
