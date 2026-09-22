# Testing iframe navigation

Use the built extension, not the component preview alone. The fixture deliberately embeds
both `127.0.0.1` and `localhost`; different hostnames make this a real cross-origin test.

## Open the test page in Vivaldi

From the checkout containing the iframe changes:

1. Run `yarn preview:ui --host 127.0.0.1 --port 5175 --strictPort` and leave it running.
2. In another terminal run `yarn preview:vivaldi`. This builds and opens a separate test profile;
   your normal browser profile is not changed.
3. In that test window open `http://127.0.0.1:5175/frames.html`.

If using an existing unpacked installation instead, rebuild, reload the extension from
`vivaldi://extensions`, and reload the fixture. A page refresh alone does not update the extension.
Do not load both the old and new KeyMove copies into the same profile.

## Keyboard checklist

- Search `40`. The mixed shortlist includes `Minimum (EUR) — 40`, even in Text mode. Frame
  context distinguishes the embedded forms. Select the input's numbered suggestion with
  **Alt+number**, then **Enter**: you can type into the field.
- For all three input results, use **Alt+S** to choose Actions and **Tab** to move between
  the same-origin, cross-origin and nested forms. **Enter** focuses the current input.
- From the focused input, **Alt+F** returns to the single top-level searchbar. A remapped
  opening shortcut is honored too. Ordinary typing inside the field remains native.
- Search `Launch`, switch to Actions if needed, select a button with **Tab**, and press
  **Enter**. Only that frame's output changes to `Activated`.
- Search `otter` in Text mode. **Tab** visits the main-page instructions and the three
  embedded paragraphs. **Ctrl+C** copies the whole selected block, not the query.
- With a result selected, **Down** opens the existing action menu. Test focus-only,
  copying, and link new-tab actions. Disabled or removed controls must not activate.
- Search `Hide / show`, activate the fixture button, and search `otter` again. The hidden
  cross-origin frame and its nested frame must be absent. The permanently hidden fixture
  must never appear. Show the frame again and repeat.
- Activate `Reload cross-origin frame`, then repeat `40`. Old control references must not
  activate targets from the previous document.
- **Escape** closes search and clears frame marks. **Alt+Backspace** also returns scroll
  positions captured before navigating, including embedded scroll containers.

One- and two-character queries still show suggestions but outline only the selected result.
At three characters, other matches gain faint outlines and matching text is highlighted.
No frame gets its own searchbar.

## Automated checks and performance

Run `yarn quality`, then `yarn test:browser:built`. The browser suite installs the actual
production extension in a temporary profile, tests frame discovery/navigation/input focus,
copy/paste, hiding, reload and cleanup, and closes that test browser.

`.artifacts/iframe-search.png` records the rendered result. `.artifacts/iframe-performance.json`
records keydown-to-result-update samples with 0, 3 and 20 searchable frames. It separates the
first main-page result from the final combined count. These are local-fixture samples, not
a guarantee for every embedded application. Use `frames.html?frames=20` for a manual stress test.

Frame helpers build indexes only during a search, reuse them across completed queries, cancel
superseded work, and release them when search ends. At most two direct children are searched
concurrently per document. Nesting is limited to eight levels, and a nonresponding child gets
a 1.5-second deadline without blocking main-page results. Browser-protected documents and
frames the extension is not permitted to enter are unsupported; sandbox restrictions remain intact.
Firefox builds are validated, but Firefox interaction still requires a manual test.
