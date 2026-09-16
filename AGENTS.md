# AGENTS.md

## Project purpose and status

This repository contains KeyMove, a keyboard-first in-page search browser extension. It is being
prepared as a new extension rather than an update to an existing store listing. The KeyMove name
and artwork are applied; repository metadata, store metadata, extension IDs, upstream relicensing
permission, and upstream contribution documentation remain pending. Original KeyMove contributions
by Valentin Dimitrov use Apache License 2.0; inherited and adapted Comake code retains BSD 4-Clause.
Comake has been contacted about relicensing; permission remains pending. Preserve both
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
|-- preview/                 Shadow-root harness for visual checks, served by `yarn preview:ui`
|-- scripts/
|   `-- validate-builds.ts   Manifest and generated-bundle checks
|-- src/
|   |-- background.ts        Settings requests, new tabs, and safe injection
|   |-- components/searchbar React search UI, overlays, help, and settings
|   |-- data/                 Validated JSON search configuration and shortcuts
|   |-- hooks/                Browser events, storage, highlights, and navigation state
|   |-- icons/                UI SVG modules
|   |-- lib/                  Search index, scoring, schemas, and utilities
|   |-- test_support/        Builders for test fixtures, never imported by shipped code
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
7. `page_search_index` also emits all distinct ranked candidates across both kinds. `useSuggestions`
   applies stability before selecting the configured number of mixed suggestions (three by default), retaining its history while a query
   or DOM refresh is pending. Pending rows stay visible but cannot be selected, keeping the pane
   mounted until fresh results arrive. The frame stays open without shrinking for queries of at
   least three characters, including completed empty results. Short queries and completed empty results
   clear history. `ResultsPanel` is a view of the one selection, never a second cursor.
8. `useSearchNavigation` retains an independent cursor for each mode.
9. `useHighlights` uses the CSS Custom Highlight API without rewriting host-page DOM.
10. The MV3 background handles validated settings/new-tab requests and injects the content assets
   into eligible tabs that were already open at installation time. The toolbar opens the settings popup.

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
- Keep text and action cursors independent and clear both while a new query is pending.
- Automatically select the first result when a new query returns matches, so Enter works
  immediately. A DOM refresh retains the selected node, or clears it if that node disappeared.
- Browsers may reserve `Ctrl + Tab` before content scripts receive it. Do not claim that page code
  can override a browser-level shortcut reservation.

## Control discovery and modal navigation

Control names resolve associated labels, `aria-labelledby`, `aria-label`, and image alternative
text through `control_name.ts`. Name traversal is chunked and cached by page mutation revision;
referenced label changes must invalidate dependent names. Names are action metadata and must
never manufacture visible text matches. Disabled controls may be listed as unavailable but must
not activate. Native checkboxes/radios/buttons/disclosures use click behavior; editors and complex
widgets receive focus and retain their keyboard input.

`modal_context.ts` identifies native modal dialogs and visible ARIA modal dialogs. Both navigation
modes remain inside the active modal; nonmodal panels do not scope search. The existing shadow
host moves inside the modal so native inertness does not block the UI, and returns on close.
Recheck action availability at activation time, including for actions attached to text results.

## Language support

Search accepts Unicode letters, numbers, and combining marks. Queries, visible text and
searchable attributes share NFC normalization and locale-independent case conversion, including
Greek final sigma. Accents remain significant; there is no transliteration or synonym expansion.
Highlight and suggestion offsets map back to the unchanged original text, including decomposed
accents. Supplementary characters count as one code point in fuzzy matching. For IME entry, focus
the search field with Alt+F before composing; never intercept an unfinished page-input composition.
Measure browser timings when changing normalization, and report significant regressions.

## Result action menu

Down opens the custom action menu only from the focused search input with a current result.
Up is reserved outside the menu. Inside it, Up/Down navigate actions, Enter/Space execute,
Escape returns to the unchanged query, and Tab/Shift+Tab resume result navigation. The menu
uses native focus on menu items and is not a second result cursor. Query changes and index
refreshes dismiss it; execution rechecks connectivity, visibility, disabled state and modal scope.
Clipboard failures remain visible and announced. Successful copying retains the search; focus-only
hands control to the page without activation. Menu styling stays in the existing shadow root.
Keep only the selected result's suggestion row above the actions, including its match and context.
Number the actions, not that retained row. Alt+number executes the corresponding menu action
without selecting another suggestion; outside the menu the existing suggestion shortcuts remain.

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
Dragging persists `popupPosition` to `browser.storage.local`; the toolbar settings can reset it. Retain
normalized coordinates so the position adapts to viewport changes and clamp rendered pixels so the
popup stays on-screen.

Stored keys:

- `autoHide`: boolean
- `suggestionCount`: integer from 1 to 5, defaults to 3; larger saved counts clamp to 5. Limits displayed suggestions, never navigation results
- `alwaysOn`: boolean
- `startInActionMode`: boolean
- `highlightMatches`: boolean
- `showAutohideButton`: boolean
- `lockPositionAndSize`: boolean; blocks dragging, resizing, position presets and reset until unlocked
- `popupPosition`: `{ x: number; y: number }`, with both values finite and in `[0, 1]`
- `popupWidth`: number of pixels, clamped into the usable range rather than rejected, so a
  window that shrank between sessions does not discard a deliberate choice
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
code only. Measure the current unpacked artifacts in `.output/`; both include a content script
and a separate settings popup with shared chunks. Do not
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

- Before work, run `yarn worktree:check` and verify the checkout path and branch.
  Each concurrent implementation task must own a separate worktree; run
  `yarn worktree:check --require-linked` there before editing. Do not assign two
  writers to the same linked checkout. Subagents do not get isolation automatically:
  when delegation is requested, create and assign an absolute worktree path before
  a subagent edits or builds. Read-only review may share files. A single foreground
  task may use the primary checkout. See `docs/development.md` for setup and integration.
- When opening a pull request, use `.github/pull_request_template.md` even when creating
  the pull request through the command line. Complete every relevant section and checkbox;
  explain any verification or release-impact item that does not apply.
- Keep implementation batches focused on one behavior or subsystem. Reproduce bugs
  with a failing regression check before fixing them. Keep cleanup separate from
  performance work and record before/after browser timing samples for optimizations.
- Start search on every nonempty keystroke immediately. Do not add debounce or an
  initial idle wait. Preserve cancellable chunks and discard superseded results.

- Use strict TypeScript and preserve explicit DOM null handling.
- Source imports intentionally use `.js` extensions so emitted ESM and tooling resolve consistently.
  Directly executed Node scripts use `.ts` for local runtime imports because they run without
  emitting JavaScript; bundled source and Vitest imports continue to use `.js`.
- WXT provides `defineBackground` and `defineContentScript`; their globals are declared in Oxlint's
  entrypoint override.
- Use `browser.action` and `browser.scripting`; do not reintroduce MV2 APIs such as `browserAction`,
  `tabs.executeScript`, or `tabs.insertCSS`.
- Keep the content bundle free of CommonJS `require()` calls.
- Appearance is invisible to the test suite: a wrong font, a mismatched transparency or a bad
  wrap changes no structure, role or class, so every assertion still passes. Check anything
  visual through `yarn preview:ui`, which renders the real components in the real shadow root,
  and add a scenario for a state worth looking at again.
- `:host` sets `all: initial`, so anything that does not declare a font inherits the browser
  default, a serif at 16px. `#keymove-app` and `#keymove-portal` declare the interface type for
  everything below them; a new subtree outside both has to declare its own.
