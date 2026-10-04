// @vitest-environment node
import { safariProjectArgs } from './safari-project.js';

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
