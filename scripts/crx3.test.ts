// @vitest-environment node
import { generateKeyPairSync } from 'node:crypto';
import { signCrx3, verifyCrx3 } from './crx3.js';

const key = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = key.privateKey.export({ format: 'pem', type: 'pkcs8' });
const publicPem = key.publicKey.export({ format: 'pem', type: 'spki' });
const archive = Buffer.from([0x50, 0x4b, 3, 4, 1, 2, 3, 4]);

test('signs a CRX3 and recovers the exact ZIP payload', () => {
  const crx = signCrx3(archive, pem, publicPem);
  expect(verifyCrx3(crx, publicPem)).toEqual(archive);
  expect(crx.includes(pem)).toBe(false);
});

test('rejects a tampered archive', () => {
  const crx = signCrx3(archive, pem, publicPem);
  crx[crx.length - 1] = crx[crx.length - 1]! ^ 1;
  expect(() => verifyCrx3(crx, publicPem)).toThrow('signature verification failed');
});

test('rejects a different signing key before packaging', () => {
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const otherPublic = other.publicKey.export({ format: 'pem', type: 'spki' });
  expect(() => signCrx3(archive, pem, otherPublic)).toThrow('does not match');
  expect(() => verifyCrx3(signCrx3(archive, pem, publicPem), otherPublic)).toThrow(
    'does not match',
  );
});

test.each([0, 4, 11, 20])('rejects a truncated CRX at byte %i', length => {
  expect(() =>
    verifyCrx3(signCrx3(archive, pem, publicPem).subarray(0, length), publicPem),
  ).toThrow();
});

test('rejects an unbounded header length', () => {
  const crx = signCrx3(archive, pem, publicPem);
  crx.writeUInt32LE(0xffffffff, 8);
  expect(() => verifyCrx3(crx, publicPem)).toThrow('header length');
});

test('rejects non-RSA keys and hides invalid private-key input', () => {
  const other = generateKeyPairSync('ed25519');
  expect(() =>
    signCrx3(archive, other.privateKey.export({ format: 'pem', type: 'pkcs8' }), publicPem),
  ).toThrow('requires an RSA');
  const secret = 'private-key-invalid-input-never-log';
  try {
    signCrx3(archive, secret, publicPem);
    throw new Error('Expected failure');
  } catch (error) {
    expect(String(error)).toContain('Cannot parse');
    expect(String(error)).not.toContain(secret);
  }
});
