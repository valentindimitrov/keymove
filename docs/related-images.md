# Related images

Select a search result, then press **Alt+I** (**Option+I** on macOS), or choose
**Select related image** from its Down-arrow action menu. Repeat Alt+I to cycle
the visible photographs in the same card or figure. Search results and counts
remain unchanged. Tab resumes normal result navigation; Escape returns to the
original result without clearing the query.

**Alt+I also works without a query or selected result**, including when the bar
is hidden. It opens the bar and selects an eligible on-screen image nearest the
viewport centre. Site pause still takes precedence. If the document has no eligible
on-screen images, it reports that none was found; it does not enter child frames
to invent a starting result. Escape then exits image mode back to the empty search.

While an image is selected, **Left / Right / Up / Down** move to the nearest
rendered image in that direction, including neighbouring cards and open shadow
roots. An arrow with no nearby candidate leaves the selection unchanged. Lookup
uses one bounded, chunked rendered-tree scan rather than rescanning nested parents,
prefers on-screen images, remains inside the active modal and owning document, and
does not cross iframe boundaries. Escape still returns to the original text result.

With an image selected, **Space** opens its four actions (Down still opens actions
for ordinary text results). Inside the menu, arrows choose actions and Enter runs
the highlighted action. Escape returns directly to the original text result.

- **View larger** opens a keyboard-accessible viewer. Escape or its Close button
  returns to the selected image. The viewer fits the existing image to the window;
  it does not invent a higher-resolution source.
- **Open image in new tab** opens an HTTP(S) image address. Blob and data images
  can be viewed inline, but their new-tab action is unavailable.
- **Copy image** copies PNG pixels, including a single frame for animated images.
  Clipboard restrictions, cross-origin pixel protection, unloaded images, or images
  exceeding 32 million pixels can prevent copying. Failure stays visible in the
  menu; use **Copy image address** instead. No new permissions or privileged
  network requests are added.

Outside the menu, **Enter** follows the selected image's link; modified Enter
retains foreground/background link-tab behavior. Following the link, cycling
images, and returning to text no longer occupy numbered menu actions.

Discovery is on demand and bounded to nearby containers. It follows open shadow
roots and slots, skips hidden and small/decorative images, and does not search
across unrelated cards or documents. Iframe operations run in the owning frame
through the existing authenticated relay. Background CSS images, canvas pictures
and closed shadow roots are not supported. Ambiguous markup can produce “No
related image found” rather than guessing across a page.

## Manual test

Run `yarn preview:ui --host 127.0.0.1 --port 5175 --strictPort`, then
`yarn preview:vivaldi` in another terminal. In that dedicated browser, open
`http://127.0.0.1:5175/images.html`.

1. Search `Samba shoe`, press Alt+I: only the purple shoe should be outlined.
2. Right selects the orange shoe; Left returns to the purple shoe. Space → View larger.
   Resize the window; Escape returns to the image, another
   Escape returns to the caption with the query preserved.
3. Select the image again. Space → Copy image; paste into an image-capable editor.
4. Enter follows the fixture's image link (sets `document.body.dataset.activated`).
5. Repeat with `Shadow camera` and `Embedded trainer` for shadow/iframe coverage.
6. Search `No photograph here`: Alt+I must not borrow a neighbour's photograph.
7. In a real page, test Copy image on a cross-origin photo. A blocked copy must
   show a message, retain the menu, and still allow copying its address.

Automated installed-browser coverage is part of `yarn test:browser`; screenshots
are written to `.artifacts/image-viewer.png` and `image-viewer-narrow.png`.
Firefox needs a separate manual installed-browser check.