- Build search-result fixtures with `src/test_support/factories.ts` rather than object literals.
  Those types have gained a field four times, and each literal is a place that has to be found
  and corrected by hand.
- Preserve the Shadow DOM boundary. Page-wide visual search marks belong in `highlights.css`; UI
  styles belong in `content.css`.
- Search work must remain cancellable and chunked to avoid blocking large pages. The fuzzy pass
  is part of that budget; it reuses the text gathered by the exact pass rather than walking the
  DOM again, because deriving visible text costs far more than comparing it.
- Search, highlighting, and copied text use the shared whitespace-aware reader in
  `visible_text.ts`. A `TextMatch` carries a slice of its case-folded searchable text;
  highlighting maps that slice back to DOM boundaries. Preserve preformatted whitespace,
  collapse ordinary whitespace across inline nodes, and keep structural line-break separators.
  Keep the reader chunked and its offset mapping proportional to text segments, not characters.
- Add or update tests for navigation shortcuts, DOM indexing, storage validation, and build-shape
  changes.
- Preserve unrelated user changes and leave generated build output untracked.

## Verification

After every meaningful implementation change, run `yarn preview`. It rebuilds the production MV3
extension, selects the first installed browser in this order: Vivaldi, Chrome, Firefox, and opens
`https://github.com/valentindimitrov/keymove` with the extension loaded in a fresh temporary test
profile, using a separate temporary copy of the build for each launch. This launch is authorized
as part of the development workflow; do not ask again each time.
The launcher marks Vivaldi's welcome screen and all setup pages as read, and disables its exit
confirmation in that temporary profile. Keep `vivaldi.welcome.read_pages` as an array passed through
the web-ext JavaScript API; the CLI preference parser would turn it into a string.
For Chromium browsers the launcher opens and focuses the repository after extension installation,
verifies its tab title and URL, then closes only Vivaldi's welcome tab in that test instance.
Do not rely on Vivaldi's startup URL: first-run initialization can replace it with the welcome page.
Use the dedicated preview profile for browser checks. Each preview installs its own snapshot of
the build and opens the page after installation; a page hard refresh (`Ctrl+Shift+R`) is not a
substitute for reloading the extension and its in-page code. Start a new preview after changes.
Keep the user's regular browser profiles untouched. The production build still updates
`.output/chrome-mv3`, which may be registered in a regular profile, but previews load their own
temporary copy. Close the previous test window when finished with it; do not terminate unrelated
browser processes. The command stays running until the test browser closes or Ctrl+C stops it,
then removes its temporary build copy.

- `yarn preview`: rebuild and open the preferred installed browser.
- `yarn preview --smoke` / `yarn test:browser`: rebuild, run the actual extension's
  automated Chromium interaction checks, record cold/warm timings under `.artifacts/`,
  and close the dedicated browser. This also fulfills the preview launch requirement.
- `yarn test:browser:built`: run smoke on existing production output after `yarn quality`.
  Run it for input, navigation, search, settings, and extension-mounting changes.
  Firefox behavior still requires a manual installed-browser check.
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
