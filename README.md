<p align="center">
  <img src="assets/logo-192.png" width="112" height="112" alt="KeyMove logo">
</p>

# KeyMove

Search and navigate any web page without leaving the keyboard.

KeyMove finds visible page text and interactive controls as you type. Use ordinary `Tab` navigation
to move through complete text blocks, or switch to action navigation for links, buttons, and inputs.
Selected text is ready to copy, and selected links can be opened in the current tab, a new tab, or
a background tab.

> [!IMPORTANT]
> KeyMove is not published in browser extension stores yet. The current version can be built and
> loaded locally for Chromium, Vivaldi, and Firefox.

## Features

- Start typing on a page to search immediately—no search dialog required.
- Fall back to approximate matching when a query has no exact match, so typos still find results.
- Navigate matching paragraphs and other semantic text blocks in either direction.
- Select the complete text block automatically for quick copying with `Ctrl + C` or `Command + C`.
- Switch between text and action results with a single shortcut, each keeping its own position.
- Open selected web links in the current tab, a foreground tab, or a background tab.
- Copy the URL of a selected link directly from action mode.
- Keep results current as dynamic pages change without rewriting the page DOM.
- Move the search interface anywhere on screen and retain its position across pages and sessions.
- Use an accessible, keyboard-operable settings panel with announced match counts.
- Store preferences locally with no account, sign-in, analytics, or remote search service.

## Using KeyMove

Click the KeyMove toolbar button or simply begin typing while the page itself has focus. Matching
page text is highlighted as the query changes.

KeyMove has two independent navigation modes:

- **Text mode** selects complete paragraphs, headings, list items, table cells, and comparable text
  blocks. This is the primary mode and uses `Tab` and `Shift + Tab`.
- **Action mode** selects only interactive elements such as links, buttons, and inputs. It uses
  `Ctrl + Tab` and `Shift + Ctrl + Tab`.

The two modes retain separate positions. Changing the search query clears both positions, so
KeyMove never preselects a result before you choose a navigation command.

