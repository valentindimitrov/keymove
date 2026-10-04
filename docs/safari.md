# Safari on macOS

Safari is a macOS-only build target for KeyMove. iOS, iPadOS and visionOS are outside
its supported scope. The web resources build on Windows and Linux as well as macOS;
the Apple app that contains them must target **macOS only**.

Status: build and automated checks are available, but the extension has not been
tested in Safari. A successful build is not a Safari compatibility certification.
Keep the Safari release experimental until the installed-browser checklist below
has been completed by someone with a Mac.

## Build and package from Windows or Linux

Use the Node version required by `package.json`, then:

```sh
yarn install --frozen-lockfile
yarn build:safari
yarn zip:safari
```

WXT receives `-b safari --mv3` explicitly. Its default Safari manifest version is
MV2, which KeyMove does not support. Output is `.output/safari-mv3/`; the ZIP is
`.output/keymove-v<version>-safari-mv3.zip`. It contains the manifest, JavaScript,
styles, icons and licenses, not a signed Apple application.

`yarn build`, `yarn zip`, `yarn quality` and draft release preparation include Safari
alongside Chromium and Firefox. `yarn verify` validates all three completed builds.
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
yarn build:safari
yarn safari:project <your-registered-bundle-identifier>
```

This runs Apple's `xcrun safari-web-extension-packager` with `--macos-only`, Swift
and copied resources. It creates `.output/safari-xcode` without opening Xcode,
signing, uploading, or overwriting an existing project. Move an old generated
project aside before regenerating it after web-resource changes. The command
fails with instructions on Windows/Linux. Older Xcode versions may call Apple's
tool `safari-web-extension-converter`; use current Xcode for the scripted route.
See Apple's [packager documentation](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari).

Open the generated project manually, choose your signing team and review the
deployment target before building. Follow Apple's
[running instructions](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
to enable the extension. The existing `yarn preview` launcher covers
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

## Installed Safari checklist (pending)

Record the macOS/Safari versions and how the app was packaged. Serve fixtures with
`yarn preview:ui`; test the installed extension, not just the React preview.

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
