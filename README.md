# raineworks

Personal site for Raine Petersen, themed as a terminal. A Bun workspace monorepo: a Hono backend serves a React 19 front end and compiles to a single standalone binary.

## Layout

| Package | Purpose |
|---------|---------|
| `packages/marketing` | React 19 + TanStack Router + Tailwind v4 front end, bundled with `Bun.build` |
| `packages/backend` | Hono server: serves the built front ends and exposes `/api/*` |
| `packages/ssh` | `ssh raineworks.com` terminal UI: Ink screens plus an `ssh2` server, compiled to its own binary |
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

### SSH terminal UI

`packages/ssh/Dockerfile` builds the SSH server (read-only, no shell access; it only renders the site as a TUI). It needs a persistent ed25519 host key mounted into the container:

```sh
ssh-keygen -t ed25519 -N '' -f host_key
docker build -f packages/ssh/Dockerfile -t raineworks-ssh .
docker run -p 22:2222 -v "$PWD/host_key:/run/secrets/ssh_host_key:ro" --read-only --cap-drop ALL raineworks-ssh
ssh localhost
```

Configuration: `SSH_PORT` (default `2222`) and `SSH_HOST_KEY_PATH` (required). For local development without Docker: `SSH_HOST_KEY_PATH=./host_key bun run --filter @app/ssh start`.

See `AGENTS.md` for repository conventions (import aliases, build rules).

## License

[MIT](LICENSE)