Each mode shows up to 50 results. Visual highlighting is limited to 500 occurrences per query;
navigation and copying still use complete text blocks. The page index is released when search
ends, and large indexing jobs yield between chunks so they can be cancelled.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Tab` | Select the next match in the active mode. |
| `Shift + Tab` | Select the previous match in the active mode. |
| `Ctrl + Tab` | Select the next matching action. |
| `Shift + Ctrl + Tab` | Select the previous matching action. |
| `Alt + S` | Switch between text mode and action mode. Use `Option + S` on macOS. |
| `Enter` | Activate the selected action in the current tab. |
| `Shift + Enter` | Open the selected `http` or `https` link in a new foreground tab. |
| `Ctrl + Enter` | Open the selected `http` or `https` link in a new background tab. |
| `Ctrl + C` | Copy the selected text block or selected link URL. Use `Command + C` on macOS. |
| `Ctrl + Backspace` | Clear the search. Use `Command + Backspace` on macOS. |
| `Alt + F` | Focus KeyMove. Use `Option + F` on macOS. |
| `Escape` | Clear the current search, or hide KeyMove when the search is already empty. |

In text mode, `Enter` also activates a link or control associated with the selected text block. For
buttons and inputs, unmodified `Enter` preserves their normal click or focus behavior; modified
Enter shortcuts never try to open them as new tabs.

### Search modes

Every search collects two result sets at once, and the mode decides which one `Tab` walks:

- **Text** matches visible page copy—paragraphs, list items, headings, table cells—and selects the
  whole semantic block, so it is ready to copy.
- **Actions** matches links, buttons, inputs, and elements with a link, button, checkbox, or tab
  role. Matching uses the control's visible label plus its `title`, `aria-label`, `name`,
  `placeholder`, and similar attributes. Link URLs are not searched, so a link reading *Learn more*
  is not found by typing `pricing`.

`Alt + S` switches between them. It only re-points `Tab`; it never moves a selection or activates
anything. Each mode keeps its own cursor, so switching away and back returns you to where you left
off, and the chosen mode persists while you keep typing. Ending a search returns to the default
mode, which the **Start in action mode** setting chooses. When action mode has no matches
but text does, navigation falls back to the text results rather than presenting an empty list. The
fallback does not change the chosen mode, so editing the query tries actions again. The mode itself is never shared between
tabs: each page starts from the stored default.

The searchbar shows the active mode with the position and count for that mode alone, such as
`Text 3 / 12`. The first match is selected as soon as results arrive, so `Enter` acts on it without
pressing `Tab` first.

### Approximate matching

When a query matches nothing on the page, KeyMove searches again for the closest spellings rather
than reporting nothing. `setings` finds *settings*, `recieve` finds *receive*, and `compsoe` finds a
*Compose* button. It applies to both modes.

Approximate matching follows the same rule as exact matching: a match may begin anywhere, not only
at the start of a word. Typing `contribu` finds *Contributing* exactly, and `contribuu` still finds
it, one edit from that same prefix.

Closeness is measured in single-character edits, counting a swap of neighbouring letters as one
edit, since that is the most common typing slip. The budget grows with the query so that short
queries stay strict:

| Query length | Edits allowed |
| --- | --- |
| 1–2 characters | none; matched exactly |
| 3–5 characters | 1 |
| 6 or more | 2 |

A query spanning several words is matched as one span, so `acount setings` finds *account settings*
as a phrase rather than the two words in unrelated places. In action mode, nearer spellings rank
above more distant ones; text blocks stay in page order, as they do for an exact search.

This is strictly a fallback. As long as a query matches anything exactly, only exact results are
shown—one incidental match will suppress a closer approximate one. Approximate results are marked
with `~` beside the mode, as in `Text ~ 1 / 3`, so a count never implies the page contains something
it does not, and matches are highlighted using the page's own spelling rather than what you typed.

> [!NOTE]
> Chromium-based browsers may reserve `Ctrl + Tab` for browser-tab switching. Action mode works when
> the browser delivers the shortcut to the page, but a content script cannot override a
> browser-level reservation. `Alt + S` is unaffected: switch to action mode once, then use plain
> `Tab` and `Shift + Tab` to move through actions.

## Settings

Open the **KeyMove help and settings** button inside the search interface to configure:

- **Always on:** begin searching whenever you type while another input is not focused.
- **Start in action mode:** begin each search in action mode instead of text mode.
- **Highlight matches:** tint matching text on the page, and mark the current one.
- **Show autohide button:** show the eye icon that turns Autohide on and off from the searchbar.
  Off by default; Autohide itself stays available in this panel.
- **Autohide:** hide the interface when it is not being used.
- **Reset popup position:** return the interface to its default location—horizontally centered with
  its center 75% down the viewport.

Dragging the interface saves normalized screen coordinates in extension-local storage. This keeps
the chosen position useful across different window sizes.

## Browser support

KeyMove is a Manifest V3 extension with separate production builds for:

- Chrome and other Chromium browsers
- Vivaldi, using the Chromium build
- Firefox

Browser-owned pages such as `chrome://extensions`, `vivaldi://extensions`, extension stores, and
similar protected pages do not allow content scripts. Access to local `file://` pages must be
enabled manually in the browser's extension settings. New-tab shortcuts intentionally open only
`http` and `https` links.

## Install from source

### Requirements

- Node.js `24.15.0` or newer
- Yarn `1.22`

From a local checkout:

```sh
yarn install --frozen-lockfile
yarn build
```

The build creates:

- `.output/chrome-mv3` for Chrome, Chromium, and Vivaldi
- `.output/firefox-mv3` for Firefox

### Chrome, Chromium, or Vivaldi

1. Open the browser's extension management page. In Vivaldi, use `vivaldi://extensions`.
2. Enable developer mode.
3. Choose **Load unpacked**.
4. Select `.output/chrome-mv3`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `.output/firefox-mv3/manifest.json`.

