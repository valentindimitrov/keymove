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
- Find controls through associated form labels, `aria-labelledby`, accessible labels, and image alternative text.
- Toggle checkboxes and switches, select radio buttons, submit native buttons, and expand disclosures with Enter.
- Focus text editors and complex widgets to continue using their own keyboard controls. Disabled controls are marked unavailable and cannot be activated.
- Search inside an open modal automatically; closing it restores whole-page search without changing a setting.
- Keep results current as dynamic pages change without rewriting the page DOM.
- Move the search interface anywhere on screen and retain its position across pages and sessions.
- Use an accessible, keyboard-operable settings panel with announced match counts.
- Store preferences locally with no account, sign-in, analytics, or remote search service.

## Using KeyMove

For contributor setup, isolated agent worktrees, visual previews, browser regression
checks and search timing measurements, see [the development workflow](docs/development.md).

Press `Alt + F` or simply begin typing while the page itself has focus and Always on is enabled.
The toolbar button opens settings. Matching
page text is highlighted as the query changes.

KeyMove has two independent navigation modes:

- **Text mode** selects complete paragraphs, headings, list items, table cells, and comparable text
  blocks. This is the primary mode and uses `Tab` and `Shift + Tab`.
- **Action mode** selects only interactive elements such as links, buttons, and inputs. It uses
  `Ctrl + Tab` and `Shift + Ctrl + Tab`.

The two modes retain separate positions. Changing the search query clears both positions while
searching, then selects the first result when matches arrive so Enter works immediately.

Both modes navigate all matching results, with no result-count cap. Visual highlighting is limited
to 500 occurrences per query; navigation and copying still use complete text blocks. The page index is released when search
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
| `↓` | Open KeyMove's action menu for the selected result. |
| `Shift + Enter` | Open the selected `http` or `https` link in a new foreground tab. |
| `Ctrl + Enter` | Open the selected `http` or `https` link in a new background tab. |
| `Ctrl + C` | Copy the selected text block or selected link URL. Use `Command + C` on macOS. |
| `Ctrl + Backspace` | Clear the search. Use `Command + Backspace` on macOS. |
| `Alt + F` | Focus KeyMove. Use `Option + F` on macOS. |
| `Alt + 1` … `Alt + 5` | Select the numbered result in the panel and scroll to it. Use `Option` on macOS. |
| `Escape` | Close KeyMove in one press, staying at the current position. |
| `Alt + Backspace` | Return to the position where the current search began and close KeyMove. Use `Option + Backspace` on macOS. |

With the action menu closed, Escape and Alt+Backspace are handled only while the search field has focus. Searching and jumping
with Tab or Alt+1–5 keeps one original reading position for the current search, including nested
scrolling containers that KeyMove moves. Alt+Backspace returns there immediately, even if no page
control was focused when the search began. Escape stays at the current position; neither shortcut
restores an old field or caret. Moving focus elsewhere or activating a result ends the return session.
Use Ctrl+Backspace (Command+Backspace on macOS) to clear the query while keeping KeyMove open.

The numbered rows are a shortlist of the best matches across both modes, so a number can
land on an action while the bar is in text mode; the mode follows the row it lands on.

In text mode, `Enter` also activates a link or control associated with the selected text block. For
buttons and inputs, unmodified `Enter` preserves their normal click or focus behavior; modified
Enter shortcuts never try to open them as new tabs.

Native modal dialogs and visible `role="dialog"` / `role="alertdialog"` elements marked
`aria-modal="true"` limit both text and action results to the active dialog. Nonmodal panels do
not change the search area. Explicitly inert content is excluded. KeyMove keeps its existing
search interface inside the modal while it is open, so it remains keyboard reachable. A manual
popover renders that interface in the browser's top layer, preventing transformed or clipped
drawers from shifting its highlights or acquiring scrollable overflow from the interface.
Custom widgets must expose meaningful roles and labels; a plain `tabindex` does not make an
element an action. Complex widgets receive focus rather than synthetic keyboard events.
Styled native radios and checkboxes can be activated through their associated visible labels,
even when CSS hides the input. Enter uses native label activation, preserving change events,
radio-group behavior and disabled controls.
Visible text/number input values are searched using their current displayed value, not their
initial HTML value. These are action results: use Alt+S to switch from text results, then Enter
to focus the field. Suggestions show the field label and value together. Password and hidden
fields, file paths, and internal checkbox/radio/range values are excluded from value search.

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

