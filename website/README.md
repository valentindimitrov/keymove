# KeyMove website

The landing page and interactive playground share the extension's real Searchbar, search index,
highlighting, navigation, action menu, settings components, and artwork. No copied search algorithm
or simulated result list. The sample guide lives in an iframe to contain search and keyboard events;
the extension is mounted directly inside that document by `demo.tsx`.

From the repository root:

```sh
pnpm website:dev
pnpm website:build
pnpm website:preview
```

The standalone static output is `.output/public/`. Deploy the entire directory, including
`demo.html`, assets, and `LICENSE.txt`, to a static host. Relative asset URLs support subpaths.
The website build is independent from extension builds and adds no runtime dependencies.

## Deployment

The site is published to Cloudflare as the Worker `keymove-website` (`website/wrangler.jsonc`,
static assets only). The Quality workflow's `quality` job builds it and uploads `.output/public`
as the `website` artifact, without secrets; two token-bearing jobs then publish that artifact
as static files, installing only the Wrangler locked in `website/deploy/pnpm-lock.yaml` (a
standalone pnpm project with its own `pnpm-workspace.yaml`) from main's checkout:

- **Production:** the `website` job in `.github/workflows/quality.yml` deploys pushes to `main`
  to https://keymove.minddevops.eu (environment `production`). On a push to `main` the workflow
  file, the build and the deployment configuration are all `main`'s.
- **Pull request previews:** `.github/workflows/website-preview.yml` runs on `workflow_run` when
  Quality completes for a pull request. Its definition always comes from `main`, so a branch
  cannot rewrite the job that holds the token (it could in a `pull_request` run, where the
  workflow file comes from the branch). It finds the open pull request through the API, fetches
  the triggering run's artifact, checks and extracts it (regular files only, no path traversal,
  no `_worker.js` or `.assetsignore`, size limits), and uploads it as a preview version at
  `pr-<number>-keymove-website.<subdomain>.workers.dev` (environment `preview`), without changing
  production. The commit status **Website preview** on the pull request links the preview, or
  the failed run. Pull requests from forks and from Dependabot are skipped.

The artifact itself is built by the pull request's code and is published as that pull
request's content; nothing in it is executed or used as configuration. Changes to the
deployment files (`wrangler.jsonc`, `website/deploy/`, either workflow) take effect once merged
to `main`: `workflow_run` workflows only run from the default branch, and a pull request cannot
preview its own deployment changes.

Both jobs need the repository variable `CLOUDFLARE_ACCOUNT_ID` and the secret
`CLOUDFLARE_API_TOKEN` (a token from the "Edit Cloudflare Workers" template, limited to that
account and the `minddevops.eu` zone); both are skipped while the variable is unset. Cloudflare
creates the DNS record and certificate for the custom domain on the first deployment.

The workflows alone do not keep the token from branches. A repository-level secret is passed to
every `pull_request` run from a branch of this repository, and that branch controls its own
workflow files, so it could add a job that reads the secret. The boundary is the environments:
keep `CLOUDFLARE_API_TOKEN` only as an environment secret of `production` and `preview`, each
limited to the `main` branch under **Deployment branches and tags**. Pull request runs (ref
`refs/pull/<n>/merge`) are then refused those environments, while pushes to `main` and
`workflow_run` runs (ref `main`) are allowed. A separate, narrower token for previews makes a
leak easier to contain and revoke. Anyone who can push to `main` can still change the trusted
workflows and use the token.

Link previews (LinkedIn, Slack, X) use the Open Graph tags in `index.html` and
`media/social-card.png`, which the build copies unhashed to `/social-card.png` because crawlers
need a fixed absolute URL. The card is rendered from `media/social-card.html`, a 1200 × 627
layout in the store marquee tile's design, at twice that resolution (2400 × 1254). LinkedIn
shows it about 520 pixels wide and recompresses it, so keep text large: nothing under 30 pixels
in the layout. After editing it, render it again with Playwright driving the installed Edge
(plain headless Vivaldi or Edge screenshots proved unreliable on Windows) and ImageMagick:

```sh
npx playwright screenshot --channel msedge --device "Desktop Chrome HiDPI" --viewport-size "1200,627" --wait-for-timeout 500 file:///<repository>/website/media/social-card.html <temporary folder>/raw.png
magick <temporary folder>/raw.png -background "#151224" -alpha remove -alpha off -depth 8 -strip PNG24:website/media/social-card.png
```

