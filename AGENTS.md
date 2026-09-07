# AGENTS.md

## Project purpose and status

This repository contains KeyMove, a keyboard-first in-page search browser extension. It is being
prepared as a new extension rather than an update to an existing store listing. The KeyMove name
and artwork are applied; repository metadata, store metadata, extension IDs, upstream relicensing
permission, and upstream contribution documentation remain pending. Original KeyMove contributions
by Valentin Dimitrov use MIT; inherited and adapted Comake code retains BSD 4-Clause. Preserve both
license texts in `LICENSE` and its inclusion in browser builds until upstream permission is obtained.

The runtime is Manifest V3 only. Chromium and Vivaldi use the Chrome target; Firefox uses the
Firefox target. There is no MV2 compatibility layer and no user account, email, sign-in, or remote
authentication flow.

## Repository map

```text
.
|-- assets/                  Static extension logo files copied by WXT
|-- entrypoints/
|   |-- background.ts        WXT background entrypoint
|   `-- content.tsx          WXT content-script and React mount
|-- scripts/
|   `-- validate-builds.ts   Manifest and generated-bundle checks
|-- src/
|   |-- background.ts        Toolbar action and safe content-script injection
|   |-- components/searchbar React search UI, overlays, help, and settings
|   |-- data/                 Validated JSON search configuration and shortcuts
|   |-- hooks/                Browser events, storage, highlights, and navigation state
|   |-- icons/                UI SVG modules
|   |-- lib/                  Search index, scoring, schemas, and utilities
|   |-- content.css           Shadow-root component styling
|   `-- highlights.css        Page-level CSS Custom Highlight styling
|-- wxt.config.ts            MV3 manifest and build configuration
|-- tsconfig.json            Strict TypeScript configuration
|-- .oxfmtrc.json            Formatting preferences and exclusions
|-- .oxlintrc.json           Lint rules and environment overrides
`-- vitest.config.ts         jsdom test configuration
```

Generated directories are `.output/` and `.wxt/`; do not edit or commit them. Production unpacked
artifacts are `.output/chrome-mv3` and `.output/firefox-mv3`.

## Runtime flow

1. `entrypoints/content.tsx` creates one extension root and a Shadow DOM. A document-level observer
   reattaches that same host if the page replaces `document.body`; portals use the stable target
   supplied by context, and an error boundary offers an in-page retry for unexpected render errors.
2. `Searchbar` accepts type-to-search input and schedules cancellable searches.
3. `PageSearchIndex` keeps candidate DOM records current with a `MutationObserver`.
4. `NodeScorer` evaluates visible text and searchable attributes.
5. If that pass matched nothing, a second pass rescores the same text with `fuzzy_match`,
   which finds the closest matching span by bounded edit distance. A span may start anywhere,
   mirroring the substring semantics of exact search, so a typo inside a partly typed word
   still matches. Approximate matching never runs for a search that already has results, and
   each match carries the page's own spelling so highlighting can find it.
6. Results are split into text blocks and actionable elements.
7. `page_search_index` also emits a short ranked slate across both kinds, which `useSuggestions`
   holds steady between keystrokes and `ResultsPanel` renders. The slate is a view of the one
   selection, never a second cursor.
8. `useSearchNavigation` retains an independent cursor for each mode.
9. `useHighlights` uses the CSS Custom Highlight API without rewriting host-page DOM.
10. The MV3 background responds to toolbar clicks and injects the content assets into eligible tabs
   that were already open at installation time.

## Navigation invariants

- Text mode is the primary mode: `Tab` moves forward and `Shift + Tab` moves backward.
- A text result is a complete semantic block (`p`, `li`, headings, table cells, and similar), not an
  isolated matching descendant.
- Jumping to text must create a native selection covering the whole block so `Ctrl + C` copies it.
- A text result may carry a nested or containing action. `Enter` activates that action; otherwise it
  does nothing.
- Attribute-only matches, such as an `aria-label` whose visible text does not match, must not appear
  in text mode.
- Action mode contains only links, buttons, inputs, and configured action selectors. Its requested
  shortcuts are `Ctrl + Tab` and `Shift + Ctrl + Tab`.
