import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import identity from '../src/extension_identity.ts';
import { signCrx3, verifyCrx3 } from './crx3.ts';

const root = path.resolve(import.meta.dirname, '..');

function privateKey(): Buffer {
  const pem = process.env['KEYMOVE_CRX_PRIVATE_KEY'];
  delete process.env['KEYMOVE_CRX_PRIVATE_KEY'];
  if (pem) return Buffer.from(pem);
  if (process.env['CI'])
    throw new Error('Set the KEYMOVE_CRX_PRIVATE_KEY Actions secret before signing');
  const response = spawnSync(
    process.platform === 'win32' ? 'python' : 'python3',
    [path.join(root, 'scripts/read-crx-key.py')],
    {
      env: { ...process.env, KEYMOVE_CRX_KEY_PIPE: '1' },
      windowsHide: true,
      timeout: 70000,
      maxBuffer: 64 * 1024,
    },
  );
  if (response.status !== 0 || !response.stdout?.length)
    throw new Error('Cannot read signing key. Check Proton Pass login and Python cryptography');
  return response.stdout;
}

export function packageChrome(verifyOnly = false): string {
  const metadata = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    version?: unknown;
  };
  if (typeof metadata.version !== 'string' || !/^\d+(?:\.\d+){1,3}$/.test(metadata.version))
    throw new Error('Invalid package version');
  const base = path.join(
    root,
    '.output',
    `${identity.artifactName}-v${metadata.version}-chrome-mv3`,
  );
  const publicKey = readFileSync(
    path.join(root, 'assets/store-listings/chrome-web-store/crx-signing-public-key.pem'),
  );
  const archive = readFileSync(`${base}.zip`);
  if (!verifyOnly) {
    const pem = privateKey();
    try {
      writeFileSync(`${base}.crx`, signCrx3(archive, pem, publicKey));
    } finally {
      pem.fill(0);
    }
  }
  if (!verifyCrx3(readFileSync(`${base}.crx`), publicKey).equals(archive))
    throw new Error('CRX archive does not match the current Chromium ZIP');
  return `${base}.crx`;
}

if (import.meta.main) {
  try {
    if (process.argv.slice(2).some(argument => argument !== '--verify'))
      throw new Error('Only --verify is supported');
    console.log(
      `Verified signed Chromium package: ${packageChrome(process.argv.includes('--verify'))}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'CRX packaging failed');
    process.exitCode = 1;
  }
}
