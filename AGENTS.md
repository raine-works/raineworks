# Project Guidelines & Rules

## Import Aliases Rule

- **Always use import aliases** rather than relative imports (`./` or `../`) anywhere in this codebase:
  - Within each package, use the `@/*` alias for internal file imports (e.g., `import { app } from '@/index'`).
  - For cross-package references, use the `@app/<package>` workspace alias (e.g., `import { getAssetHeaders } from '@app/tools/http'`) or the shorthand alias (`@tools`, `@backend`, `@web`, `@ssh`).
  - Never use relative imports like `import ... from '../../web/dist'` in source files, test files, or build scripts.

## Build Rule

- **No Vite, no dev server framework.** Each frontend package bundles with `Bun.build` via the shared `@app/tools/build` helper (`runFrontendBuildCli`). Dev mode is `--watch` (rebuild on save, no HMR).
- **Micro-frontend hosting.** `@app/backend` is a Hono server that serves built frontend packages as micro-frontends (see `packages/backend/src/lib/mfe.ts`). To add a new frontend package: create `packages/<name>` with the same `index.html` + `scripts/build.ts` shape as `packages/web`, then register it in `packages/backend/scripts/build.ts`'s `microFrontends` list.
- **Production runtime** is a single standalone binary (`bun build --compile --asset=mfes`) that embeds every registered frontend's build output, run from a distroless container (no shell, no Bun install) — see `packages/backend/Dockerfile`.

## SSH Terminal UI

- `packages/ssh` (`@app/ssh`) is the `ssh raineworks.com` terminal UI, built with Ink (React for terminals). It is **not** a micro-frontend: it is not served by `@app/backend` and has no `index.html`.
- Content comes from `@web/content/profile`, the same module the website uses. Add or edit content there, never in a TUI copy.
- Screens live in `packages/ssh/src/screens` and render with plain Ink, so they are testable without SSH (`ink-testing-library`, see `src/App.test.tsx`).
- All text from content must go through `sanitize()` (`src/sanitize.ts`) before rendering so it can't inject terminal escape sequences.
- Keep the TUI read-only and the width responsive (`useWindowSize`); don't assume a fixed terminal size or color support.
- **SSH server** (`src/server`, entry `src/main.ts`) uses `ssh2`. It accepts `none` auth only and serves a single pty `shell` session running the Ink app. Exec, subsystems, port forwarding, agent/X11 forwarding and shells without a pty are rejected; do not add handlers for them. Connection and rate limits live in `src/server/limits.ts` (unit-tested); pty sizes are clamped.
- **Build** with `bun run --filter @app/ssh build` (`scripts/build.ts`) -> `dist/ssh-server`. Keep `target: 'bun'` and `keepNames: true`: without them the compiled binary crashes on disconnect because `ssh2` checks `channel.constructor.name === 'Session'`. `react-devtools-core` and `cpu-features` are stubbed out on purpose.
- **Container** is `packages/ssh/Dockerfile` (distroless, non-root, no shell), published by CI as `ghcr.io/<repo>-ssh`. It listens on `SSH_PORT` (default `2222`); map host port 22 to it. The host key is **never** baked in or generated: mount an ed25519 private key at `SSH_HOST_KEY_PATH` (default `/run/secrets/ssh_host_key`), or clients get a host-key-changed warning on every deploy. The container runs as uid 65532, so the key file must be readable by it (`chown 65532`, or secret mode `0440` with group 65532). The server exits if the key is missing.
- `ssh raineworks.com` needs the apex DNS record to point at a host that exposes port 22 to this container; move that host's own sshd to another port.
- Limits are keyed on the TCP peer address (`info.ip`). Behind a proxy that hides client IPs they collapse into one bucket; tune `SSH_MAX_PER_IP`/`SSH_RATE_PER_IP`.
