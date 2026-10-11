# Browser testing and debugging

Keep Node for scripts and Vitest for application and tooling tests. Playwright Test
adds repeatable installed-extension checks; playwright-cli lets a person or agent
inspect a paused test. Neither replaces the exhaustive algorithm tests or the
existing Vivaldi smoke suite.

## Setup

Use the Node range and exact pnpm version in `package.json`. Install pnpm with
`npm install --global pnpm@12.11.2`, then run:

```text
pnpm install --frozen-lockfile
pnpm run postinstall
pnpm browser:install
```

The explicit postinstall prepares WXT's generated types even when local install
policies skip lifecycle scripts. Browser installation downloads Playwright's
Chromium and its support binaries. On Linux CI, use
`pnpm exec playwright install --with-deps chromium` for its OS dependencies too.

## Repeatable checks

```text
pnpm test:e2e
pnpm test:e2e:built
pnpm test:e2e:built --grep "frames"
pnpm test:e2e:built --headed
pnpm test:e2e:report
```

`test:e2e` rebuilds Chromium first. `test:e2e:built` tests the existing production
artifact, so use it after `pnpm quality`. Each test loads a separate snapshot into
a fresh temporary persistent profile. The fixture server gets a free loopback
port per worker; tests never touch a regular browser profile. Missing builds or
browsers fail the run.

The initial suite covers per-keystroke search on small and large pages, semantic
selection and native copy/paste, DOM updates, nested open roots, native modals,
same-origin and cross-origin iframe actions, and settings propagation/persistence.
Vitest excludes `tests/browser/`, and Playwright runs only that directory.

Failure screenshots and traces, plus the HTML report, live under the ignored
`.artifacts/playwright/` directory. Open a trace with
`pnpm exec playwright show-trace <path-to-trace.zip>`. CI runs these checks after
the full quality gate and retains Playwright artifacts on failure.

Retain `pnpm test:browser:built` for the broader existing Vivaldi/Chrome interaction
and timing suite. `pnpm preview --smoke` still rebuilds and runs that suite.
Playwright's baseline uses its bundled Chromium: it does not establish Vivaldi,
Firefox, or Safari extension compatibility. Use the documented installed-browser
previews and manual platform checks for those browsers.

## playwright-cli debugging

The CLI is pinned as a development dependency. No global CLI or skill installation
is required. Inspect its current commands with `pnpm browser:cli --help`.

Build first, then pause a test in one terminal:

```text
pnpm build:chromium
pnpm test:e2e:debug --grep "frames"
```

Once Playwright prints the debugging instructions and session name, use another
terminal in this checkout:

```text
pnpm browser:cli attach <session-name>
pnpm browser:cli -s=<session-name> snapshot
pnpm browser:cli -s=<session-name> step-over
pnpm browser:cli -s=<session-name> screenshot
pnpm browser:cli -s=<session-name> resume
```

This attaches to the test's own browser, with the extension already installed.
The CLI emits Playwright code for exploratory actions; turn useful reproductions
into assertions in `tests/browser/`. Detach with
`pnpm browser:cli -s=<session-name> detach` and stop
the debug run with Ctrl+C when finished. Do not use `close-all` or `kill-all`, which
could affect other tasks' sessions. CLI snapshots and generated code are ignored
under `.playwright-cli/`.

The extension fixture follows [Playwright's extension-testing guidance](https://playwright.dev/docs/chrome-extensions).
The attach workflow is documented by [playwright-cli](https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/references/playwright-tests.md).
