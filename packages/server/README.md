# @raineworks/server

The Hono server: the probes, the JSON API, and every web zone, served from one origin. Production is a single
standalone binary with every zone embedded, run from a distroless image. How it fits together:
[docs/architecture.md](../../docs/architecture.md#the-server).

| Path | What |
| --- | --- |
| `src/main.ts` | Process entry (and the binary's): `Bun.serve`, graceful shutdown |
| `src/app.ts` | `createApp()`: headers, `/api`, the zones; `AppType` for `@raineworks/api`. Its module comment lists every route |
| `src/index.ts` | The public entry: `createApp`, `AppType` (zones `import type` only) |
| `src/lib/env.ts` | Settings, parsed with Zod: `PORT`, `HOST`, `WEB_DIST`, `SHUTDOWN_DRAIN_MS`, `X_BEARER_TOKEN` (`.env.example`) |
| `src/lib/spa.ts` | Serves the zones: embedded or from disk, each prerendered page at its path and the 404 page with its status (deep links fall back to `index.html`; a page that's off is the 404), precompression, ETags, the build stamp; `zoneBuild` |
| `src/lib/shutdown.ts` | SIGTERM: `/readyz` fails for the drain, then the server stops and requests finish |
| `src/routers/health.ts` | `/healthz`, `/readyz` |
| `src/routers/build.ts` | `GET /api/build?zone=`: the build a zone serves, for pages' update check |
| `src/routers/articles.ts` | `GET /api/articles`: Raine's articles on X, or `{ enabled: false }` without `X_BEARER_TOKEN` |
| `src/lib/x.ts` | The articles from the X API: the account looked up once, then only posts newer than the newest seen, an hour apart; the last list served while X is down |
| `src/lib/rss.ts` | The articles as RSS 2.0, for `GET /feed.xml` (only with `X_BEARER_TOKEN`) |
| `src/routers/contact.ts` | `POST /api/contact`: the contact form (validated, acknowledged with a 202) |
| `src/routers/projects.ts` | `GET /api/projects`: the repositories tagged `raineworks` on GitHub, for the project cards and the SSH app |
| `src/lib/github.ts` | The projects from GitHub (repositories tagged `raineworks`): one request for every repository, kept ten minutes, the last list served while GitHub is down |
| `src/routers/docs.ts` | `GET /api/docs/<project>?page=`: a project's documentation page, rendered, with the navigation its index gives |
| `src/lib/docs.ts` | The docs from the project's repository on GitHub (raw files of its docs folder, only names `@raineworks/tools/docs` allows): cached five minutes, a missing page a minute, bounded, the last copy served while GitHub is down |
| `src/lib/docs-render.ts` | A docs page's Markdown as HTML (no raw HTML, comments stripped), its title, its links (to site routes, GitHub or out) and images, and the index's navigation |
| `src/lib/validate.ts` | `validate(target, schema)`: Zod at the boundary, a 400 `invalid_request`, and the request documented |
| `src/lib/openapi.ts` | The OpenAPI document (`GET /api/openapi.json`): `jsonResponse`, `errorResponse`, `invalidRequest` for each route's `describeRoute`; tagging; the version |
| `scripts/openapi.ts` | `bun run openapi [--out api.json]`: the same document, from the routes alone |
| `scripts/build.ts` | `bun run build`: every zone, then `dist/server` with them embedded (`--skip-web` reuses the zones' builds) |
| `Dockerfile` | The image: built on `oven/bun:1.4.4`, run on distroless; `VERSION` / `GIT_SHA` build args stamp it |

```bash
bun run dev           # NODE_ENV=development, watching src/ (the root's `bun run dev` builds the zones too)
bun run build         # → dist/server
bun run docker:build  # → raineworks-server:latest
bun test              # app.test.ts: routes through createApp().request(), a zone of its own in WEB_DIST
```
