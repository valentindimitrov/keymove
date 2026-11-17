# Browser testing and debugging

Keep Node for scripts and Vitest for application and tooling tests. Every automated
installed-extension check runs in Playwright Test under `tests/browser/`; playwright-cli
lets a person or agent inspect a paused test. Neither replaces the exhaustive algorithm
tests. The interactive `pnpm preview` launcher (web-ext, native browser UI) is separate
and unchanged.

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

## Commands

| Command | Browser | Builds first |
| --- | --- | --- |
| `pnpm test:e2e` | Playwright's bundled Chromium | yes |
| `pnpm test:e2e:built` | Playwright's bundled Chromium | no |
| `pnpm test:browser` (`pnpm preview --smoke`) | first installed of Vivaldi, Chrome | yes |
| `pnpm test:browser:built` | first installed of Vivaldi, Chrome | no |
| `pnpm test:browser:vivaldi` / `pnpm test:browser:chrome` | that installed browser | no |

All of them run the same suite. `test:browser*` accept `--browser=chromium|vivaldi|chrome`
and pass any other argument to Playwright, for example
`pnpm test:browser:built --grep "frames"` or `--headed`. Run the browser suite for
changes affecting input, navigation, search, popup settings or extension mounting; use
the `:built` forms after `pnpm quality` to test those exact artifacts.

Each test loads a separate snapshot of `.output/chrome-mv3` into a fresh temporary
profile, and each worker serves `preview/` on a free loopback port, so concurrent
worktrees do not collide and no regular browser profile is touched. A missing build or
browser fails the run; it is never a mocked pass. The fixtures fail a test that logs a
browser console error or an uncaught page exception.

Tests drive the extension with real input only: Playwright keyboard and mouse events,
which the browser marks trusted. KeyMove ignores script-created events (AGENTS.md,
"Untrusted page input"), so a test never clicks, types or focuses KeyMove controls through
page script; page script only builds fixtures or plays the hostile page. Characters outside
the US layout are typed as key presses carrying that text (`typeText` in
`tests/browser/keymove.ts`), as a Cyrillic or Greek layout would produce them. Values reach
`page.evaluate` as arguments, never as generated source. Conditions are awaited with
Playwright assertions and `expect.poll`; fixed waits remain only where a test proves that
something does *not* happen, such as a tab that a forged event must not open.

### Vivaldi, Chrome, Firefox and Safari

Automated Vivaldi runs exercise the installed Vivaldi build through its Chromium shell
(`--disable-vivaldi`): tab creation through Playwright hung or crashed with Vivaldi's
native UI. The normal Vivaldi UI stays covered by `pnpm preview:vivaldi`. Branded Chrome
no longer accepts `--load-extension`, so Chrome runs load the snapshot through its
`Extensions.loadUnpacked` DevTools command. Browsers are found as for `pnpm preview`
(standard Windows/macOS locations and PATH), or through `KEYMOVE_VIVALDI_BINARY` and
`KEYMOVE_CHROME_BINARY`. Firefox and Safari have no automated extension run: use
`pnpm preview:firefox` and `docs/safari.md` for manual checks.

## Reports, timings and failures

Output is kept apart per browser under the ignored `.artifacts/playwright/<browser>/`:

- `report/` (HTML; `pnpm test:e2e:report` opens the bundled Chromium one) and
  `results.json`, including screenshots attached as named scenario images;
- `results/`, with a screenshot, trace and the rendered KeyMove state of each page open
  when a test failed. Open a trace with `pnpm exec playwright show-trace <trace.zip>`;
- `timings.json`, the timing samples described in `docs/development.md`, with the browser
  version, platform, Node version, commit and dirty status. A filtered run rewrites it
  with only the tests it ran.

CI runs the whole suite in bundled Chromium after the full quality gate and keeps
`.artifacts/playwright/` for seven days when a step fails.

## Suite layout

- `tests/browser/fixtures.ts`: fixture server, fresh profile and build snapshot per test,
  console-error check and the `extensionId` fixture.
- `tests/browser/keymove.ts`: role/name locators for the host, input, status, suggestions
  and menu (they follow the host into modals and open roots), query helpers and `typeText`.
- `tests/browser/pages.ts`: real-focus pages, selection and highlight readers, screenshots
  and failure diagnostics.
- `tests/browser/extension.spec.ts`: focused checks the scenarios do not make: hostile-page
  input, content-script lifecycle (forged signals, extension reload, duplicate injection,
  blocked hints, stale hosts) and lookalike ids.
- `tests/browser/smoke.spec.ts` with `tests/browser/scenarios/`: the long interaction
  scenarios, one per area.
