# Frontend

How the web zones are put together. Rules are in [AGENTS.md](../AGENTS.md#frontend); code style in
[STYLEGUIDE.md](../STYLEGUIDE.md#frontend).

---

## A zone

```
packages/web-<zone>/
  index.html            the entry: favicon, theme colours, styles, src/main.tsx
  scripts/build.ts      runFrontendBuildCli({ publicPath: zonePublicPath(zone), watchDirs: [ui/src] })
  src/main.tsx          await mountZone(router)
  src/prerender.tsx     export const prerender = prerenderZone(router)
  src/router.tsx        code-based routes, each with its staticData.head; the module comment lists every page
  src/routes/*.tsx      one module per page, exporting its component
  src/components/*.tsx  what only this zone uses
  src/styles.css        @import "@raineworks/ui/globals.css"; @source "./";
```

`mountZone` (`@raineworks/ui/app/root`) applies the theme before the first render, connects the browser's history to
modals (Back closes the one on top) and the agent bridge (`lib/agent`), and renders the router inside the zone's
providers: TanStack Query, tooltips, toasts and About. A prerendered page is hydrated, not replaced.

## Prerendering, search and share cards

Every page is rendered at build time (`@raineworks/ui/app/prerender`, run by the zone's build through
`src/prerender.tsx`): each route without parameters to `<path>/index.html`, and the not-found page to `404.html`,
which the server sends with a 404 status. So a page shows before its script has loaded, and search engines and link
previews (Slack, iMessage, X, LinkedIn) see each page for what it is.

- **The head** of each page is its route's `staticData.head` (`lib/head`): the title ("Work · raineworks"), the
  description, a canonical link, Open Graph and X card tags with the share image, and schema.org JSON-LD where the
  route gives some (Home: Raine, as a `Person`). An inline script applies the theme before the first paint
  (`THEME_SCRIPT`, `hooks/use-theme`), so a dark page never flashes light.
- **The share image** is `@raineworks/ui/assets/og-image.png` (1200×630), drawn from the logo by
  `packages/ui/scripts/og-image.tsx` (`bun run og-image` in `packages/ui`, with Chrome). Run it again when the logo
  or the words change; the build serves it under a content-hashed name, so a changed image is a new URL to every
  cache.
- **`sitemap.xml` and `robots.txt`** list every page found, at `SITE_URL` (`lib/brand`).
- **Hydration waits for the first paint.** The page is all in its HTML (its links work without a script), so its
  script loads once the content has painted (`hydrateAfterLoad`, `@raineworks/tools/build`) and never competes with
  the stylesheet and fonts. The router is marked server-rendered (`router.ssr`) so the tree it hydrates is the one
  that was rendered.
- **What the server and the browser render must match.** Read browser state in effects or through
  `useSyncExternalStore` with a server snapshot (`useTheme`); something that can't match (the footer's year) takes
  `suppressHydrationWarning`. Live data (the projects, `GET /api/projects`) loads in the browser, in place of
  placeholders the same size, so nothing moves when it arrives.

Check it with Lighthouse against a production build (`bun run build:web`, then the server with
`NODE_ENV=production`): every page scores 100 in every category, on mobile and desktop.

## Agents

ui-sdk's agent bridge (`lib/agent`, connected by `mountZone`) lets an agent read the page's ui-sdk components (the theme
menu, the phone menu) and call their actions directly, rather than clicking. It's registered with the browser's own
agent through WebMCP (`document.modelContext`) where the browser has it, and does nothing elsewhere. A control marked
`data-agent-confirm` is left to the person. Only ui-sdk components join the bridge, not the shadcn ones.

Every route but the landing page loads lazily, the same way:

```tsx
const workRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/work',
	component: lazyRouteComponent(() => import('@raineworks/web-marketing/routes/work'), 'WorkPage'),
});
```

Every router sets `defaultErrorComponent: RouteError` (a page that throws shows what went wrong and Retry, or Reload
for a chunk gone after a release) and `notFoundComponent: NotFoundPage`.

## Design system

shadcn/ui on Tailwind v4, the neutral palette in light and dark (`@raineworks/ui/globals.css`), Geist
and Geist Mono. The brand is monochrome, like the logo, with one accent: a gradient of peach (`#ea9a7e`) into teal
(`#2998ad`).

- **Tokens, never colours:** `bg-background`, `text-muted-foreground`, `border`, `bg-brand` / `text-brand-ink`. The
  brand means "act here" (primary buttons, focus rings, the active nav item), never a status.
- **Pages:** a `Page` (`blocks/page`: `h1`, description, `document.title` as "<title> · raineworks") of cards, blocks
  `gap-6` apart; card grids `grid items-start gap-4 lg:grid-cols-2`; cards `px-5 py-5`.
- **Accent:** the gradient is decoration, never a meaning (not "act here", not a status), and used sparingly: the
  logo's mark, the hairlines under the header and over the footer and under the current page, the rule over each
  page's title, the home page's name and eyebrows, the borders of every card and outlined button, the timeline's
  dots. Through the utilities in `globals.css`: `text-gradient` (text, readable in both themes: deepened in light
  mode), `gradient-border` (a 1px border, `--gradient-border-mix` of the way from the border colour to the gradient:
  40% at rest, `Card` and the outline `Button` have it; a hover or focus state sets 100%), `gradient-fill`,
  `gradient-hairline`, `gradient-glow`. Fills, focus rings and links stay black and white.
- **Logo:** `AppLogo` (mark and wordmark) and `AppMark` (`blocks/brand`), drawn inline from the logo's SVG source so
  they follow the theme; `gradient` strokes the mark in the accent. The favicon (`assets/favicon.svg`) is the gradient
  mark on a tile that swaps white and black with the OS scheme.
- **Brand assets:** `brand/` at the repository's root has the mark and the logo in every colourway (the gradient, and
  black and white, on white, on black and on nothing) as SVG and PNG, the favicons, and the social images (avatars, X
  header, LinkedIn banner, GitHub's social preview, the share image). `bun run brand-assets` in `packages/ui` draws
  them all from `blocks/brand`, with Chrome, and the site's favicon and home-screen icon with them; run it again when
  the logo or the accent changes.
- **Theme:** light, dark or the system's (`hooks/use-theme`, stored in `localStorage` through `lib/browser-storage`,
  applied as `.dark` on `<html>`), chosen from `blocks/theme-toggle`.
