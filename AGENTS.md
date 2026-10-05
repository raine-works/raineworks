# Project Guidelines & Rules

## Import Aliases Rule

- **Always use import aliases** rather than relative imports (`./` or `../`) anywhere in this codebase:
  - Within each package, use the `@/*` alias for internal file imports (e.g., `import { app } from '@/index'`).
  - For cross-package references, use the `@app/<package>` workspace alias (e.g., `import { getAssetHeaders } from '@app/tools/http'`) or the shorthand alias (`@tools`, `@backend`, `@marketing`, `@ssh`).
  - Never use relative imports like `import ... from '../../marketing/dist'` in source files, test files, or build scripts.

## Build Rule

- **No Vite, no dev server framework.** Each frontend package bundles with `Bun.build` via the shared `@app/tools/build` helper (`runFrontendBuildCli`). Dev mode is `--watch` (rebuild on save, no HMR).
- **Micro-frontend hosting.** `@app/backend` is a Hono server that serves built frontend packages as micro-frontends (see `packages/backend/src/lib/mfe.ts`). To add a new frontend package: create `packages/<name>` with the same `index.html` + `scripts/build.ts` shape as `packages/marketing`, then register it in `packages/backend/scripts/build.ts`'s `microFrontends` list.
- **Production runtime** is a single standalone binary (`bun build --compile --asset=mfes`) that embeds every registered frontend's build output, run from a distroless container (no shell, no Bun install) — see `packages/backend/Dockerfile`.

## SSH Terminal UI

- `packages/ssh` (`@app/ssh`) is the `ssh raineworks.com` terminal UI, built with Ink (React for terminals). It is **not** a micro-frontend: it is not served by `@app/backend` and has no `index.html`.
- Content comes from `@marketing/content/profile`, the same module the website uses. Add or edit content there, never in a TUI copy.
- Screens live in `packages/ssh/src/screens` and render with plain Ink, so they are testable without SSH (`ink-testing-library`, see `src/App.test.tsx`).
- All text from content must go through `sanitize()` (`src/sanitize.ts`) before rendering so it can't inject terminal escape sequences.
- Keep the TUI read-only and the width responsive (`useWindowSize`); don't assume a fixed terminal size or color support.