- `scripts/browser-context.ts`: the one launcher shared by tests, the media recorder and
  the store-image generator.

## Coverage map

The former CDP smoke suite (`scripts/browser-smoke.ts`, `scripts/*-smoke.ts`,
`scripts/browser-driver.ts`) is replaced as follows. Every former assertion is kept,
in the same order, unless the third column says otherwise.

| Former check | Test (`smoke.spec.ts` unless noted) | Change |
| --- | --- | --- |
| `browser-smoke.ts`: typing timings, distinct prefix counts, hidden text, first selection, Tab/Shift+Tab (small and large) | core smoke (small/large), `scenarios/core-smoke.ts` | timings in `timings.json` |
| `browser-smoke.ts`: suggestion frame keeps pending height, closes on empty, reopens | core smoke (small/large) | |
| `browser-smoke.ts`: whole-block selection, native copy/paste, editing resumes | core smoke (small/large) | |
| `browser-smoke.ts`: DOM insertion/removal refresh; 61 navigable results and Alt+1; third-row stability and Alt+3; attribute-only action fallback; Text/Actions mode clicks; Enter on nested action; always-on first character | core smoke (small) | mode switch is a real click |
| `browser-smoke.ts`: logo opens the real settings | core smoke (small) | the page losing focus is no longer asserted: headless popups do not take focus; the popup target is still required |
| `browser-smoke.ts`: suggestion count 1–5, Alt+4/5, selected row background | core smoke (small) | colour expected for the resolved theme |
| `browser-smoke.ts`: layout lock persists and disables resizing | core smoke (small) | |
| `browser-smoke.ts`: popup settings propagate; hidden bar reopens with Alt+F | core smoke (small) | also reloads settings to prove persistence |
| `theme-smoke.ts` `checkTheme` | core smoke (small), `scenarios/theme-smoke.ts` | |
| `theme-smoke.ts` `checkThemePreviews` | appearance: light/dark, narrow/desktop… | |
| `return-position-smoke.ts` | core smoke (small), `scenarios/return-position-smoke.ts` | |
| `tooltips-mode-smoke.ts` | core smoke (small), `scenarios/tooltips-mode-smoke.ts` | |
| `settings-smoke.ts` `checkSiteSettings` | core smoke (small), `scenarios/settings-smoke.ts` | the replaced Alt+F is a real key press whose page event must stay unhandled, instead of a dispatched event |
| `settings-smoke.ts` `checkShowSearch` | core smoke (small) | |
| `image-navigation-smoke.ts` | related images: discovery, spatial navigation… | |
| `iframe-smoke.ts` `checkIframes` | frames: search, input focus, shortcuts… | |
| `iframe-smoke.ts` `measureIframes` | frames: local-first timing… | samples in `timings.json`, not `iframe-performance.json` |
| `highlight-density-smoke.ts` | highlight density and short-query mixed suggestions | |
| `selection-hover-smoke.ts` | selection hover: automatic selection, menus… | |
| `action-fallback-smoke.ts` | temporary action fallback… | |
| `shadow-search-smoke.ts` | open shadow roots: slots, copy, editing… | |
| `dynamic-page-smoke.ts` | dynamic page: search timing, animation… | interface click is a real click |
| `action-menu-smoke.ts` | action menu: keyboard, copy/paste, activation… | |
| `control-navigation-smoke.ts` | controls: labels, native widgets, disabled actions… | |
| `rendered-text-smoke.ts` | rendered whitespace: search, highlights and native clipboard agree | expected copied text stated per case, not derived by stripping tags |
| `context-navigation-smoke.ts` | context navigation: scroll placement and independent tabs | |
| `browser-driver.test.ts` (macOS editing commands for the CDP driver) | removed with the driver | Playwright sends macOS editing commands itself |

Screenshots the former suite wrote to `.artifacts/*.png` are report attachments with the
same names.

`tests/browser/extension.spec.ts` no longer repeats checks the scenarios make:

| Former `extension.spec.ts` test | Now checked by |
| --- | --- |
| searches on each keystroke and copies the whole block (small, large page) | core smoke (small/large) |
| refreshes an active query when page text is inserted and removed | core smoke (small) |
| activates a control inside a nested open shadow root | open shadow roots |
| settings changes persist and reach an already open page | core smoke (small), including `checkTheme` |
| keeps search and native selection inside a modal dialog | controls: the transformed-modal part checks the host inside the drawer, the native selection after Tab and that page text behind the modal does not match |
| searches and activates actions in same-origin and cross-origin frames | frames: adds a click on the cross-origin frame's button |

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
