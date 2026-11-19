# @raineworks/server

The Hono server: the probes, the JSON API, and every web zone, served from one origin. Production is a single
standalone binary with every zone embedded, run from a distroless image. How it fits together:
[docs/architecture.md](../../docs/architecture.md#the-server).

| Path | What |
| --- | --- |
| `src/main.ts` | Process entry (and the binary's): `Bun.serve`, graceful shutdown |
| `src/app.ts` | `createApp()`: headers, `/api`, the zones; `AppType` for `@raineworks/api`. Its module comment lists every route |
| `src/index.ts` | The public entry: `createApp`, `AppType` (zones `import type` only) |
| `src/lib/env.ts` | Settings, parsed with Zod: `PORT`, `HOST`, `WEB_DIST`, `SHUTDOWN_DRAIN_MS` (`.env.example`) |
| `src/lib/spa.ts` | Serves the zones: embedded or from disk, each prerendered page at its path and the 404 page with its status (deep links fall back to `index.html`), precompression, ETags, the build stamp; `zoneBuild` |
| `src/lib/shutdown.ts` | SIGTERM: `/readyz` fails for the drain, then the server stops and requests finish |
| `src/routers/health.ts` | `/healthz`, `/readyz` |
| `src/routers/build.ts` | `GET /api/build?zone=`: the build a zone serves, for pages' update check |
| `src/routers/contact.ts` | `POST /api/contact`: the contact form (validated, acknowledged with a 202) |
| `src/routers/projects.ts` | `GET /api/projects`: the repositories tagged `raineworks` on GitHub, for the project cards and the SSH app |
| `src/lib/github.ts` | The projects from GitHub (repositories tagged `raineworks`): one request for every repository, kept ten minutes, the last list served while GitHub is down |
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
