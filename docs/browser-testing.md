# Browser testing and debugging

Keep Node for scripts and Vitest for application and tooling tests. Playwright Test
adds repeatable installed-extension checks; playwright-cli lets a person or agent
inspect a paused test. All browser smoke checks now use Playwright; Vitest keeps
the exhaustive algorithm and application tests.

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
pnpm test:browser:built
pnpm test:browser:vivaldi
pnpm test:browser:chrome --grep "frames"
pnpm test:e2e:report
```

`test:e2e` rebuilds Chromium first. `test:e2e:built` tests the existing production
artifact, so use it after `pnpm quality`. Each test loads a separate snapshot into
a fresh temporary persistent profile. The fixture server gets a free loopback
port per worker; tests never touch a regular browser profile. Missing builds or
browsers fail the run.

The suite preserves the existing smoke coverage: per-keystroke search and cold/warm
timings on small and large pages, stable suggestions, native selection and clipboard,
Unicode and rendered whitespace, dynamic DOM, shadow roots, modal controls, iframe
actions and timings, image navigation, hover, action menus, tab focus, live settings,
and light/dark layouts at desktop and narrow widths.
Vitest excludes `tests/browser/`, and Playwright runs only that directory.

Failure screenshots and traces, rendered-state diagnostics, timing attachments,
and HTML/JSON reports live under the ignored `.artifacts/playwright/` directory. Open a trace with
`pnpm exec playwright show-trace <path-to-trace.zip>`. CI runs these checks after
the full quality gate and retains Playwright artifacts on failure.
Each browser gets its own report and result directories. `test:e2e:report` opens
Chromium's HTML report; use
`pnpm exec playwright show-report .artifacts/playwright/vivaldi/report` for Vivaldi.

`test:e2e` uses bundled Chromium. `test:browser` rebuilds and runs the same suite
with the preferred installed browser (Vivaldi, then Chrome); `test:browser:built`
skips the rebuild. `pnpm preview --smoke` is equivalent to `test:browser`.
The explicit Vivaldi/Chrome commands also use the existing build and accept
Playwright flags such as `--grep`, `--headed`, and `--debug=cli`.

Automated Vivaldi runs use its installed executable with `--disable-vivaldi`:
this tests its Chromium renderer and extension APIs in the Chromium shell.
Its native UI hangs or crashes when Playwright creates tabs on the tested version.
`pnpm preview:vivaldi` retains the normal Vivaldi UI through web-ext for manual
checks. Firefox and Safari still require their separate manual platform checks.
Detection and custom executable paths follow the preview launcher; set
`KEYMOVE_VIVALDI_BINARY` or `KEYMOVE_CHROME_BINARY` for a custom installation.
Installed Chrome uses `Extensions.loadUnpacked` through a native Playwright CDP
session because current Chrome no longer accepts `--load-extension`.

The pattern-video recorder and store-image generator also use native Playwright
pages and the shared isolated extension launcher. To verify them without replacing
published media, set `KEYMOVE_RECORDING_OUTPUT` or `KEYMOVE_STORE_OUTPUT` to an
ignored directory under `.artifacts/`.

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
