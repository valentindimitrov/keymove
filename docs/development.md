# Development workflow

## One checkout per concurrent writer

In Codex, select **Worktree** under the composer when starting each task. Each task
must have its own directory, even when two tasks work on unrelated files. A branch
alone does not isolate files, dependency installs, `.wxt`, or `.output`.

Start each task with `yarn worktree:check`. For concurrent writing tasks, use
`yarn worktree:check --require-linked`; it exits unsuccessfully in the primary
checkout. Compare the reported root with the directory assigned to the task.
The check detects a linked checkout; it cannot detect two agents assigned to that
same checkout. Assign one owner per directory. Detached HEAD is valid for
Codex-managed worktrees.

For command-line sessions, create a separate checkout before starting the agent:

```text
git worktree add ../keymove-search-fix -b codex/search-fix
cd ../keymove-search-fix
node --version
yarn install --frozen-lockfile
yarn worktree:check --require-linked
```

Use a unique task name for both the directory and branch. Each checkout installs
its own dependencies and creates its own build output; do not symlink those
directories to another checkout. Configure `yarn install --frozen-lockfile` as
the Codex local-environment setup script if you want automatic setup.

Subagents share their parent's working directory by default. When delegating
implementation, the parent must create a separate worktree first and include its
absolute path in the assignment. The subagent must use that directory for every
edit, command, test, and preview. Read-only review can share a checkout. Integrate
completed changes sequentially, checking the resulting combined behavior. Do not
switch another task's branch, remove its checkout, or run its build.

GitButler can organize concurrent commits in a shared directory, but it does not
isolate the filesystem or runtime state. It is optional and does not replace this
worktree workflow. See the official [Codex worktree instructions](https://learn.chatgpt.com/docs/environments/git-worktrees)
and [GitButler comparison](https://docs.gitbutler.com/ai-agents/parallel-agents).

## Keep changes narrow and reviewable

One implementation batch should address one behavior or subsystem. Before a bug
fix, reproduce it with a failing regression check; run that same check after the
fix. Keep code cleanup separate from performance changes. For performance work,
save a baseline before editing and compare it with the same fixture and browser
afterward. A passing typecheck or build is not evidence of correct interaction.

## Three complementary checks

- `yarn test` checks indexing, scoring, cancellation, navigation and storage in
  isolation. The searchbar regression test requires every keystroke, including
  the first, to invoke search immediately and abort superseded work.
- `yarn preview:ui` opens the existing real-component Shadow DOM harness. Use it
  for fonts, layout, colours, and visual states; extend its scenarios when adding
  UI states. It does not install or exercise the extension runtime.
- `yarn test:browser` rebuilds and loads the production extension in a fresh
  temporary Vivaldi/Chrome profile, runs real keyboard interaction checks against
  local fixtures, and closes only its own browser. It exits unsuccessfully on a
  failed assertion. `yarn preview --smoke` is equivalent.

After `yarn quality`, use `yarn test:browser:built` to test those exact artifacts
without rebuilding. Run browser smoke for changes affecting input, navigation,
search, popup settings, or extension mounting. Run `yarn quality` before handoff.
Automated smoke currently covers Chromium; Firefox still needs `yarn preview:firefox`
and a manual interaction check. No installed browser is an error, not a mocked pass.

Browser smoke uses `preview/fixtures.html` with `preview/fixtures.ts`: hidden text,
retargeted host keyboard handlers, nested controls, dynamic DOM and documents of
100 or 5,000 filler blocks. It serves them on an automatically assigned loopback
port, so concurrent worktrees do not collide. To view a fixture manually, run
`yarn preview:ui` and follow its fixture link. For concurrent visual servers,
choose distinct ports, e.g. `yarn preview:ui --port 5175`.

## Responsiveness contract

Search starts on each nonempty input change, with no debounce or idle wait before
starting. Long indexing/scoring work must remain chunked and cancellable; the
newest query wins. Returning a stale result quickly does not meet the contract.

Browser smoke records input-event to result-DOM-update latency for a cold first
query and nine subsequent warm keystrokes on each fixture. Every successive
prefix has a different count, so old results cannot satisfy the timing check.
These are UI update timings, not paint timings or pure index benchmarks. Browser
startup and protocol round trips are excluded. The cold sample includes lazy
index initialization; warm samples retain the same live index.

The ignored `.artifacts/browser-smoke.json` contains individual samples, browser
version, Node version, commit and dirty status. Preserve this file outside the
checkout before changing performance code and compare equivalent runs on the
same machine. Measure at least three runs before drawing conclusions. The
immediate-start contract is enforced deterministically in unit tests; wall-clock
samples are reported rather than given a machine-dependent pass threshold.
Investigate increased latency before accepting an optimization. Do not introduce
a wait to reduce invocation counts, and do not weaken the regression tests to
make an optimization pass.
