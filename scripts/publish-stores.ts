import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import identity from '../src/extension_identity.ts';
import { verifyCrx3 } from './crx3.ts';
import { readZip } from './validate-builds.ts';

// Uploads a published release's packages to the Chrome Web Store and Firefox Add-ons.
// Like the signing scripts, this imports only Node built-ins and modules that do the same,
// so the store jobs run it from a fresh checkout without installing dependencies.
// API references: https://developer.chrome.com/docs/webstore/using-api (v2) and
// https://mozilla.github.io/addons-server/topics/api/addons.html (v5).

const root = path.resolve(import.meta.dirname, '..');
const CHROME_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CHROME_API = 'https://chromewebstore.googleapis.com';
const AMO_API = 'https://addons.mozilla.org/api/v5';
const VERSION_PATTERN = /^\d+(?:\.\d+){1,3}$/;
const CHROME_ACCEPTED_STATES = new Set([
  'PENDING_REVIEW',
  'STAGED',
  'PUBLISHED',
  'PUBLISHED_TO_TESTERS',
]);

export type ChromePublishType = 'DEFAULT_PUBLISH' | 'STAGED_PUBLISH';

export interface Clock {
  now(): number;
  sleep(milliseconds: number): Promise<void>;
}

export interface StoreOptions {
  directory?: string;
  fetchImpl?: typeof fetch;
  clock?: Clock;
}

const realClock: Clock = {
  now: () => Date.now(),
  sleep: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
};

function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function packageFile(
  version: string,
  suffix: string,
  directory = path.join(root, '.output'),
): string {
  return path.join(directory, `${identity.artifactName}-v${version}-${suffix}`);
}

function readManifest(archive: Buffer, label: string): Record<string, unknown> {
  const bytes = readZip(archive, label).get('manifest.json');
  requireValid(bytes, `${label}: manifest.json is missing`);
  let manifest: unknown;
  try {
    manifest = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    throw new Error(`${label}: manifest.json is not valid JSON`);
  }
  requireValid(isObject(manifest), `${label}: manifest.json is not an object`);
  return manifest;
}

/**
 * Checks the downloaded release packages before any store sees them: the CRX is signed by
 * the committed public key and carries exactly the Chromium ZIP, both browser manifests name
 * KeyMove at the requested version, the Firefox ID matches, and the sources package matches.
 */
export function verifyStorePackages(
  version: string,
  firefoxId: string,
  options: { directory?: string; publicKey?: Buffer | string } = {},
): void {
  requireValid(VERSION_PATTERN.test(version), `Invalid version: ${version}`);
  requireValid(firefoxId, 'WXT_FIREFOX_EXTENSION_ID is not set');
  const file = (suffix: string) => packageFile(version, suffix, options.directory);
  const publicKey =
    options.publicKey ??
    readFileSync(
      path.join(root, 'assets/store-listings/chrome-web-store/crx-signing-public-key.pem'),
    );

  const chromeZip = readFileSync(file('chrome-mv3.zip'));
  requireValid(
    verifyCrx3(readFileSync(file('chrome-mv3.crx')), publicKey).equals(chromeZip),
    'The CRX payload does not match the Chromium ZIP',
  );

  const manifests = {
    Chromium: readManifest(chromeZip, 'Chromium ZIP'),
    Firefox: readManifest(readFileSync(file('firefox-mv3.zip')), 'Firefox ZIP'),
  };
  for (const [label, manifest] of Object.entries(manifests)) {
    requireValid(manifest['manifest_version'] === 3, `${label} ZIP: expected Manifest V3`);
    requireValid(manifest['name'] === identity.name, `${label} ZIP: extension name is incorrect`);
    requireValid(
      manifest['version'] === version,
      `${label} ZIP: version ${String(manifest['version'])} is not ${version}`,
    );
  }
  const settings = manifests.Firefox['browser_specific_settings'];
  const gecko = isObject(settings) ? settings['gecko'] : undefined;
  requireValid(
    isObject(gecko) && gecko['id'] === firefoxId,
    'Firefox ZIP: add-on ID does not match WXT_FIREFOX_EXTENSION_ID',
  );

  const metadata = readZip(readFileSync(file('sources.zip')), 'Sources ZIP').get('package.json');
  let sourceVersion: unknown;
  try {
    const parsed: unknown = metadata ? JSON.parse(metadata.toString('utf8')) : undefined;
    sourceVersion = isObject(parsed) ? parsed['version'] : undefined;
  } catch {
    sourceVersion = undefined;
  }
  requireValid(sourceVersion === version, `Sources ZIP: package.json version is not ${version}`);
}

function redact(text: string, secrets: readonly string[]): string {
  let result = text;
  for (const secret of secrets) if (secret) result = result.split(secret).join('[redacted]');
  return result;
}

