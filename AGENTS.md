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
|-- entrypoints/
|   |-- background.ts        WXT background entrypoint
|   `-- content.tsx          WXT content-script and React mount
|-- assets/                  Static extension logo files copied by WXT
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
|-- biome.json               Formatting and lint rules
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
4. `NodeScorer` evaluates visible text and configured searchable attributes.
5. Results are split into text blocks and actionable elements.
6. `useSearchNavigation` retains an independent cursor for each mode.
7. `useHighlights` uses the CSS Custom Highlight API without rewriting host-page DOM.
8. The MV3 background responds to toolbar clicks and injects the content assets into eligible tabs
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

## Popup position and storage

The default popup center is `{ x: 0.5, y: 0.75 }`, expressed as normalized viewport coordinates.
Dragging persists `popupPosition` to `browser.storage.local`; the help panel can reset it. Retain
normalized coordinates so the position adapts to viewport changes and clamp rendered pixels so the
popup stays on-screen.

Stored keys:

- `autoHide`: boolean
- `useOnEveryWebsite`: boolean
- `alwaysOn`: boolean
- `popupPosition`: `{ x: number; y: number }`, with both values finite and in `[0, 1]`

Treat JSON imports, extension storage, storage change events, extension messages, and browser API
responses as runtime-untrusted. Validate them through the matching `src/lib/*_schema.ts` module or a
focused type guard before use. TypeScript types alone are not runtime validation.

## Dependency footprint and Node version

The project declares only two direct runtime packages (`react` and `react-dom`) plus 15 direct
development packages. The roughly 331 package manifests and 215 MB currently visible under
`node_modules/` are predominantly transitive dependencies of WXT/Vite, Vitest/jsdom/Testing
Library, TypeScript, Biome, React tooling, and SVGR. Yarn 1 hoists these transitive packages into the
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
- WXT provides `defineBackground` and `defineContentScript`; their globals are declared in Biome's
  entrypoint override.
- Use `browser.action` and `browser.scripting`; do not reintroduce MV2 APIs such as `browserAction`,
  `tabs.executeScript`, or `tabs.insertCSS`.
- Keep the content bundle free of CommonJS `require()` calls.
- Preserve the Shadow DOM boundary. Page-wide visual search marks belong in `highlights.css`; UI
  styles belong in `content.css`.
- Search work must remain cancellable and chunked to avoid blocking large pages.
- Add or update tests for navigation shortcuts, DOM indexing, storage validation, and build-shape
  changes.
- Preserve unrelated user changes and leave generated build output untracked.

## Verification

During focused work, run the relevant Vitest files plus `yarn typecheck`. Before handoff, run:

```text
yarn quality
```

That command checks Biome formatting and linting, strict TypeScript, all tests, both MV3 builds, and
the generated artifacts. If running steps separately, `yarn verify` requires a completed
`yarn build` first.
