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