- Unmodified `Enter` preserves click/focus behavior in the current tab. `Shift + Enter` requests an
  active new tab and `Ctrl + Enter` requests an inactive background tab through the validated
  content-to-background message. Modified Enter is link-only and must not synthesize a new-tab
  action for buttons or inputs.
- In text mode, native copy yields the whole selected block. In action mode, `Ctrl + C` (or
  `Command + C` on macOS) copies the selected link's normalized URL.
- Keep text and action cursors independent and reset both to `null` when a query changes.
- Do not automatically preselect a result before the user invokes a navigation shortcut.
- Browsers may reserve `Ctrl + Tab` before content scripts receive it. Do not claim that page code
  can override a browser-level shortcut reservation.

## Accessibility invariants

- Every input and setting control needs an explicit accessible name; do not use `list` or another
  ARIA relationship unless the corresponding owned element and behavior exist.
- Associate setting descriptions with their controls and keep visible labels clickable.
- Match-position changes are an atomic polite live status so screen readers announce navigation.
- Error recovery UI must be keyboard reachable and announced without depending on host-page CSS.

## Styling invariants

Shadow DOM styles are injected as a string through `content.css?inline`, the page-level
highlight rules ship as a manifest stylesheet, and the toolbar popup loads both `content.css`
and `popup.css` as ordinary documents. Rules shared between those contexts live in
`content.css`; anything that applies to one of them is scoped, such as `#keymove-popup`.

Never read a custom property without a fallback. An unresolved `var()` is invalid at
computed-value time, which resets the whole declaration it appears in. Inside a shorthand
that resets every longhand it controls, so `border: 2px solid rgb(var(--accent))` becomes
`border-style: none` and the element disappears rather than rendering in the wrong colour.
Whether custom properties resolve under `:host { all: initial }` has not been established
here, so `src/content_css.test.ts` rejects any `var()` in the shadow styles that has no
fallback.

Selection overlay colours are computed to concrete `rgba()` strings and applied as inline
styles rather than through CSS. `::highlight()` cannot take inline styles, so it reads
custom properties set on the page root, using longhands with literal fallbacks.

## Settings and the toolbar popup

Every setting is stored in `browser.storage.local`, and the content script subscribes to
`browser.storage.onChanged`. The popup therefore needs no messaging: writing a setting there
reaches every open tab on its own. Add settings by extending the stored settings schema and
the hook, never by sending messages between the popup and content scripts.

Setting `default_popup` means `browser.action.onClicked` never fires. The toolbar icon opens
the settings popup and cannot also summon the searchbar; `Alt + F` and always-on typing are
the ways in.

## Popup position and storage

The default popup center is `{ x: 0.5, y: 0.75 }`, expressed as normalized viewport coordinates.
Dragging persists `popupPosition` to `browser.storage.local`; the help panel can reset it. Retain
normalized coordinates so the position adapts to viewport changes and clamp rendered pixels so the
popup stays on-screen.

Stored keys:

- `autoHide`: boolean
- `alwaysOn`: boolean
- `startInActionMode`: boolean
- `highlightMatches`: boolean
- `showAutohideButton`: boolean
- `popupPosition`: `{ x: number; y: number }`, with both values finite and in `[0, 1]`
- `highlightColors`: `{ text: string; actions: string }`, each a `#rrggbb` string

Treat JSON imports, extension storage, storage change events, extension messages, and browser API
responses as runtime-untrusted. Validate them through the matching `src/lib/*_schema.ts` module or a
focused type guard before use. TypeScript types alone are not runtime validation.

## Dependency footprint and Node version

The project declares only two direct runtime packages (`react` and `react-dom`) plus 18 direct
development packages. The packages under `node_modules/` are predominantly transitive dependencies
of WXT/Vite, web-ext (the development browser launcher), Vitest/jsdom/Testing Library, TypeScript,
Oxlint/tsgolint, Oxfmt, React tooling, and SVGR.
Yarn 1 hoists these transitive packages into the
top-level installation, so their presence does not mean the extension imports or ships all of them.

`node_modules/` is local, ignored development state. WXT tree-shakes and bundles reachable runtime
code only; the measured unpacked Chromium and Firefox artifacts are each roughly 317 KB. Do not
judge the published extension footprint from the development installation size, and do not remove a
transitive package manually from `node_modules/` or `yarn.lock`.

