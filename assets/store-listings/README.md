# Extension store listings

Keep listing descriptions, screenshots, promotional artwork, and other submission files for
every extension store here, in a folder named for that store. These files are excluded from
the extension builds; only the runtime icons in the parent `assets/` directory are copied.

`chrome-web-store/` contains the current English description, five screenshots, promotional
tiles, upload instructions, and capture metadata. Other stores can reuse those screenshots
and copy when their requirements match; check their requirements before submitting.

To refresh the Chromium captures, build the extension with `pnpm build:chromium`, start
`pnpm website:dev`, then run `node assets/store-listings/generate.ts` from the repository root.
It opens a dedicated temporary profile in installed Vivaldi's Chromium shell (or the browser
named by `KEYMOVE_TEST_BROWSER`, e.g. `chromium`), uses the installed extension, and converts
captures to RGB PNGs with ImageMagick, captioned in bold Arial (or `KEYMOVE_CAPTION_FONT`).
Set `KEYMOVE_STORE_OUTPUT` to another directory to check captures without replacing these. It refreshes the images and verification metadata,
preserving the description and upload instructions. Intermediate files stay in `.artifacts/`.

To refresh only selected images, pass their names without `.png`, for example:
`node assets/store-listings/generate.ts small-promo-tile 05-form-controls`.
