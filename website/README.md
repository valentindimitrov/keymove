# KeyMove website

The landing page and interactive playground share the extension's real Searchbar, search index,
highlighting, navigation, action menu, settings components, and artwork. No copied search algorithm
or simulated result list. The sample guide lives in an iframe to contain search and keyboard events;
the extension is mounted directly inside that document by `demo.tsx`.

From the repository root:

```sh
yarn website:dev
yarn website:build
yarn website:preview
```

The standalone static output is `.output/public/`. Deploy the entire directory, including
`demo.html`, assets, and `LICENSE.txt`, to a static host. Relative asset URLs support subpaths.
The website build is independent from extension builds and adds no runtime dependencies.

The walkthrough above the playground is a 46-second, silent H.264 recording of the actual
Searchbar on `demo.html`, captured at 960 × 640 and 10 frames per second. It shows native key
input, text result navigation, button activation, the Arrow Down action menu and the ? shortcut
tooltip. Compact rounded key badges follow the right side of the search field, including while
the menu opens above it. The recording omits the playground’s onboarding banner and outline;
these remain available in the live demo. Its MP4 and first-frame poster are in `media/`.
The extension uses its dark palette against a light sample page for contrast. The first query
is deliberately only `cof`, demonstrating substring matching. Within the recording, inputs
accumulate as separate, content-sized badges beside the searchbar, including both Tab presses.
The stack resets at each chapter boundary. The sidebar contains explanations and chapter links;
the expanded transcript preserves an accessible written account of the input sequence.
The player starts paused. Chapter jumps retain the playing or paused state, including requests
made before metadata loads. The recording leaves two seconds between the opening shortcuts
in the button chapter and includes a keyframe each second for responsive seeking. It provides
the video through a fully downloaded Blob URL because the hosted asset can expose only a
zero-length seekable range. The request is aborted and the URL revoked on unmount. It provides
native play/pause, seeking/fullscreen, chapter links,
optional captions and a text transcript. The transcript uses the extension's platform shortcut
definitions; recorded badges show Alt / Option for both platforms. Keep `walkthrough.tsx`,
`media/walkthrough.vtt` and the recorded sequence
in sync when updating the video. Playback is independent of the interactive demo's state.

The navigation-pattern library uses 19 click-to-play H.264 clips, each with native pause,
seeking, fullscreen, a poster, and WebVTT captions. Starting a clip pauses the others. Video
data is not preloaded. The steps beneath each player also provide a readable description.
All clips use this same sample guide, including its planner, labelled checkbox, fields,
dropdown, disclosure, JavaScript hover menu, native modal, notes area, and walking route.

To record them again, build the Chromium extension, build and serve the website, then run:

```sh
node scripts/record-patterns.mjs http://127.0.0.1:5182/
```

The recorder requires installed Vivaldi and FFmpeg on PATH. An optional third argument is a
comma-separated list of pattern IDs. It runs a temporary copy of the actual production
extension in an isolated browser profile against `demo.html?extension=installed`; this query
omits the website-mounted extension so only the installed one handles keys. It records real
browser screenshots with short reading holds, adds the key/caption band, and checks each
outcome before encoding. Clipboard clips use native copy/paste; the tab clip verifies the
extension-created tabs and their active state. Raw frames and verification results stay in
ignored `.artifacts/pattern-recordings/`; only encoded media is shipped in `media/patterns/`.

Only the website Vite configuration aliases `wxt/browser` to `browser-adapter.ts`. Settings are
session-only and never access extension storage. New-tab commands explain the installed-extension
requirement instead of pretending to control browser tab activation. Link activation, controls,
selection, search, and the action menu use production code. Clipboard access depends on browser
permissions and a secure context; real failures are announced by the shared action menu.

Parent/frame commands require matching origin, source window, and a recognized lesson identifier.
Escape clears the query; another Escape returns focus outside the iframe. Reset reloads the sample
page and clears its state. Store links are intentionally absent until real listings exist.

Visual checks: use `yarn website:dev` for desktop and narrow layouts. Use `yarn preview:ui` for
shared extension visual regression scenarios. The website and extension must both build before
handoff; the repository's `yarn quality` gate remains unchanged.