LinkedIn caches previews: after deploying a new card, refresh it with the
[Post Inspector](https://www.linkedin.com/post-inspector/).

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
The player starts paused and downloads the recording only after Play or a chapter is selected.
Chapter jumps retain the playing or paused state, including requests
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
pnpm website:record-patterns http://127.0.0.1:5182/
```

The recorder requires FFmpeg with the `drawtext` filter on PATH and, by default, installed
Vivaldi (run through its Chromium shell, as the browser tests do); set
`KEYMOVE_TEST_BROWSER=chromium` to use Playwright's Chromium instead. Set
`KEYMOVE_RECORDING_OUTPUT` to a directory outside `media/patterns/` to check a recording without
replacing the published clips. The `hand-off-to-widget` clip expects Windows/Linux select
behavior: on macOS, Down opens the native picker instead of changing the value. An optional
argument after the URL is a comma-separated list of pattern IDs. It runs a temporary copy of the actual production
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
page and clears its state. Chrome, Vivaldi, and Firefox link to the published store listings;
the Edge store link remains a placeholder.

## Search and static rendering

`pnpm website:build` renders the home, patterns, and getting-started React components into HTML, and renders
the shared header and footer into the static privacy page. `prerender-plugin.ts` uses Vite's
build asset names, then the browser hydrates those same components. No runtime server or browser
binary is needed for the build. Platform shortcut labels update after hydration; the demo iframe
starts after its parent has attached its message listener. Dev mode uses ordinary client rendering.

The HTML contains canonical URLs. `public/sitemap.xml` lists the four public content pages;
`public/robots.txt` advertises it. Keep the iframe-only demo's `noindex` tag and exclude it from
the sitemap. Cloudflare may prepend its managed crawler policy to robots.txt; preserve that
policy when deploying. After deployment, submit the sitemap in the owner's Search Console and
use URL Inspection to check rendered content and indexing status. A sitemap does not guarantee
indexing or rankings.

The homepage includes build-generated `WebSite` JSON-LD for the site name. This is an inert
data block, not executable JavaScript; keep the strict script CSP intact. The getting-started
guide reuses the shared navigation and platform-aware shortcut labels, and links to the existing
pattern examples. Its text remains readable without JavaScript, with a macOS shortcut note as
a fallback. The homepage links to the guide beside the demo instructions.

Run `node website/verify-build.mjs` after building to check static content, asset references,
canonical URLs, sitemap coverage, demo exclusion, and bundled font licenses without a browser.

Fonts are self-hosted with their licenses in `fonts/`. `public/_headers` caches fingerprinted
assets for one year; HTML remains revalidated so deployments can update its asset references.

## Security headers and reporting

`public/_headers` also supplies the production CSP, host-scoped HSTS, MIME sniffing protection,
same-origin framing, referrer policy, and permissions policy. CSP allows only same-origin
scripts and connections, self-hosted fonts, local/data/blob images, and local/blob media.
Inline styles remain permitted because the real extension demo injects Shadow DOM styles
and uses inline layout styles; inline scripts and eval remain blocked. Same-origin frames,
clipboard writes, and fullscreen are retained for the demo and video controls. Camera,
microphone, location, payment, USB, and clipboard reads are disabled. HSTS deliberately has
no `includeSubDomains` or preload directive, so it does not opt other hosts into this policy.

Test response headers after a website build with the same locked Wrangler the deploy uses:
`pnpm --dir website/deploy install --frozen-lockfile`, then
`website/deploy/node_modules/.bin/wrangler dev --local --config website/wrangler.jsonc`.
Vite preview does not apply Cloudflare's `_headers` or `_redirects` files.
Keep production policies out of the Vite development server, whose hot reload has different
script and connection requirements. Verify the actual Cloudflare response after deployment.

`public/.well-known/security.txt` advertises the existing private GitHub vulnerability-reporting
channel. `/security.txt` redirects there. Review its contact and policy URLs and renew its
expiry before 2027-04-08; the build verification rejects an expired file. Robots.txt is a crawl
preference, not an access-control policy. Do not block scripts/styles or the demo in robots.txt,
because crawlers must be able to render pages and read the demo's `noindex` directive.
The host-specific `X-Robots-Tag: noindex` rule keeps Cloudflare `workers.dev` preview URLs
out of search results without applying noindex to the public custom domain.
To exercise that rule locally, add `--local-upstream pr-check.example.workers.dev` to Wrangler;
overriding only the HTTP Host header does not change Wrangler's configured upstream hostname.

For website-only changes, follow `website/AGENTS.md`: format/lint/typecheck as applicable,
build the website, and check the rendered pages and interactions at desktop and narrow widths.
Extension tests and MV3 builds are needed only when shared extension code changes.