/** Keeps only an API's own error message; never the request, headers or a raw body. */
function errorDetail(body: unknown): string {
  if (!isObject(body)) return '';
  const google = body['error'];
  if (isObject(google) && typeof google['message'] === 'string') return google['message'];
  if (typeof body['error_description'] === 'string') return body['error_description'];
  if (typeof google === 'string') return google;
  if (typeof body['detail'] === 'string') return body['detail'];
  for (const [field, value] of Object.entries(body)) {
    if (Array.isArray(value) && typeof value[0] === 'string') return `${field}: ${value[0]}`;
  }
  return '';
}

async function requestJson(
  fetchImpl: typeof fetch,
  service: string,
  url: string,
  init: RequestInit,
  secrets: readonly string[],
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new Error(`${service}: request failed before a response`);
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const detail = redact(errorDetail(body), secrets).slice(0, 300);
    throw new Error(`${service}: HTTP ${response.status}${detail ? ` (${detail})` : ''}`);
  }
  requireValid(isObject(body), `${service}: unexpected response`);
  return body;
}

export interface ChromeConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  publisherId: string;
  extensionId: string;
  publishType: ChromePublishType;
}

export interface ChromeResult {
  state: string;
  warnings: string[];
}

export async function publishChrome(
  version: string,
  config: ChromeConfig,
  { directory, fetchImpl = fetch, clock = realClock }: StoreOptions = {},
): Promise<ChromeResult> {
  const secrets = [config.clientId, config.clientSecret, config.refreshToken];
  const token = await requestJson(
    fetchImpl,
    'Chrome OAuth token',
    CHROME_TOKEN_URL,
    {
      method: 'POST',
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
      }),
    },
    secrets,
  );
  const accessToken = token['access_token'];
  requireValid(
    typeof accessToken === 'string' && accessToken,
    'Chrome OAuth token: no access token',
  );
  secrets.push(accessToken);
  const authorization = { Authorization: `Bearer ${accessToken}` };
  const item = `publishers/${encodeURIComponent(config.publisherId)}/items/${encodeURIComponent(config.extensionId)}`;

  const crxPath = packageFile(version, 'chrome-mv3.crx', directory);
  const upload = await requestJson(
    fetchImpl,
    'Chrome Web Store upload',
    `${CHROME_API}/upload/v2/${item}:upload`,
    {
      method: 'POST',
      headers: {
        ...authorization,
        'Content-Type': 'application/octet-stream',
        'X-Goog-Upload-Protocol': 'raw',
        'X-Goog-Upload-File-Name': path.basename(crxPath),
      },
      body: new Uint8Array(readFileSync(crxPath)),
    },
    secrets,
  );

  let state = upload['uploadState'];
  const deadline = clock.now() + 10 * 60_000;
  while (state === 'IN_PROGRESS') {
    requireValid(clock.now() < deadline, 'Chrome Web Store upload: still processing after 10 min');
    await clock.sleep(10_000);
    const status = await requestJson(
      fetchImpl,
      'Chrome Web Store status',
      `${CHROME_API}/v2/${item}:fetchStatus`,
      { headers: authorization },
      secrets,
    );
    state = status['lastAsyncUploadState'];
  }
  requireValid(state === 'SUCCEEDED', `Chrome Web Store upload: ended as ${String(state)}`);
  const uploadedVersion = upload['crxVersion'];
  requireValid(
    uploadedVersion === undefined || uploadedVersion === version,
    `Chrome Web Store upload: store read version ${String(uploadedVersion)}, not ${version}`,
  );

  const published = await requestJson(
    fetchImpl,
    'Chrome Web Store publish',
    `${CHROME_API}/v2/${item}:publish`,
    {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishType: config.publishType }),
    },
    secrets,
  );
  const publishedState = String(published['state']);
  requireValid(
    CHROME_ACCEPTED_STATES.has(publishedState),
    `Chrome Web Store publish: item is ${publishedState}`,
  );
  const warningInfo = published['warningInfo'];
  const warnings =
    isObject(warningInfo) && Array.isArray(warningInfo['warnings'])
      ? warningInfo['warnings'].flatMap(warning =>
          isObject(warning) && typeof warning['description'] === 'string'
            ? [redact(warning['description'], secrets)]
            : [],
        )
      : [];
  return { state: publishedState, warnings };
}

/** AMO API JWT: HS256, a fresh `jti`, and an expiry well inside the five-minute limit. */
export function amoToken(
  issuer: string,
  secret: string,
  nowSeconds: number,
  jti: string = randomUUID(),
): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    iss: issuer,
    jti,
    iat: nowSeconds,
    exp: nowSeconds + 60,
  })}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

function validationSummary(validation: unknown): string {
  const messages =
    isObject(validation) && Array.isArray(validation['messages']) ? validation['messages'] : [];
  const errors = messages.filter(
    (message): message is Record<string, unknown> =>
      isObject(message) && message['type'] === 'error',
  );
  const first = errors
    .slice(0, 3)
    .map(message => (typeof message['message'] === 'string' ? message['message'] : 'error'));
  return `${errors.length} error(s)${first.length ? `: ${first.join('; ')}` : ''}`;
}