### Ranked results

Once a query is at least three characters long, the strongest results appear as part of the
searchbar itself, opening downwards when there is room below and upwards when there is not. The bar
stays where you put it either way. Each row names what activating it would do and where on the page it lives, so a control
buried in a sidebar is distinguishable from one with the same label in the main content. The part
of the row that matched is marked. Settings control the number shown (three by default); long lists scroll within the available space.

Actions rank ahead of text on near-ties, since a search is more often a way to reach a control than
to read, but when showing at least two suggestions the last place is reserved for the other kind when available.
The panel reflects the current selection: automatic selection, navigation and clicking a row all
mark the selected suggestion with a gray background. No row is highlighted when the selection is outside the visible list.

Below three characters almost everything matches and the order churns on every keystroke, so
nothing is shown. At three or more characters, stability is applied across all candidates before
choosing the configured number. A matching result keeps its numbered place unless a challenger scores
more than 15% higher, including when another candidate challenges the last row. The same rule
applies to the row reserved for the other kind of result.

While a query or page refresh is pending, the panel keeps its previous rows visible without
collapsing and reopening. Those rows cannot be selected until the new results arrive.
The frame retains its height while the query has at least three characters, including an empty
result, which displays "No matches". Shortening or clearing the query closes the frame.
Completed results use fresh scores, labels, and match spans; results that stopped matching leave
immediately. Clearing the query, shortening it below three characters, or completing a search with
no matches resets that history. Search still starts on every keystroke without a debounce.

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

Click the colorful **K** logo or the browser toolbar icon to open settings. Click **Text** or
**Actions** in the searchbar to switch mode, just like `Alt + S`.

Settings include:

- **Tooltips mode:** show usage reminders and full `Alt + number` badges (`Option + number` on
  macOS). On by default, above Always on. Turn it off for compact number badges and no automatic
  hints; all keyboard shortcuts still work.
- **Appearance:** System (default), Light, or Dark. System follows your device's appearance;
  your choice applies to the searchbar, menus, and settings across open tabs.
- **Always on:** begin searching whenever you type while another input is not focused.
- **Start in action mode:** begin each search in action mode instead of text mode.
- **Highlight matches:** tint matching text on the page, and mark the current one.
- **Text highlight colour** and **Action highlight colour:** pick the colour used for each mode.
  **Reset highlight colours** restores amber and violet.
- **Show autohide button:** show the eye icon that turns Autohide on and off from the searchbar.
  Off by default; Autohide itself stays available in this panel.
- **Autohide:** hide the interface when it is not being used. On by default; existing saved choices are preserved.
- **Number of suggestions:** 1–5, defaulting to three. `Alt + 1` through `Alt + 5` select the corresponding displayed suggestion.
- **Reset popup position:** return the interface to its default location—horizontally centered with
  its center 75% down the viewport.

Dragging the interface saves normalized screen coordinates in extension-local storage. This keeps
the chosen position useful across different window sizes. Dragging its right edge resizes it, which
is worth doing on a page with long link labels: a wider bar keeps a result and its context on one
line. The toolbar popup can put both the position and the size back to their defaults.
The **Lock position and size** checkbox beside **Reset position and size** freezes manual movement and resizing across
tabs and browser restarts. It also disables the position presets and reset button until unlocked.

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
- [src/background.ts](src/background.ts) handles settings requests, safe MV3 injection, and validated
  new-tab requests.

Shared search attributes and keyboard shortcuts live in `src/data`. Repository conventions and
implementation invariants are documented in [AGENTS.md](AGENTS.md).

## License and acknowledgements