Temporary Firefox installations are removed when Firefox closes. A permanent Firefox package will
require the release extension ID and normal signing process.

## Privacy and permissions

KeyMove processes page content locally in the browser. It has no user account, email sign-in,
telemetry, analytics, or remote search backend.

The extension requests:

- **Site access** so it can search and navigate the pages where it is enabled.
- **Storage** to retain settings and the popup position locally.
- **Scripting** to initialize KeyMove safely in eligible tabs that were already open when the
  extension was installed.

Runtime data from imported configuration, extension storage, browser messages, and browser APIs is
validated before use.

## Development

| Command | Purpose |
| --- | --- |
| `yarn dev` | Start the Chromium MV3 development build. |
| `yarn dev:firefox` | Start the Firefox MV3 development build. |
| `yarn build` | Build both production targets. |
| `yarn build:chromium` | Build the Chromium/Vivaldi artifact. |
| `yarn build:vivaldi` | Explicit alias for the Chromium artifact used by Vivaldi. |
| `yarn build:firefox` | Build the Firefox artifact. |
| `yarn zip` | Package both browser builds under `.output`. |
| `yarn format` | Format supported source and configuration files with Oxfmt. |
| `yarn format:check` | Check formatting without writing files. |
| `yarn lint` | Run Oxlint correctness, React Hooks, and type-aware promise checks. |
| `yarn lint:fix` | Apply Oxlint's safe automatic fixes. |
| `yarn typecheck` | Run strict TypeScript checks without emitting files. |
| `yarn test` | Run the Vitest/jsdom test suite. |
| `yarn verify` | Validate completed manifests and bundles after a build. |
| `yarn quality` | Run formatting, linting, types, tests, both builds, and artifact validation. |

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

Run `yarn audit` to check dependency advisories. The `package.json` resolutions keep the development
tooling dependencies `ansi-regex` and `@babel/runtime` above their known vulnerable versions.

### Architecture

- [entrypoints/content.tsx](entrypoints/content.tsx) mounts the interface inside an isolated Shadow
  DOM and restores it if a page replaces `document.body`.
- [src/components/searchbar/searchbar.tsx](src/components/searchbar/searchbar.tsx) coordinates input,
  the two navigation modes, activation, selection, and copying.
- [src/lib/page_search_index.ts](src/lib/page_search_index.ts) maintains a mutation-aware page index
  and performs cancellable, chunked searches.
- [src/lib/node_scorer.ts](src/lib/node_scorer.ts) scores visible text and configured searchable
  attributes.
- [src/hooks/use_highlights.ts](src/hooks/use_highlights.ts) uses the CSS Custom Highlight API
  without inserting wrappers into host-page content.
- [src/background.ts](src/background.ts) handles toolbar actions, safe MV3 injection, and validated
  new-tab requests.

Shared search attributes and keyboard shortcuts live in `src/data`. Repository conventions and
implementation invariants are documented in [AGENTS.md](AGENTS.md).

## License and acknowledgements

KeyMove is inspired by and built on the original code of
[YipYip by Comake, Inc.](https://github.com/comake/yip-yip). Thank you to its original
developers for creating and sharing the project.

Original KeyMove contributions by Valentin Dimitrov are available under the **MIT License**.
Inherited and adapted YipYip code retains its **BSD 4-Clause License**, including its copyright,
attribution, advertising acknowledgement, and disclaimer requirements. Both license texts and
their scope are in [LICENSE](LICENSE), which is also included in each browser build.

An MIT-only license for the combined project is pending permission from the upstream rights
holders. Attribution does not replace that permission. KeyMove is maintained independently;
this acknowledgement does not imply Comake's endorsement.

## Contact

Questions and feedback: [keymove.impulse550@passmail.com](mailto:keymove.impulse550@passmail.com)

## Project status and TODOs
Store listings and publication (permanent extension IDs)
repository metadata
permission to relicense the upstream code under MIT,
upstream contribution documentation

Functionality:
Add actions extensibility - dictionary, search, custom pass along
links only navigation
