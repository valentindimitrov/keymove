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

The walkthrough above the playground is a 42-second, silent H.264 recording of the actual
Searchbar on `demo.html`, captured at 960 × 640 and 10 frames per second. It shows native key
input, text result navigation, button activation, the Arrow Down action menu and the ? shortcut
tooltip. Compact rounded key badges follow the right side of the search field, including while
the menu opens above it. The recording omits the playground’s onboarding banner and outline;
these remain available in the live demo. Its MP4 and first-frame poster are in `media/`.
The player starts paused and provides
native play/pause, seeking/fullscreen, chapter links,
optional captions and a text transcript. The adjacent key labels use the extension's platform
shortcut definitions. Keep `walkthrough.tsx`, `media/walkthrough.vtt` and the recorded sequence
in sync when updating the video. Playback is independent of the interactive demo's state.

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
