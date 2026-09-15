// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectWorktree } from './worktree-check.js';

test('distinguishes primary and linked checkouts, including detached Codex worktrees', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'keymove-worktree-test-'));
  const primary = path.join(directory, 'primary');
  const linked = path.join(directory, 'linked');
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: directory, windowsHide: true, stdio: 'pipe' });
  try {
    git('init', primary);
    git(
      '-C',
      primary,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '--allow-empty',
      '-m',
      'Initial',
    );
    git('-C', primary, 'worktree', 'add', '--detach', linked);
    expect(inspectWorktree(primary).linked).toBe(false);
    expect(inspectWorktree(linked)).toMatchObject({ linked: true, branch: 'HEAD' });
  } finally {
    // The removal target is the exact temporary directory created above.
    rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
  }
  // Several real Git processes can exceed Vitest's five-second default on Windows.
}, 20000);
