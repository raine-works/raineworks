# raineworks

Personal site for Raine Petersen, themed as a terminal. A Bun workspace monorepo: a Hono backend serves a React 19 front end and compiles to a single standalone binary.

## Layout

| Package | Purpose |
|---------|---------|
| `packages/marketing` | React 19 + TanStack Router + Tailwind v4 front end, bundled with `Bun.build` |
| `packages/backend` | Hono server: serves the built front ends and exposes `/api/*` |
| `packages/tools` | Shared build and HTTP helpers |

Content (bio, work, projects, hobbies) lives in `packages/marketing/src/content/profile.ts`.

## Requirements

- [Bun](https://bun.sh) 1.4+

## Development

```sh
bun install
bun run dev        # rebuild on save, no HMR
bun run lint
bun run typecheck
bun run build
```

The backend listens on `PORT` (default `3032`).

## API

| Route | Description |
|-------|-------------|
| `GET /api/health` | Liveness check |
| `POST /api/contact` | Contact form intake. Validates and acknowledges with `202`; submissions are currently discarded, not stored or delivered |

## Production

`packages/backend/Dockerfile` builds a standalone binary with every front end embedded and runs it in a distroless image:

```sh
docker build -f packages/backend/Dockerfile -t raineworks .
docker run -p 3032:3032 raineworks
```

CI (`.github/workflows/deploy.yml`) verifies and publishes the image on merges to `master`.

See `AGENTS.md` for repository conventions (import aliases, build rules).

## License

[MIT](LICENSE)