KeyMove is inspired by and built on the original code of
[YipYip by Comake, Inc.](https://github.com/comake/yip-yip). Thank you to its original
developers for creating and sharing the project.

Original KeyMove contributions by Valentin Dimitrov are available under **Apache License 2.0**.
Inherited and adapted YipYip code retains its **BSD 4-Clause License**, including its copyright,
attribution, advertising acknowledgement, and disclaimer requirements. Both license texts and
their scope are in [LICENSE](LICENSE), which is also included in each browser build.

Comake has been contacted about relicensing. An Apache-2.0-only license for the combined project
remains pending permission from the upstream rights holders. Attribution does not replace that
permission. KeyMove is maintained independently;
this acknowledgement does not imply Comake's endorsement.

## Contact

Questions and feedback: [keymove.impulse550@passmail.com](mailto:keymove.impulse550@passmail.com)

## Project status

Store listings and permanent extension IDs, repository metadata, upstream relicensing permission
(Comake contacted), and upstream contribution documentation remain pending. Resizing, layout reset,
and license acknowledgements are implemented. GitHub draft-release preparation is available;
publishing store releases remains a separate step.

Future features and issues needing reproduction are tracked in [the backlog](docs/backlog.md).

## Language support

Type-to-search accepts Unicode letters and numbers, including Cyrillic, Greek, Arabic and CJK.
Search treats composed and decomposed accents consistently while preserving accent distinctions;
for example, `café` and `cafe` are different exact queries. Matching is case-insensitive with
locale-independent Unicode casing, not language-specific transliteration. Page highlights and
suggestions retain the original spelling. Fuzzy search counts supplementary characters as whole
code points.

For input methods that compose text, such as a Japanese IME, press **Alt+F** to focus the search
field before composing. KeyMove leaves composition in other page controls alone. This is search
support for those scripts; the extension's own interface is currently in English.

## Navigation patterns

TODO: Add GIFs demonstrating these navigation patterns on the project's GitHub page once the project goes public.

This reference describes the current behavior. Examples assume the default **Text** mode and
**Always on** enabled unless stated otherwise. A sequence such as `Tab` → `Enter` means press
the keys one after the other; `Alt + F` means hold them together.

On macOS, use **Option** wherever **Alt** appears, and **Command** for copy and clear-query
shortcuts. `Ctrl + Tab` and `Ctrl + Enter` still use **Control**.

### Start or resume a search

| Situation | What to do | What happens |
| --- | --- | --- |
| Reading a page, with no editor or input focused | Start typing a word or phrase. | KeyMove opens, keeps the first character, and searches as you type. |
| Always on is disabled, or a page input already has focus | Press `Alt + F`, then type. | Focus moves to KeyMove; typing now searches instead of editing the page field. |
| Entering text with an IME | Press `Alt + F` before composing. | Compose the query in KeyMove; composition inside a page field is left alone. |
| KeyMove was closed | Press `Alt + F`, or start typing with Always on enabled. | A fresh search starts from the current page position and the configured default mode. |
| Temporarily visiting another browser tab or window | Return to the original tab. | Its query and selections are retained; each tab has its own search state. |

When results arrive for a new query, the first result is already selected. You can press `Enter`
immediately if it has an action, or copy it if it is text. **Selection is not activation**:
highlighting a button does not click it, and selecting an input does not start editing it.

### Move through results or jump directly

| Intent | Keys | Behavior |
| --- | --- | --- |
| Move forward in the active mode | `Tab` | Select the next result and bring it into view. |
| Move backward in the active mode | `Shift + Tab` | Select the previous result and bring it into view. |
| Switch between text and actions | `Alt + S` | Use the other mode's selection without advancing either cursor or activating anything. |
| Move directly to the next action | `Ctrl + Tab` | Switch to action navigation and select the next action, if the browser delivers this shortcut. |
| Move directly to the previous action | `Shift + Ctrl + Tab` | Switch to action navigation and select the previous action, if the browser delivers this shortcut. |
| Jump to a numbered suggestion | `Alt + 1` … `Alt + 5` | Select that displayed row and bring it into view; the active mode follows the row's kind. |

Navigation wraps: forward from the last result goes to the first, and backward from the first goes
to the last. Because the first result is selected automatically, the first `Tab` normally moves to
the **second** result. With only one result, it stays selected and is brought into view.

Text results follow page order. Actions follow their search ranking. Each mode remembers its own
position within the current results: switching from `Text 3 / 12` to actions and back keeps text
result 3 selected. If action mode has no matches but text does, KeyMove falls back to text;
changing the query tries the chosen action mode again.

The numbered panel appears for queries of at least three characters and shows 1–5 suggestions
(three by default). These are a mixed shortlist, not the first few results in either mode.
`Alt + 2` therefore means **row 2 in the panel**, not text result 2. Only displayed, ready rows
can be selected. `Tab` still reaches all matches, including those outside the shortlist.

Browsers may reserve `Ctrl + Tab` for changing browser tabs. In that case, use `Alt + S` to choose
**Actions**, then plain `Tab` / `Shift + Tab`. Clicking the mode label or a suggestion row is the
pointer equivalent of switching mode or selecting that row; clicking a row does not activate it.

### Activate a result or hand control to the page

After selecting a result, choose what to do with it:

| Selected result | Keys | Outcome |
| --- | --- | --- |
| Link | `Enter` | Activate the link normally in the current tab. |
| Web link (`http` or `https`) | `Shift + Enter` | Open it in a new tab and switch to that tab. |
| Web link (`http` or `https`) | `Ctrl + Enter` | Open it in a background tab and stay in the current tab. |
| Button, checkbox, radio button, switch, or disclosure | `Enter` | Activate the control: click, toggle, select, submit, or expand as appropriate. |
| Text input, editor, or complex widget | `Enter` | Focus the control, then use its own typing and keyboard navigation. |
| Text block with an associated link or control | `Enter` | Activate that associated action without first switching to action mode. |
| Text block without an associated action | `Enter` | No action. |
| Disabled or unavailable control | `Enter` | No action; KeyMove does not activate it. |

Modified Enter shortcuts are web-link-only. They do not open buttons or inputs in new tabs.
For a text block associated with a web link, they apply to that link too.

Activation clears the query and ends the return-position session. With **Autohide** enabled, it
also hides KeyMove; with Autohide disabled, the interface can remain visible. To find another
control after entering an editor, press `Alt + F` and start another search.

### Choose an action with the arrow keys

Press **↓** while the search field has focus and a result is selected. The suggestions give way
to an action menu with only that result's suggestion retained in a single line at the bottom; the query and
navigation position are kept.

- **↑ / ↓:** move through menu actions. Up has no assigned KeyMove action when the menu is closed.
- **→**, **Enter** or **Space:** run the chosen action. Home/End select the first/last action.
- **Alt + number** (Option on Mac): immediately run the numbered action. Numbers belong only
  to actions while the menu is open; outside it, Alt + number still selects suggestions.
- **←** or **Escape:** close only the menu and return focus to the unchanged search.
- **Tab / Shift+Tab:** close the menu and select the next/previous search result.

Links offer Open link, Open in new tab, Open in background tab, Copy link address, and Focus
without activating where supported. Controls offer activation and focus where supported. Text
results offer Copy text; if a text block has an associated action, its actions appear too.
Disabled controls are marked unavailable and cannot be activated. Availability is checked again
when an action runs, and page refreshes or query changes dismiss the menu.

Copying closes the menu but retains the search. A clipboard failure leaves the menu open with an
announced error. Focus without activating closes KeyMove and gives the page control keyboard
focus, allowing native Tab navigation without clicking it. Existing direct activation and copying
shortcuts remain available from the search field.

This is KeyMove's own menu; it does not contain browser commands or other extensions' entries.

Example: type `pull`, press `Alt + 2` to select the second suggestion, then `↓` to open its
actions. Only that selected suggestion remains visible at the bottom. Press `Alt + 4` to run
the action labelled **4** (Copy link address for a typical web link), without stepping through
the menu or pressing Enter. The menu closes and the query remains. `Escape` instead closes
the menu without running anything and restores the full shortlist. Action numbers follow the
available menu entries, so use the displayed number rather than assuming every result has the
same actions.

With **Tooltips mode** enabled (the default), suggestion and action badges spell out `Alt + 1`,
`Alt + 2`, and so on. The searchbar shows `↓ Actions`, and the menu displays its navigation hints.
Turn it off in Settings for compact numbers and no reminders. It also suppresses automatic help
on hover, the mode-switch and Autohide tooltips, and the settings pane's search/dragging reminders.
The `?` button still opens the full shortcut reference when clicked or keyboard-activated.
Result labels, context, counts, setting descriptions, lock status and error messages remain visible.

### Copy what you found

| Intent | Sequence | Clipboard content |
| --- | --- | --- |
| Copy a paragraph, heading, list item, or other text block | Search → select a text result → `Ctrl + C` | The complete selected block, not just the matching word. |
| Copy a link address | Search → select an action that is a link → `Ctrl + C` | The selected link's URL. |
| Copy the wording of a link rather than its address | Select its containing text result in Text mode → `Ctrl + C` | The whole text block containing that link. |

Use `Command + C` on macOS. Copying does not activate the result or end the search, so you can
continue navigating or return to where you started. Non-link actions have no link URL to copy.

### Refine, replace, or retry a query

Keep typing or use ordinary text editing in the search field to refine the query. Results update
immediately; each changed query clears both result positions and selects the first fresh match,
while retaining the chosen mode. Previously displayed suggestions may remain visible during the
update but cannot be selected until they are ready.

Press `Ctrl + Backspace` (`Command + Backspace` on macOS) to clear the entire query **without
closing KeyMove**. Type a replacement query to continue. Refining or clearing the query does not
replace the original return position for that search session.

If there are no exact matches, approximate matching runs automatically; `~` beside the mode marks
those results. Navigate them with the same shortcuts. If there are still no results, edit the
query, clear it, or close KeyMove—there is nothing to activate.

### Finish here or return to where you started

| Intent | Keys while the search field has focus | Outcome |
| --- | --- | --- |
| Stay at the result | `Escape` | Clear the query and close KeyMove in one press, without scrolling back. |
| Return to the original reading position | `Alt + Backspace` | Restore the search session's starting scroll position and close KeyMove. |
| Keep searching with different words | `Ctrl + Backspace` | Clear only the query; keep KeyMove open and retain the return position. |

The return position is captured when the search begins, before KeyMove moves the page. It covers
the page and nested scrolling areas moved by result navigation. Multiple jumps and query edits
still lead back to that same origin; it is one return point, not a history of jumps. No previously
focused field is required, and neither closing shortcut restores an old field or caret.

Moving focus to another page control or activating a result ends that return session. Once a page
control has focus, `Escape` and `Alt + Backspace` belong to that control or the page. They do not
restore an earlier position. After `Escape` closes KeyMove, a later `Alt + Backspace` cannot undo
the closed search; choose the return shortcut **instead of** Escape if you want to go back.

For example, on MDN's [What next?](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/What_next)
page, when `improve` matches only “Help improve MDN”:

| Start | Search | Jump | Finish | Result |
| --- | --- | --- | --- | --- |
| Reading near the top | Type `improve` | `Tab` or `Alt + 1` selects “Help improve MDN” below the viewport | `Escape` | Stay at “Help improve MDN.” |
| Reading near the top | Type `improve` | `Tab` or `Alt + 1` selects “Help improve MDN” below the viewport | `Alt + Backspace` | Return to the original reading position. |

### Navigate dialogs and changing pages

When a modal dialog is open, both modes search inside that dialog automatically. Use the same
search, selection, copy, and activation shortcuts; there is no scope switch to learn. When the
dialog closes, whole-page search becomes available again. Nonmodal panels do not restrict search.
`Escape` while the KeyMove search field has focus closes **KeyMove**, not the page's dialog;
after focus moves into the dialog, its own keyboard behavior applies.

If page content changes during a search, results refresh automatically. KeyMove retains the
selected element if it still matches. If that element disappears, its selection is cleared rather
than moving activation to an unrelated result; use `Tab`, `Shift + Tab`, or a ready numbered row
to select another match. A full page navigation or reload starts a new page session, not a saved
search history.
