# Signed Chrome Web Store uploads

`yarn package:chrome` rebuilds and zips Chromium, then writes
`.output/keymove-v<version>-chrome-mv3.crx`. The signer checks the saved public key,
verifies the CRX3 signature, and checks that its payload equals the Chromium ZIP.
`yarn verify:crx` repeats those checks without needing the private key.

Local signing reads the RSA-4096 key from Proton Pass vault `minddevops`, item
`KeyMove Chrome Web Store CRX signing`. It requires an authenticated `pass-cli` and
Python with `cryptography`. The helper converts OpenSSH to PKCS#8 in memory and pipes
it to Node; no private-key file is created. Private-key parse errors and helper output
are suppressed. The helper is for the signing command's pipe, not interactive use.

In Actions, `KEYMOVE_CRX_PRIVATE_KEY` contains the same key as PKCS#8 PEM. It is scoped
only to the signing step of the manual **Prepare release** workflow, after dependencies,
quality checks, and ZIP creation. The CRX joins the existing ZIP/source assets and checksums
on the draft release. A missing, invalid, or mismatched key stops release creation.
Firefox submission and source archives remain unsigned by this Chromium key.

Register `assets/store-listings/chrome-web-store/crx-signing-public-key.pem` in
Chrome Web Store's **Verified CRX uploads** dialog. After opting in, upload the CRX instead
of the ZIP. Google verifies the upload and re-signs the distributed extension, preserving
the store's extension ID. Opt-in and store submission remain manual actions.

The encoder follows the [Chromium CRX3 wire format](https://chromium.googlesource.com/chromium/src/+/main/components/crx_file/crx3.proto)
and [RSA signing algorithm](https://chromium.googlesource.com/chromium/src/+/main/components/crx_file/crx_creator.cc).
See [Chrome's verified upload instructions](https://developer.chrome.com/docs/webstore/update#protect_your_package_updates).