export interface FirefoxConfig {
  issuer: string;
  secret: string;
  addonId: string;
}

export interface FirefoxResult {
  version: string;
  fileStatus: string;
}

export async function publishFirefox(
  version: string,
  config: FirefoxConfig,
  { directory, fetchImpl = fetch, clock = realClock }: StoreOptions = {},
): Promise<FirefoxResult> {
  const secrets = [config.issuer, config.secret];
  const authorization = () => ({
    Authorization: `JWT ${amoToken(config.issuer, config.secret, Math.floor(clock.now() / 1000))}`,
  });
  const attach = (form: FormData, field: string, suffix: string) => {
    const file = packageFile(version, suffix, directory);
    form.append(
      field,
      new Blob([new Uint8Array(readFileSync(file))], { type: 'application/zip' }),
      path.basename(file),
    );
  };

  const uploadForm = new FormData();
  attach(uploadForm, 'upload', 'firefox-mv3.zip');
  uploadForm.append('channel', 'listed');
  let upload = await requestJson(
    fetchImpl,
    'AMO upload',
    `${AMO_API}/addons/upload/`,
    { method: 'POST', headers: authorization(), body: uploadForm },
    secrets,
  );
  const uuid = upload['uuid'];
  requireValid(typeof uuid === 'string' && /^[0-9a-f-]+$/i.test(uuid), 'AMO upload: no upload ID');

  const deadline = clock.now() + 15 * 60_000;
  while (upload['processed'] !== true) {
    requireValid(clock.now() < deadline, 'AMO upload: validation still running after 15 min');
    await clock.sleep(5_000);
    upload = await requestJson(
      fetchImpl,
      'AMO upload status',
      `${AMO_API}/addons/upload/${uuid}/`,
      { headers: authorization() },
      secrets,
    );
  }
  requireValid(
    upload['valid'] === true,
    `AMO validation failed, ${validationSummary(upload['validation'])}`,
  );
  requireValid(
    upload['version'] === undefined || upload['version'] === version,
    `AMO upload: store read version ${String(upload['version'])}, not ${version}`,
  );

  const versionForm = new FormData();
  versionForm.append('upload', uuid);
  attach(versionForm, 'source', 'sources.zip');
  const created = await requestJson(
    fetchImpl,
    'AMO version',
    `${AMO_API}/addons/addon/${encodeURIComponent(config.addonId)}/versions/`,
    { method: 'POST', headers: authorization(), body: versionForm },
    secrets,
  );
  requireValid(
    created['version'] === version,
    `AMO version: created ${String(created['version'])}, not ${version}`,
  );
  const file = created['file'];
  const fileStatus = isObject(file) ? String(file['status']) : 'unknown';
  return { version, fileStatus };
}

/** Reads a required value and removes it from the environment, as the signer does. */
function takeEnv(name: string): string {
  const value = process.env[name]?.trim();
  delete process.env[name];
  requireValid(value, `${name} is not set`);
  return value;
}

export function chromePublishType(input: string): ChromePublishType {
  if (input === 'publish-after-review') return 'DEFAULT_PUBLISH';
  if (input === 'stage-for-manual-publish') return 'STAGED_PUBLISH';
  throw new Error(`Unknown Chrome publish type: ${input}`);
}

async function main(argv: string[]): Promise<void> {
  const [command, version] = argv;
  requireValid(
    argv.length === 2 && version && VERSION_PATTERN.test(version),
    'Usage: node scripts/publish-stores.ts verify|chrome|firefox <version>',
  );
  const firefoxId = takeEnv('WXT_FIREFOX_EXTENSION_ID');
  verifyStorePackages(version, firefoxId);
  if (command === 'verify') {
    console.log(`Verified store packages for ${version}.`);
  } else if (command === 'chrome') {
    const result = await publishChrome(version, {
      clientId: takeEnv('CHROME_CLIENT_ID'),
      clientSecret: takeEnv('CHROME_CLIENT_SECRET'),
      refreshToken: takeEnv('CHROME_REFRESH_TOKEN'),
      publisherId: takeEnv('CHROME_PUBLISHER_ID'),
      extensionId: takeEnv('CHROME_EXTENSION_ID'),
      publishType: chromePublishType(takeEnv('CHROME_PUBLISH_TYPE')),
    });
    console.log(`Chrome Web Store: ${version} submitted, item is ${result.state}.`);
    for (const warning of result.warnings) console.log(`Chrome Web Store warning: ${warning}`);
  } else if (command === 'firefox') {
    const result = await publishFirefox(version, {
      issuer: takeEnv('AMO_JWT_ISSUER'),
      secret: takeEnv('AMO_JWT_SECRET'),
      addonId: firefoxId,
    });
    console.log(`Firefox Add-ons: ${result.version} submitted, file is ${result.fileStatus}.`);
  } else {
    throw new Error(`Unknown command: ${String(command)}`);
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Store publishing failed');
    process.exitCode = 1;
  });
}
