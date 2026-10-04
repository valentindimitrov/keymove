# Development reference

### Checking the interface

`yarn preview:ui` serves the searchbar on `http://localhost:5174` in the shadow root it really
uses, with the real stylesheet and the real components. Each state is its own URL, so a screenshot
is reproducible and a diff is obvious:

```
http://localhost:5174/?scenario=slate-approximate
http://localhost:5174/?scenario=slate-above&browser=firefox
```

Open the root for the list of scenarios. Nothing is mocked but the data, so what renders is what
ships.

This exists because appearance is the one thing the test suite cannot see. A wrong font, a
mismatched transparency, or text wrapping in the wrong place changes no structure, role or class,
so every assertion still passes. Add a scenario when a state is worth looking at again.

| Command | Purpose |
| --- | --- |
| `yarn dev` | Start the Chromium MV3 development build. |
| `yarn dev:firefox` | Start the Firefox MV3 development build. |
| `yarn preview` | Rebuild and open the repository with the extension in the first installed browser: Vivaldi, Chrome, Firefox. |
| `yarn preview:vivaldi` / `yarn preview:chrome` / `yarn preview:firefox` | Rebuild and preview in a specific browser. |
| `yarn browser:open` | Open an already-built extension with the same automatic browser selection. |
| `yarn preview:ui` | Serve the interface on `localhost:5174` for a visual check, without a browser extension install. |
| `yarn build` | Build both production targets. |
| `yarn build:chromium` | Build the Chromium/Vivaldi artifact. |
| `yarn build:vivaldi` | Explicit alias for the Chromium artifact used by Vivaldi. |
| `yarn build:firefox` | Build the Firefox artifact. |
| `yarn zip` | Package both browser builds under `.output`. |
| `yarn package:chrome` | Build a signed Chrome Web Store CRX using the key in Proton Pass. |
| `yarn verify:crx` | Verify the CRX signature and its exact ZIP payload without the private key. |
| `yarn format` | Format supported source and configuration files with Oxfmt. |
| `yarn format:check` | Check formatting without writing files. |
| `yarn lint` | Run Oxlint correctness, React Hooks, and type-aware promise checks. |
| `yarn lint:fix` | Apply Oxlint's safe automatic fixes. |
| `yarn typecheck` | Run strict TypeScript checks without emitting files. |
| `yarn test` | Run the Vitest/jsdom test suite. |
| `yarn verify` | Validate completed manifests and bundles after a build. |
| `yarn quality` | Run formatting, linting, types, tests, both builds, and artifact validation. |

Preview commands use `web-ext` to load the extension in a fresh temporary browser profile, leaving
your regular profile untouched. Vivaldi's welcome screen and exit confirmation are skipped in the test profile.
Each preview installs a separate temporary copy of the build, removed when the preview exits.
Use a new preview after changes: a page hard refresh does not reload the extension itself.
Production builds still update `.output/chrome-mv3`, which may also be loaded in a regular profile.
They stay running until you close the test browser or press Ctrl+C.
After meaningful implementation changes, use `yarn preview`; after `yarn quality`, use
`yarn browser:open` to reuse the verified build. For custom browser locations, set
`KEYMOVE_VIVALDI_BINARY`, `KEYMOVE_CHROME_BINARY`, or `KEYMOVE_FIREFOX_BINARY` to the absolute
executable path. The browser opens `https://github.com/valentindimitrov/keymove` for testing.

Formatting preferences live in `.oxfmtrc.json`; lint rules and WXT/Vitest globals live in
`.oxlintrc.json`. Generated output, coverage, and dependencies are excluded. Markdown and the
Yarn lockfile remain outside formatting. Formatter-managed source files use LF endings, enforced
on checkout by `.gitattributes`.

Oxlint uses an explicit ruleset with React Hooks dependency checks at warning severity. Assignment
checks cover conditions and return values; they do not cover every expression context previously
checked by Biome. Duplicate parameters and `with` statements are rejected by the module parser.
Type-aware linting uses `oxlint-tsgolint` to check floating promises, misused promises, and awaiting
non-thenable values. It runs automatically through `yarn lint`, `yarn lint:fix`, and `yarn quality`.
The generated WXT types must be available (`yarn install` runs `wxt prepare`). Strict TypeScript
checking remains a separate required step.

Run `yarn audit` to check dependency advisories. Two scoped `package.json` resolutions select
patched development dependencies: `cosmiconfig/js-yaml` and `addons-linter/image-size`. Remove each
pin when its parent requests a patched version itself. Babel and ansi-regex resolve normally.

Pull requests and pushes to `main` run `yarn quality`. Release preparation runs the same full gate
before packaging and revalidates the resulting artifacts, including the settings popup and its assets.
Installed-browser smoke remains a separate local check.

### Architecture

- [entrypoints/content.tsx](../entrypoints/content.tsx) mounts the interface inside an isolated Shadow
  DOM and restores it if a page replaces `document.body`.
- [src/components/searchbar/searchbar.tsx](../src/components/searchbar/searchbar.tsx) coordinates input,
  the two navigation modes, activation, selection, and copying.
- [src/lib/page_search_index.ts](../src/lib/page_search_index.ts) maintains a mutation-aware page index
  and performs cancellable, chunked searches.
- [src/lib/node_scorer.ts](../src/lib/node_scorer.ts) scores visible text and configured searchable
  attributes.
- [src/hooks/use_highlights.ts](../src/hooks/use_highlights.ts) uses the CSS Custom Highlight API
  without inserting wrappers into host-page content.
- [src/background.ts](../src/background.ts) handles settings requests, safe MV3 injection, and validated
  new-tab requests.

Shared search attributes and keyboard shortcuts live in `src/data`. Repository conventions and
implementation invariants are documented in [AGENTS.md](../AGENTS.md).
