# Safari on macOS

Safari is a macOS-only build target for KeyMove. iOS, iPadOS and visionOS are outside
its supported scope. The web resources build on Windows and Linux as well as macOS;
the Apple app that contains them must target **macOS only**.

Status: experimental. A local, unsigned Xcode build passed a first installed-Safari
check on November 22, 2026 (see [Results](#results)); several checklist items are still
untested, and no signed or App Store build exists yet. A successful build is not a
Safari compatibility certification. Keep the Safari release experimental until the
remaining checklist items pass and a signed build has been tested.

## Build and package from Windows or Linux

Use the Node version required by `package.json`, then:

```sh
pnpm install --frozen-lockfile
pnpm run postinstall
pnpm build:safari
pnpm zip:safari
```

WXT receives `-b safari --mv3` explicitly. Its default Safari manifest version is
MV2, which KeyMove does not support. Output is `.output/safari-mv3/`; the ZIP is
`.output/keymove-v<version>-safari-mv3.zip`. It contains the manifest, JavaScript,
styles, icons and licenses, not a signed Apple application.

`pnpm build`, `pnpm zip`, `pnpm quality` and draft release preparation include Safari
alongside Chromium and Firefox. `pnpm verify` validates all three completed builds.
The draft release includes the Safari ZIP and its SHA-256 checksum, labelled as
unverified web resources requiring Apple packaging.

There is no WebExtension manifest key that restricts installation to macOS. The
restriction belongs to the containing Apple app and its distribution configuration.

## Apple packaging without a Mac

Apple's [Safari Web Extension Packager in App Store Connect](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)
accepts a web-resources ZIP from any operating system. An Apple Developer Program
membership is required.

1. Create the app record with **macOS as its only platform**. Do not add iOS.
2. In its Xcode Cloud tab, upload the Safari ZIP to Safari Web Extension Packager.
3. Review Apple's manifest warnings and packaging result. Confirm the resulting
   app has only the macOS platform before distributing it.
4. Have a Mac tester install a TestFlight build and complete the checks below.

Packaging, signing, TestFlight and App Store submission are manual external steps;
the repository's CI only produces the web resources. No Apple credentials are
needed for local builds. Store submission still requires the owner's confirmation.

## Optional Xcode project on a Mac

With current Xcode installed:

```sh
pnpm build:safari
pnpm safari:project <your-registered-bundle-identifier>
```

This runs Apple's `xcrun safari-web-extension-packager` with `--macos-only`, Swift
and copied resources. It creates `.output/safari-xcode` without opening Xcode,
signing, uploading, or overwriting an existing project. The packager derives the
app's identifier from the identifier's prefix and the app name (`eu.example.keymove`
becomes `eu.example.KeyMove`) while naming the extension `eu.example.keymove.Extension`,
which Xcode refuses to build, and it sets version 1.0. The script then gives the app
exactly the identifier passed and sets both targets' version to the manifest version. Move an old generated
project aside before regenerating it after web-resource changes. The command
fails with instructions on Windows/Linux. Older Xcode versions may call Apple's
tool `safari-web-extension-converter`; use current Xcode for the scripted route.
See Apple's [packager documentation](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari).

Open the generated project manually, choose your signing team and review the
deployment target before building.

Without an Apple Developer membership, a local test build can be ad-hoc signed:

```sh
xcodebuild -project .output/safari-xcode/KeyMove/KeyMove.xcodeproj -scheme KeyMove \
  -configuration Debug -derivedDataPath .output/safari-build \
  CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= PROVISIONING_PROFILE_SPECIFIER= build
```

Copy `.output/safari-build/Build/Products/Debug/KeyMove.app` to `~/Applications` and
open it once so Safari registers the extension. In Safari, enable Settings → Advanced →
Show features for web developers, then Settings → Developer → Allow unsigned extensions,
and enable KeyMove in Settings → Extensions. Safari turns that permission off whenever it quits,
which hides the extension until it is allowed again. Follow Apple's
[running instructions](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
to enable the extension. The existing `pnpm preview` launcher covers
Vivaldi/Chrome/Firefox, not Safari.

## Compatibility boundaries

- Use a current Safari on macOS for the initial validation. A minimum supported
  Safari/macOS combination has not been certified. CSS Custom Highlights require
  Safari 17.2 or newer, but that alone does not establish full compatibility.
- Search and settings use standard DOM APIs and `wxt/browser`. No additional
  permissions or privileged image fetching are introduced for Safari.
- Safari requires user-granted website access. Enable KeyMove and grant access
  to the test sites; reload tabs after granting it if the content script is absent.
  Safari ignores file-URL permissions, so use HTTP(S) fixtures, not local file URLs.
- Safari does not support the child-frame helper's `match_about_blank` manifest key; the
  packager warns about it. Frames whose document is `about:blank` or `srcdoc` may
  therefore not be searched in Safari; this has not been tested.
- Deferred text and image-address copies initiate a clipboard write in the input
  event and supply validated data through a `ClipboardItem` promise. Local image
  pixel copying already does this. Insecure pages, cross-origin canvases and
  browser clipboard restrictions can still reject copying.
- Image pixel copying inside iframes still executes in the owning frame. Safari
  may not preserve activation across extension messages; a visible copy error and
  Copy image address remain the fallback. Do not treat this path as verified.
- Shadow DOM selection/highlights, modal focus, iframe routing and native keyboard
  behavior require Safari testing. Sender validation, frame generation tokens and
  sandbox restrictions stay in place.
- Option is Alt on macOS; native copying uses Command+C. Browser-reserved shortcuts
  such as Control+Tab may not reach the page. Opening shortcuts are configurable.

These boundaries follow Apple's [compatibility notes](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
and WebKit's [clipboard requirements](https://webkit.org/blog/10855/async-clipboard-api/).

## Installed Safari checklist

Record the macOS/Safari versions and how the app was packaged. Serve fixtures with
`pnpm preview:ui`; test the installed extension, not just the React preview.

- Enable/disable website access, reload and navigate; verify one searchbar per tab.
- Search exact, fuzzy, accented and IME text; navigate text/actions in both directions.
- Exercise Option+F, Option+S, Option+I, menu number shortcuts and Command+C.
- Copy a full block, a link URL and menu text; retain errors when copying is denied.
- In `preview/shadow.html`, test selection/copy, continued typing, nested modals and cleanup.
- In `preview/frames.html`, test cross-origin/nested frames, late results, frame removal,
  activation and menu copying, following `docs/iframe-testing.md`.
- In `preview/images.html`, test navigation, image-address/pixel copies, stale images
  and cross-origin copy failures, including images inside frames.
- Test settings persistence across tabs, toolbar popup opening, foreground/background
  links, site pause, OS theme changes and background-worker restart.

Windows unit tests and Chromium smoke cannot mark any Safari checklist item complete.

### Results

November 22, 2026: macOS 27.2.1, Safari 27.2, a local unsigned build from
`pnpm safari:project` and the ad-hoc `xcodebuild` above, including the fixes from
pull requests #38 and #39.

Passed:

- One searchbar per tab after reloading; Option+F; exact and typo searches; Tab and
  Shift+Tab; Enter following a link; Escape.
- Option+number menu shortcuts (Command+number is not a KeyMove shortcut).
- Command+C copying a whole text block and a link URL, and copying from the action menu.
- Toolbar popup: a theme change reaching another open tab, and Show KeyMove search bar
  on the active page.
- `preview/shadow.html`: search, selection and copy, continued typing, nested dialogs.
- `preview/frames.html`: results in same-origin, cross-origin and nested frames, and
  activating a result inside a frame.
- `preview/images.html`: Option+I, arrow navigation, the Space menu and both copy actions.

Found and fixed: suggestions flickered while extending a query that matched nothing
(all browsers, #38); the toolbar popup reported every page as unavailable (#39).

Not yet tested: changing website access, accented text, IME input, Option+S, denied-clipboard errors,
frame removal and late frame results, stale and cross-origin images (including inside
frames), Shift+Enter and Control+Enter tabs, site pause, OS theme changes,
background-worker restart, `about:blank`/`srcdoc` frames and Control+Tab.
