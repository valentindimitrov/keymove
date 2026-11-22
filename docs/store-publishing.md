# Store publishing

The manually dispatched **Publish to stores** workflow (`.github/workflows/publish-stores.yml`)
submits a published GitHub release to the Chrome Web Store and Firefox Add-ons (AMO). It never
rebuilds: it submits the exact packages attached to the release, so run it only after
**Prepare release** has finished and you have published its draft (`docs/crx-signing.md`).

## Running it

**Actions → Publish to stores → Run workflow**, from `main`, with:

- `version`: the published release, without the leading `v` (for example `1.2.0`).
- `chrome`, `firefox`: which stores to submit to.
- `chrome_publish_type`: `publish-after-review` goes live automatically once Chrome's review
  passes; `stage-for-manual-publish` waits for you to publish it in the Developer Dashboard
  (within 30 days, after which the submission reverts to a draft).

Each store job pauses until a reviewer approves it. A submission cannot be withdrawn through
this workflow, so check the release before approving.

## What it does

1. **Download and verify release packages** (`contents: read`, no secrets): requires a
   published, non-draft release whose tag is on `origin/main`, downloads its assets, checks
   them against `SHA256SUMS.txt`, and runs `node scripts/publish-stores.ts verify`. That
   checks the CRX against the committed public key and that it carries exactly the Chromium
   ZIP, both manifests' name and version, the Firefox add-on ID, and the sources package's
   version.
2. **Submit to the Chrome Web Store** (environment `store-chrome`): reverifies the packages,
   uploads the signed CRX through the Chrome Web Store API v2, waits for processing and calls
   `publish` with the selected publish type.
3. **Submit to Firefox Add-ons** (environment `store-firefox`): reverifies the packages,
   uploads the Firefox ZIP to the listed channel through the AMO API v5, waits for validation,
   then creates the version with the sources ZIP attached for review.

The store jobs install no packages. `scripts/publish-stores.ts` imports only Node built-ins,
`src/extension_identity.ts` and the release scripts that do the same, so dependency code
cannot reach the store credentials. Errors report the HTTP status and the API's own message
with any credential removed, never a request or raw response.

## Settings it needs

Both environments accept deployments from `main` only and require a reviewer, like `release`.
A job naming a missing environment creates it unprotected, so keep these names exact.

| Name | Kind | Where |
| --- | --- | --- |
| `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` | secrets | `store-chrome` |
| `AMO_JWT_ISSUER`, `AMO_JWT_SECRET` | secrets | `store-firefox` |
| `CHROME_PUBLISHER_ID`, `CHROME_EXTENSION_ID`, `WXT_FIREFOX_EXTENSION_ID` | variables | repository |

The Chrome OAuth client needs the `https://www.googleapis.com/auth/chromewebstore` scope.
AMO API keys come from the AMO developer hub's API key page.

## Before the first run

- **Chrome:** the API cannot create an item, so the first version is uploaded in the Developer
  Dashboard. Opt into **Verified CRX uploads** with
  `assets/store-listings/chrome-web-store/crx-signing-public-key.pem` before the first
  workflow run; the workflow uploads the signed CRX.
- **Firefox:** the add-on must already exist on AMO with `WXT_FIREFOX_EXTENSION_ID` as its ID
  and a license, name, summary and categories, because a new version cannot set them.
- Listing text, screenshots and privacy answers stay in each store's dashboard.

## Status

KeyMove is opted into Verified CRX uploads, so the workflow's CRX upload is the expected path.
Its first run submitted 1.1.0 to both stores on November 22, 2026. Whether the Chrome Web Store
accepts a CRX upload before opting in is undocumented and does not apply to KeyMove.