`package.json` is the single repository source for the supported Node range and currently requires
Node `>=24.15.0`. There is no `.nvmrc`; developers should verify `node --version` before installing
or building rather than assuming a version manager selected a compatible runtime.

## Branding boundaries

User-facing manifest identity, runtime display names, artifact name, and contact address come from
`src/extension_identity.ts`. Build validation must compare generated metadata with that source
instead of hard-coding the current name. Do not restore removed community or social links without
an approved KeyMove destination.

The lowercase `keymove` strings used by Shadow DOM IDs, CSS selectors, highlight names, storage keys,
and internal message types are an implementation namespace, not display branding. Keep that
namespace stable during a display-name change unless an explicit internal migration is intended;
blindly replacing it can break selectors, stored preferences, and content/background messaging.

## Development rules

- Use strict TypeScript and preserve explicit DOM null handling.
- Source imports intentionally use `.js` extensions so emitted ESM and tooling resolve consistently.
- WXT provides `defineBackground` and `defineContentScript`; their globals are declared in Oxlint's
  entrypoint override.
- Use `browser.action` and `browser.scripting`; do not reintroduce MV2 APIs such as `browserAction`,
  `tabs.executeScript`, or `tabs.insertCSS`.
- Keep the content bundle free of CommonJS `require()` calls.
- Preserve the Shadow DOM boundary. Page-wide visual search marks belong in `highlights.css`; UI
  styles belong in `content.css`.
- Search work must remain cancellable and chunked to avoid blocking large pages. The fuzzy pass
  is part of that budget; it reuses the text gathered by the exact pass rather than walking the
  DOM again, because deriving visible text costs far more than comparing it.
- A `TextMatch` carries the literal slice of its node that matched. Highlighting locates that
  slice, so it must stay a verbatim substring of the node's visible text.
- Add or update tests for navigation shortcuts, DOM indexing, storage validation, and build-shape
  changes.
- Preserve unrelated user changes and leave generated build output untracked.

## Verification

After every meaningful implementation change, run `yarn preview`. It rebuilds the production MV3
extension, selects the first installed browser in this order: Vivaldi, Chrome, Firefox, and opens
`https://github.com/valentindimitrov/keymove` with the extension loaded in a fresh temporary test
profile. This launch is authorized as part of the development workflow; do not ask again each time.
The launcher marks Vivaldi's welcome screen and all setup pages as read, and disables its exit
confirmation in that temporary profile. Keep `vivaldi.welcome.read_pages` as an array passed through
the web-ext JavaScript API; the CLI preference parser would turn it into a string.
For Chromium browsers the launcher opens and focuses the repository after extension installation,
verifies its tab title and URL, then closes only Vivaldi's welcome tab in that test instance.
Do not rely on Vivaldi's startup URL: first-run initialization can replace it with the welcome page.
Keep the user's regular browser profiles untouched. Close the previous test window when finished
with it; do not terminate unrelated browser processes. The preview command stays running until the
test browser closes or it is stopped with Ctrl+C.

- `yarn preview`: rebuild and open the preferred installed browser.
- `yarn preview:vivaldi`, `yarn preview:chrome`, `yarn preview:firefox`: rebuild and open that browser.
- `yarn browser:open`: open the existing production build after `yarn quality` or `yarn build`,
  avoiding a redundant rebuild. It uses the same browser preference order.

Detection covers standard Windows/macOS installation locations and executable directories on PATH.
For a custom installation, set `KEYMOVE_VIVALDI_BINARY`, `KEYMOVE_CHROME_BINARY`, or
`KEYMOVE_FIREFOX_BINARY` to its absolute executable path. If no supported browser is installed or
loading fails, report the actual blocker; do not claim an installed-browser test from a mocked page.
Opening the browser alone is not a behavioral test: report separately what was actually checked.

During focused work, run the relevant Vitest files plus `yarn typecheck`. Before handoff, run:

```text
yarn quality
```

That command checks Oxfmt formatting, Oxlint linting, strict TypeScript, all tests, both MV3 builds, and
the generated artifacts. If running steps separately, `yarn verify` requires a completed
`yarn build` first.
