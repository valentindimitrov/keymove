# Extension store listings

Keep listing descriptions, screenshots, promotional artwork, and other submission files for
every extension store here, in a folder named for that store. These files are excluded from
the extension builds; only the runtime icons in the parent `assets/` directory are copied.

`chrome-web-store/` contains the current English description, five screenshots, promotional
tiles, upload instructions, and capture metadata. Other stores can reuse those screenshots
and copy when their requirements match; check their requirements before submitting.

To refresh the Chromium captures, build the extension with `yarn build:chromium`, start
`yarn website:dev`, then run `node assets/store-listings/generate.mjs` from the repository root.
It opens a dedicated temporary browser profile, uses the installed extension, and converts
captures to RGB PNGs with ImageMagick. It refreshes the images and verification metadata,
preserving the description and upload instructions. Intermediate files stay in `.artifacts/`.
