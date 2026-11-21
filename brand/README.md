# raineworks brand assets

The raineworks mark and logo, in every colourway, the favicons and the social images. Drawn from the logo's source
(`@raineworks/ui/blocks/brand`) by `packages/ui/scripts/brand-assets.tsx`: don't edit these by hand, run it again.

```bash
cd packages/ui
bun run brand-assets [path/to/chrome]   # this folder, and the site's favicons and home-screen icon
bun run og-image [path/to/chrome]       # the share image (copied here as social/og-image-1200x630.png)
```

The accent is a gradient of peach `#ea9a7e` into teal `#2998ad`, top left to bottom right across the mark.

| Folder | What |
| --- | --- |
| `svg/` | `raineworks-icon-*` (the mark) and `raineworks-logo-*` (mark and wordmark) |
| `png/` | The same, icons at 512 and 1024 px, logos 1000 and 2000 px wide |
| `favicon/` | `favicon.svg` (follows the OS's light or dark), `favicon-inactive.svg` (white on black, while the page isn't focused), `favicon.ico` (16, 32, 48), PNGs at 16 to 512, `favicon.webp`, `apple-touch-icon.png` |
| `social/` | Avatars (400 and 1000 px, the mark inside the circle platforms crop to), `x-header-1500x500`, `linkedin-banner-1584x396`, `github-social-preview-1280x640`, `og-image-1200x630` |

| Colourway | Mark | Wordmark | Background |
| --- | --- | --- | --- |
| `gradient-on-black` | gradient | white | black |
| `gradient-on-white` | gradient | black | white |
| `gradient-white-transparent` | gradient | white | none (for dark backgrounds) |
| `gradient-black-transparent` | gradient | black | none (for light backgrounds) |
| `gradient-transparent` (icon only) | gradient | | none |
| `black-on-white`, `white-on-black` | black / white | black / white | white / black |
| `black-transparent`, `white-transparent` | black / white | black / white | none |
