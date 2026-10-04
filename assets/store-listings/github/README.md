# GitHub social preview

Upload `social-preview.png` in repository Settings → General → Social preview.
The image is 1280 × 640 pixels, RGB PNG, and below GitHub's 1 MB limit.

The editable SVG uses the existing KeyMove logo geometry and palette. Render it with
ImageMagick and Arial installed, from the repository root:

```sh
magick -background none -density 192 assets/store-listings/github/social-preview.svg -resize 1280x640 -alpha off -strip PNG24:assets/store-listings/github/social-preview.png
```

This folder is kept with the other listing assets so it is excluded from extension builds.