- **ui-sdk** gives the behaviour of the theme menu and the phone menu (focus, keys, dismissal, swipe); they're styled
  with the same tokens as the shadcn components.
- **Mobile:** every page is checked at 375px wide; nothing scrolls sideways; buttons and inputs are at least 40px tall
  below `md` (`globals.css`).
- **Copy:** sentence case, typographic apostrophes and quotes (’ “ ”), buttons that say what they do.

## About: What's new and Legal

`blocks/release-notes` is About, a dialog mounted once by `mountZone` and opened from the footer's `VersionLabel`
("raineworks 2026.11.1 · f88c69e"). It has two tabs:

- **What's new:** the release notes (`packages/ui/src/release-notes/<version>.md`), newest first, rendered to HTML at
  build time (`@raineworks/tools/markdown`, the `raineworks:release-notes` module), so no Markdown parser ships. The
  list loads with the page; each note's text is its own chunk, loaded when shown. The release the page is from is
  marked **Yours**. Parts in `::: for <zones>` blocks show only in those zones.
- **Legal** (`blocks/notices`): the site's own licence (MIT, © Raineworks LLC, linking to the source on GitHub), then the
  third-party notices: every open-source package the zone is built with, its licence and that licence's text, searchable.
  The zone's build works them out from what it bundled (the metafile) and writes `dist/notices.json`, fetched when the
  tab opens; packages sharing a licence text are one row. Only permissive licences (and the fonts' OFL-1.1) may ship:
  any other fails the build ([AGENTS.md](../AGENTS.md#versions-releases-and-licences)).

## Versions and updates

Every zone's build stamps its version and commit (`__RAINEWORKS_VERSION__`, `__RAINEWORKS_COMMIT__`, and
`dist/build.json`): `RAINEWORKS_VERSION` / `RAINEWORKS_COMMIT` when set (CI, the image), else the newest release note's
version and git's commit.

A page knows the build it loaded with (`<meta name="raineworks-build">`, stamped by the server) and asks
`GET /api/build?zone=` every minute while it's in view, and when it's shown again, gets focus or comes back online
(`lib/version`). Once the build differs it offers, once, to reload, or to reload into What's new. Not in development.

A release replaces every hashed chunk, so an open page's next lazy import can fail: lazy routes reload the page once
to get the new build (guarded through `sessionStorage`, `lib/lazy`), and `RouteError` offers Reload for what still
fails.

## Build

`@raineworks/tools/build` (`Bun.build`, the only bundler): Tailwind (`bun-plugin-tailwind`), the React Compiler
(`reactCompiler: true`), the release notes plugin, code splitting, `<link rel="modulepreload">` for the entry's static
imports, fonts as content-hashed files of their own (`fontFilesPlugin`: Bun would inline every subset into the
stylesheet), `publicFiles` (the share image) under content-hashed names, the pages prerendered (`prerender`), and, for
production builds, `.br` / `.gz` siblings of every text output and minification. `--watch` rebuilds
on a change in the zone, its `index.html` or `@raineworks/ui`.

### React Compiler

Zones are memoized by the React Compiler. It compiles only `.tsx` / `.jsx` modules, and silently skips a component or
hook that breaks the Rules of React ([STYLEGUIDE.md](../STYLEGUIDE.md#rules-of-react-the-react-compiler-depends-on-them)).
`packages/tools/src/react-compiler.test.ts` builds every zone and fails naming each `<path>#<name>` it skipped; only
code we don't own goes in its `ALLOWED` map, with the reason.
