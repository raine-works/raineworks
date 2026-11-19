# @raineworks/ui

The shared React UI for every web zone: the design system (shadcn/ui on Tailwind v4, neutral palette,
light and dark), the site's blocks, the zones' runtime and About. How the zones use it:
[docs/frontend.md](../../docs/frontend.md).

| Import | What |
| --- | --- |
| `@raineworks/ui/globals.css` | Tailwind v4 theme: tokens light and dark, Geist fonts, the `ui-sdk` layer, prose for rendered Markdown. Import once per zone. |
| `@raineworks/ui/components/*` | shadcn/ui primitives (alert, badge, button, card, dialog, input, separator, skeleton, sonner, spinner, tabs, tooltip) |
| `@raineworks/ui/blocks/*` | `brand` (`AppLogo`, `AppMark`), `page` (`Page`, `useDocumentTitle`), `theme-toggle` (ui-sdk Menu), `query-state` (`QueryState`, `ErrorState`), `release-notes` (About; `VersionLabel`, `openReleaseNotes`), `notices` (`Legal`), `route-error` (`RouteError`), `full-page` (`NotFoundPage`) |
| `@raineworks/ui/app/root` | `mountZone(router)`: theme, modal history, the agent bridge, providers (TanStack Query, tooltips, toasts, About), hydrating a prerendered page; `RouterContext` |
| `@raineworks/ui/app/prerender` | `prerenderZone(router)`: every page rendered at build time with its head, and the 404 |
| `@raineworks/ui/lib/*` | `api` (`api`, `apiFetch`, `queryClient`, `unwrap`, `ApiError`, `errorMessage`), `brand` (`APP_NAME`, `APP_LICENSE`, `COPYRIGHT_HOLDER`, `SOURCE_URL`, `SITE_URL`, `SITE_DESCRIPTION`), `head` (`PageHead`, `staticData.head`, `headTags`, `SHARE_IMAGE`), `agent` (`connectAgent`: ui-sdk's agent bridge and WebMCP), `version` (`APP_VERSION`, `APP_COMMIT`, the update check), `lazy`, `modal-history`, `browser-storage`, `format`, `utils` (`cn`) |
| `@raineworks/ui/hooks/*` | `use-theme` |
| `@raineworks/ui/assets/*` | The favicon (the raineworks mark), the home-screen icon, and the share image (`og-image.png`, drawn by `bun run og-image`) |

Release notes live in `src/release-notes/<version>.md` (`bun run release` starts the next one); every zone's build
bundles them for About.

## Adding shadcn components

```bash
cd packages/ui
bunx --bun shadcn@4.23.0 add <component>
```

`components.json` points the aliases at `@raineworks/ui/*`. Afterwards: check `cn` comes from `@raineworks/ui/lib/utils`,
drop what it added to `package.json` that we don't use (move real dependencies into the root catalog), make focus rings
solid (`focus-visible:ring-2 focus-visible:ring-ring`), keep the `data-slot`s (phones' 40px tap targets key on them),
and run `bun run format`.
