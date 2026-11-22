# raineworks brand assets

The raineworks mark and logo, in every colourway, the favicons and the social images. Drawn from the logo's source
(`@raineworks/ui/blocks/brand`) by `packages/ui/scripts/brand-assets.tsx`: don't edit these by hand, run it again.

```bash
cd packages/ui
bun run brand-assets [path/to/chrome]   # this folder, and the site's favicons and home-screen icon
bun run og-image [path/to/chrome]       # the share image (copied here as social/og-image-1200x630.png)
bun run wallpapers [path/to/chrome]     # wallpapers/ (add a name, e.g. `storm` or `5k`, to draw only those)
```

The accent is a gradient of peach `#ea9a7e` into teal `#2998ad`, top left to bottom right across the mark.

| Folder | What |
| --- | --- |
| `svg/` | `raineworks-icon-*` (the mark) and `raineworks-logo-*` (mark and wordmark) |
| `png/` | The same, icons at 512 and 1024 px, logos 1000 and 2000 px wide |
| `favicon/` | `favicon.svg` (follows the OS's light or dark), `favicon-inactive.svg` (white on black, while the page isn't focused), `favicon.ico` (16, 32, 48), PNGs at 16 to 512, `favicon.webp`, `apple-touch-icon.png` |
| `social/` | Avatars (400 and 1000 px, the mark inside the circle platforms crop to), `x-header-1500x500`, `linkedin-banner-1584x396`, `github-social-preview-1280x640`, `og-image-1200x630` |
| `wallpapers/` | Dark wallpapers, `raineworks-<design>-<screen>-<size>.png`: **halo** (the mark, large and glowing, in a light rain), **storm** (rain and circuit traces over the whole screen, the mark small), **eclipse** (a slice of a huge mark sweeping off the edge). Each for `pixel-11-pro` (1280×2856), `iphone-pro-max` (1290×2796), `4k` (3840×2160), `5k` (5120×2880), `macbook-pro-16` (3456×2234) and `ultrawide` (3440×1440) |

| Colourway | Mark | Wordmark | Background |
| --- | --- | --- | --- |
| `gradient-on-black` | gradient | white | black |
| `gradient-on-white` | gradient | black | white |
| `gradient-white-transparent` | gradient | white | none (for dark backgrounds) |
| `gradient-black-transparent` | gradient | black | none (for light backgrounds) |
| `gradient-transparent` (icon only) | gradient | | none |
| `black-on-white`, `white-on-black` | black / white | black / white | white / black |
| `black-transparent`, `white-transparent` | black / white | black / white | none |
