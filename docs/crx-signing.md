# Signed Chrome Web Store uploads

`pnpm package:chrome` rebuilds and zips Chromium, then writes
`.output/keymove-v<version>-chrome-mv3.crx`. The signer checks the saved public key,
verifies the CRX3 signature, and checks that its payload equals the Chromium ZIP.
`pnpm verify:crx` repeats those checks without needing the private key.

Local signing reads the RSA-4096 key from Proton Pass vault `minddevops`, item
`KeyMove Chrome Web Store CRX signing`. It requires an authenticated `pass-cli` and
Python with `cryptography`. The helper converts OpenSSH to PKCS#8 in memory and pipes
it to Node; no private-key file is created. Private-key parse errors and helper output
are suppressed. The helper is for the signing command's pipe, not interactive use.

In Actions, `KEYMOVE_CRX_PRIVATE_KEY` contains the same key as PKCS#8 PEM. The manual
**Prepare release** workflow (`.github/workflows/prepare-release.yml`) runs two jobs:

1. **Build and validate packages** (`contents: read`, no secrets): installs the locked
   dependencies, runs `pnpm quality`, zips the builds, validates the build directories and
   the ZIPs themselves (`pnpm verify:packages`), and uploads the unsigned ZIPs as an artifact.
2. **Sign and create draft release** (`contents: write`, environment `release`): checks out
   the commit afresh, downloads the ZIPs, revalidates them, signs the Chromium ZIP and creates
   the draft release with checksums. It installs nothing and runs no build tooling:
   `scripts/validate-builds.ts`, `scripts/sign-chrome.ts` and `scripts/crx3.ts` import only
   Node built-ins and `src/extension_identity.ts`, so dependency code from the first job cannot
   reach the key. The secret is passed only to the signing step.

The workflow stops at a draft release. A missing, invalid, or mismatched key stops release
creation. Firefox submission and source archives remain unsigned by this Chromium key.

### Protecting the key (owner setup)

The workflow file can be edited on any branch, so its "part of `origin/main`" check is only a
convenience. The `release` environment is the boundary, and it must exist with these settings
before the next run (a job naming a missing environment creates it unprotected):

1. **Settings → Environments → New environment**, name `release`.
2. **Deployment branches and tags**: *Selected branches and tags*, add the rule `main` only.
3. **Required reviewers**: add yourself; enable **Prevent self-review** only if another reviewer
   exists, otherwise you could not approve your own release.
4. Under **Environment secrets**, add `KEYMOVE_CRX_PRIVATE_KEY` with the PKCS#8 PEM from Proton
   Pass (paste it yourself; never through an agent).
5. **Settings → Secrets and variables → Actions → Repository secrets**: delete the repository-level
   `KEYMOVE_CRX_PRIVATE_KEY`. While it exists, any workflow on any branch can still read it.
6. Keep `WXT_FIREFOX_EXTENSION_ID` as a repository variable; both jobs read it.

Each run then pauses at the signing job until a reviewer approves it, and runs dispatched from
any branch other than `main` are refused the environment.

Register `assets/store-listings/chrome-web-store/crx-signing-public-key.pem` in
Chrome Web Store's **Verified CRX uploads** dialog. After opting in, upload the CRX instead
of the ZIP. Google verifies the upload and re-signs the distributed extension, preserving
the store's extension ID. Opt-in and store submission remain manual actions.

The encoder follows the [Chromium CRX3 wire format](https://chromium.googlesource.com/chromium/src/+/main/components/crx_file/crx3.proto)
and [RSA signing algorithm](https://chromium.googlesource.com/chromium/src/+/main/components/crx_file/crx_creator.cc).
See [Chrome's verified upload instructions](https://developer.chrome.com/docs/webstore/update#protect_your_package_updates).
