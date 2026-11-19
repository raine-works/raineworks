# Architecture

How the repo is put together, and why. Rules are in [AGENTS.md](../AGENTS.md); code style in
[STYLEGUIDE.md](../STYLEGUIDE.md).

---

## Packages

A Bun workspace (`packages/*`), every package `@raineworks/<name>`, every dependency version in the root catalog.

| Package | What it is | Depends on |
| --- | --- | --- |
| `@raineworks/server` | The Hono server: probes, `/api`, and every web zone, compiled into one standalone binary | `tools` |
| `@raineworks/api` | The typed `hc` client over the server's `AppType` | `tools`, (types of) `server` |
| `@raineworks/ui` | The design system: tokens, shadcn components, blocks, the zone root (`mountZone`), About | `api`, `tools` |
| `@raineworks/web-marketing` | The `marketing` zone: the site itself, served at `/`; exports `content/profile`, what every page (and the SSH app) says | `ui`, `tools` |
| `@raineworks/ssh` | `ssh raineworks.com`: the site as an OpenTUI terminal UI over an `ssh2` server, its own image ([README](../packages/ssh/README.md)) | `web-marketing` |
| `@raineworks/tools` | The shared toolbox: zones, the frontend build, env, HTTP, versions, releases, notices, prototypes | — |
| `@raineworks/tsconfig` | The TypeScript configs every package extends | — |

The root `tsconfig.json` references every package (and `scripts/`), so `bun check -b` checks them all. Each package's
`tsconfig.json` maps `@raineworks/<name>/*` to its own `src/*`, and its `package.json` `exports` the same paths, so an
import reads the same from anywhere: no relative imports, ever.

## Zones (micro-frontends)

Each web app is its own package, built and deployed with the server but bundled on its own, with its own `publicPath`.
The registry is `@raineworks/tools/zones`, shared by the server (routing), the builds (public paths) and the pages
(links).

| Zone | Package | Path | What |
| --- | --- | --- | --- |
| `marketing` | `@raineworks/web-marketing` | `/` | Raine Petersen's site: home, work, projects, hobbies, contact |

The root is a zone of its own: `resolveZone`
gives a zone mounted under a segment (`/app/…`) its paths, and everything else to the root zone. Links between zones
are full page loads (`zoneHref`); within one, TanStack Router links.

Every zone shares the origin, so they share cookies and `localStorage` (the theme, what's new seen).

### Adding a zone

1. Add it to `ZONES` in `packages/tools/src/zones.ts` (basepath, package, title).
2. Copy `packages/web-marketing`'s `package.json`, `tsconfig.json`, `bunfig.toml`, `index.html`, `scripts/build.ts`,
   `src/main.tsx`, `src/prerender.tsx`, `src/styles.css` and `src/router.tsx`, renaming `web-marketing` / `marketing`
   in each.
3. Add it to the root `tsconfig.json`'s references and `bun install`. `bun run dev` and `bun run build:web` pick it up
   through the `@raineworks/web-*` filter, and the server build embeds it. Write its `README.md`.

## The server

```
/healthz, /readyz            probes (outside /api)
/api/articles                Raine's articles on X (lib/x; cached an hour; `{ enabled: false }` without X_BEARER_TOKEN)
/api/build                   the build a zone is serving, for its update check
/api/contact                 the contact form (POST; validated and acknowledged with a 202, not yet stored or delivered)
/api/projects/stars          star counts of Raine's repositories on GitHub, for the project cards (lib/github; cached)
/api/openapi.json            the OpenAPI 3.1 document of every /api route, generated from the routes (lib/openapi)
/api/*                       anything else: a JSON 404
/feed.xml                    the articles as RSS (lib/rss; only with X_BEARER_TOKEN)
/*                           the zones (lib/spa); `/articles` is the 404 without X_BEARER_TOKEN
```

- `src/main.ts` starts `Bun.serve` (loopback in development, every interface otherwise) and stops gracefully on
  SIGTERM: `/readyz` fails for `SHUTDOWN_DRAIN_MS`, then the server stops taking connections and lets requests finish.
- `src/app.ts` builds the app (`createApp`): secure headers on everything, the API, then `lib/spa`, and one error
  handler so every refusal is `{ error: { code, message } }`. `AppType` (the `/api` tree) types `@raineworks/api`.
- The API documents itself: `hono-openapi` builds the OpenAPI document from the routes, their requests from their
  validators (`lib/validate`, the Zod schemas that check them) and their responses from `describeRoute`
  (`lib/openapi`). The docs can't drift from what the routes accept.
- `lib/env` parses the environment with Zod. `NODE_ENV` unset is production (fail closed).

### Serving the zones (`lib/spa`)

- **Where from:** a compiled binary reads `Bun.embeddedFiles` (`web/<zone>/…`); otherwise `WEB_DIST/<zone>` when set,
  else each zone's `packages/web-<name>/dist`. Paths outside the zone's directory are refused.
- **Pages:** a path without an extension gets the zone's prerendered page for it (`<path>/index.html`), else its
  `404.html` with a 404 status, else (a zone that doesn't prerender) its `index.html`; a path with one that isn't a
  file, a 404. Pages are served at their paths, never by their file names.
- **Compression:** the build writes `.br` / `.gz` siblings of every text asset; the server picks by `Accept-Encoding`.
  Pages are compressed per request.
- **Caching:** content-hashed files (`chunk-x.js`) for a year, immutable; pages revalidated on every load against a
  strong ETag (304 when it matches). Development never caches HTML.
- **Build stamp:** each page gets `<meta name="raineworks-build">` (the hash of its zone's `index.html`, which changes
  whenever any of the zone's files does). Pages compare it with `GET /api/build` to notice a new release under them
  ([frontend.md](frontend.md#versions-and-updates)).

## Production

Two services, each in its own distroless image: the server (`packages/server/Dockerfile`, the site), a standalone
binary; and the SSH app (`packages/ssh/Dockerfile`), a bundle run on Bun's distroless image with OpenTUI's native
library beside it ([its README](../packages/ssh/README.md#the-build-and-its-licences)). [development.md](development.md#deployment) has where they run.

`bun run build` builds every zone (minified, precompressed, with `build.json` and `notices.json`), copies each
`dist/` to `packages/server/dist/web/<zone>`, and compiles `src/main.ts` into `packages/server/dist/server` with `web/`
embedded. The Dockerfile does the same in a `oven/bun:1.4.4` stage and copies only the binary into
`gcr.io/distroless/base-debian13:nonroot`: no shell, no package manager, nothing else to copy. Its `VERSION` and `GIT_SHA` build
arguments stamp the release (an image has no `.git`).
