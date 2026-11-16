import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';

export function inspectWorktree(cwd = process.cwd()) {
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
  const root = git('rev-parse', '--show-toplevel');
  // Git resolves symlinks in --absolute-git-dir (macOS reports /var as /private/var) but
  // returns --git-common-dir relative to the unresolved cwd, so compare real paths.
  const gitDirectory = realpathSync(git('rev-parse', '--absolute-git-dir'));
  const commonDirectory = realpathSync(path.resolve(cwd, git('rev-parse', '--git-common-dir')));
  return {
    root,
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    commit: git('rev-parse', 'HEAD'),
    linked: gitDirectory !== commonDirectory,
    worktrees: git('worktree', 'list', '--porcelain'),
  };
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--require-linked'))
      throw new Error('Usage: pnpm worktree:check [--require-linked]');
    const info = inspectWorktree();
    console.log(JSON.stringify(info, null, 2));
    if (args.includes('--require-linked') && !info.linked) {
      throw new Error(
        'This is the primary checkout. Start the task in Codex Worktree mode, or create and enter a separate git worktree before editing.',
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
