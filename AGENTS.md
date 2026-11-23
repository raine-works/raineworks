# Agent guidance for raineworks

Rules for anyone (human or agent) changing this repo. They take precedence over generic best practices.

This file holds **rules**. The reasoning, design and how-tos are in the docs below. Read the relevant one before you
change that area.

| Doc | Read it when |
| --- | --- |
| [README.md](README.md) | Getting oriented: the package map, setup, commands |
| [STYLEGUIDE.md](STYLEGUIDE.md) | Writing any code: formatting, imports, naming, comments, errors, tests |
| [docs/architecture.md](docs/architecture.md) | Adding a package, route or zone; how the server serves the zones |
| [docs/development.md](docs/development.md) | Running, testing, releasing or deploying |
| [docs/frontend.md](docs/frontend.md) | Touching `@raineworks/ui`, a web zone (`packages/web-*`), the design system or the About dialog |
| `packages/*/README.md` | Working inside one package (every package has one) |

## Raineworks base rules

This repository follows Raineworks' base rules, in [`.raineworks/base.md`](.raineworks/base.md): read them before
changing anything.

@.raineworks/base.md

---

## Stack: don't reintroduce what was removed

Bun 1.4.4 (runtime, package manager, test runner, bundler, formatter, type checker) · Hono + Zod · React 19 + React
Compiler · TanStack Router + Query · Tailwind v4 + shadcn/ui + ui-sdk · TypeScript strict, checked by `bun check` ·
formatted by `bun fmt`.

- **Do not** add Vite, a dev server framework or Babel. `bun fmt` also sorts imports and Tailwind classes.
- **Bun is pinned to 1.4.4**: `.bun-version`, `packageManager` and `engines` in `package.json`, `oven/bun:1.4.4` in
  `packages/server/Dockerfile`, and CI (`bun-version-file`). Move them together.
- Workspace scripts fan out with `bun run --filter`.
- A new dependency is a release at least two weeks old, added to the root catalog (`workspaces.catalog`, or
  `catalogs.dev` for build and type tools) and referenced as `catalog:` / `catalog:dev`. Never `bun add` a version into a package's own
  `package.json`: add it to the catalog first (`packages/tools/src/catalog.test.ts` fails on any that isn't). (ui-sdk is the exception
  already made: a beta pinned exactly; read its changelog before moving it.)
- Web zones are bundled only by `Bun.build` with its native React Compiler and Tailwind (`@raineworks/tools/build`,
  `runFrontendBuildCli`). Dev mode is `--watch` (rebuild on save, no HMR).
- Production is one standalone binary (`packages/server/scripts/build.ts`: `Bun.build` `compile` with every zone
  embedded under `web/`), run from a distroless image: no shell, no Bun install.

## Code rules

Full detail in [STYLEGUIDE.md](STYLEGUIDE.md). The ones that break things if ignored:

- **No relative imports.** Always `@raineworks/<package>/<path>`, including inside the same package. Each package maps
  `@raineworks/<package>/*` → `./src/*` in its `tsconfig.json` and exposes the same paths through `package.json`
  `exports`.
- Every source file opens with a JSDoc block saying what the module is for, ending in `@module <path>` (shadcn's
  generated `components/*` excepted). File names are kebab-case.
- Run `bun run format` before you finish; `bun run lint`, `bun run typecheck` and `bun run test` are the checks, and
  `shellcheck scripts/*.sh` for the shell scripts (CI runs it too).
- **Use `@raineworks/tools` before writing your own helper or reaching for a raw built-in.** If a tool almost fits,
  extend it (with a test) rather than working around it.
  - Prototypes (`import '@raineworks/tools/prototypes'` in every module that uses them): `.tryCatch()` /
    `tryCatch(() => …)` instead of `try/catch`, `.isEmpty()` instead of `length === 0` / `.size === 0` / `=== ''`,
    `.unique()` instead of `[...new Set(…)]`.
  - Env (`@raineworks/tools/env`): `baseEnvSchema`, `loadEnvFiles`, `parseEnv` for every package's `env` module.
- Environment is read only through each package's Zod-validated `src/lib/env.ts` (build tools: `buildEnv()`), never
  `process.env` ad hoc.

## Server (`@raineworks/server`)

- `src/main.ts` is the process entry (and the binary's), `src/app.ts` builds the Hono app (`createApp`, `AppType`),
  `src/index.ts` is the public entry. Probes are `/healthz` and `/readyz`, outside `/api`.
- Routers are `<name>Router` in `src/routers/`, chained so RPC types flow to `@raineworks/api`, and mounted on `api`
  in `app.ts`, whose module comment lists every route.
- **Every input is validated with `validate(target, schema)`** (`lib/validate`): Zod at the boundary, a 400
  `invalid_request` naming the problem, and the request documented from the same schema. Give each field a
  `.meta({ description, examples })`.
- **Every route is documented** (`GET /api/openapi.json`, `bun run openapi`): a `describeRoute` with an
  `operationId`, a `summary`, a `description`, and **every response it can give**, each with its body's schema
  (`jsonResponse`, `errorResponse` with its exact codes, `invalidRequest`; `lib/openapi`). A response a route can send
  that its `describeRoute` doesn't list is a bug (`lib/openapi.test.ts` checks every one has a body).
- Errors are `{ error: { code, message } }`: a snake_case code and a user-facing sentence.
- Zones are served by `lib/spa` from `@raineworks/tools/zones`; never hand-roll static file serving.
- The server listens on `PORT` (3032, what production expects).

## SSH (`@raineworks/ssh`)

Detail: [packages/ssh/README.md](packages/ssh/README.md).

- `ssh raineworks.com` is an OpenTUI (`@opentui/react`) terminal UI, not a web zone: the server doesn't serve it. Its content is
  `@raineworks/web-marketing/content/profile`, the module the site renders: edit content there, never in a TUI copy.
  The projects are the site's too, from `GET /api/projects` (`src/server/projects.ts`).
- Every piece of content goes through `sanitize()` before it's rendered, so none can inject terminal escape sequences.
  Keep the TUI read-only and responsive (`useTerminalDimensions`): it draws at every size from 60×20 up.
- A message sent from the TUI goes through the site's own `POST /api/contact` (`src/server/messages.ts`), never
  straight to email, with the same rules (`@raineworks/tools/contact`).
- The server accepts `none` auth and one pty `shell` session only. Exec, subsystems, forwarding and shells without a
  pty are refused: don't add handlers for them. Limits live in `src/server/limits.ts` (tested); pty sizes are clamped.
- The SSH image runs on Bun, not a compiled binary: `scripts/build.ts` bundles for `target: 'bun'` with
  `minify.keepNames` (without names it crashes on disconnect: `ssh2` checks `channel.constructor.name`), and OpenTUI's
  native library stays a separate file (`OTUI_ASSET_ROOT`). Don't compile it into the bundle: see the licence rule
  below.
- The host key is never baked in or generated: `SSH_HOST_KEY` or `SSH_HOST_KEY_PATH`, the same across deploys.

## Versions, releases and licences

Detail: [docs/development.md](docs/development.md#releases), [docs/frontend.md](docs/frontend.md#about-whats-new-and-legal).

- Versions are calendar versions, `YEAR.MONTH.N` (`2026.11.1`), tagged `v<version>`. A push to `master` that changes
  an image is a release, minted by GitHub Actions (`ci.yml`: plan, checks, the images on GHCR, the tag and the GitHub
  release, then Dokploy's deploy): never tag, bump, push an image or deploy by hand.
- The images keep the names production pulls: `ghcr.io/raine-works/raineworks` (the server) and
  `ghcr.io/raine-works/raineworks-ssh` (`imageSuffix`, `@raineworks/tools/images`). `bun run images plan` decides what changed; a file the
  image is built from that it doesn't know about is a bug in `@raineworks/tools/images`.
- Every `@raineworks/*` package a package imports is in its `package.json` (`images.test.ts`): that's how the image
  knows what it's built from.
- Code review, docs sync, the rules audit, `@claude`, Issue to PR, the release note and the release workflows (plan,
  images, publish) are Raineworks' shared workflows in `raine-works/agents`: `.github/workflows` holds their callers (pinned to
  a commit) and raineworks' own `ci.yml` and `checks.yml`. `.github/actions/setup` installs Bun and the packages for
  every one of them.
- A release people would notice has a note, `packages/ui/src/release-notes/<version>.md` (`bun run release` starts
  the next one): frontmatter `title` and `date`, then `##` sections by area. What changed for the people who read the
  site, not how. `bun run release check` fails a note that names a version already released.
- The site is open source under the MIT License (`LICENSE`, © Raineworks LLC, Raine's company). `@raineworks/ui/lib/brand` states the same
  (`APP_LICENSE`, `COPYRIGHT_HOLDER`); a test holds the two together.
- **The one LGPL exception is the SSH image:** OpenTUI's native library statically links a decode-only FFmpeg
  (LGPL-2.1-or-later). It ships only there, as a separate, replaceable file with its licence texts and
  `FFMPEG-SOURCE.md` beside it and every shipped package's licence in `/app/licenses` (`scripts/build.ts`). Nothing
  under the LGPL goes in a web zone or the server.
- Only permissive licences (and the fonts' OFL-1.1) ship in a zone (`ALLOWED_LICENSES`, `@raineworks/tools/notices`):
  a bundled package under any other, or one stating none, fails the build. Code copied into the repo goes in
  `COPIED_NOTICES`; packages only CSS imports go in `STYLE_PACKAGES`.

## Frontend

Detail: [docs/frontend.md](docs/frontend.md).

- One package per zone (`@raineworks/web-<zone>`), registered in `@raineworks/tools/zones` and served by
  `@raineworks/server` from one origin. `marketing` is the root zone (`/`): every path no other zone claims is its.
- A zone is `index.html` + `scripts/build.ts` + `src/main.tsx` (`await mountZone(router)`) + `src/prerender.tsx`
  (`prerenderZone(router)`) + `src/router.tsx` (code-based routes; every route but the landing page loads lazily with
  `lazyRouteComponent`) + `src/routes/*.tsx`.
- **Every page is prerendered and hydrated.** Every route declares `staticData: { head }` (`@raineworks/ui/lib/head`):
  its title and the description search results and link previews show (the build fails a route without one). Render
  the same thing on the server and in the browser: browser state (storage, `window`, the time) is read in effects or
  through `useSyncExternalStore` with a server snapshot, never during render. Data that changes (GitHub stars) is
  fetched by the browser, never prerendered.
- Shared UI lives in `@raineworks/ui`: shadcn primitives in `components/`, the site's compositions in `blocks/`. Zone-only
  code stays in the zone. Zones `import type` from `@raineworks/server`, never values.
- TanStack Router for routing, TanStack Query for server state (through `@raineworks/ui/lib/api`). Don't add another
  router, data-fetching or form library.
- Pages are a `Page` (`blocks/page`) of cards, blocks `gap-6` apart; card grids `grid items-start gap-4 lg:grid-cols-2`.
  Use theme tokens, never raw colours; the brand (`--brand`) means "act here", never a status. Sentence case, typographic
  apostrophes and quotes (’ “ ”).
- Every zone is used on phones: check every page at 375px wide, nothing scrolls sideways.
- The React Compiler compiles every first-party component and hook (`packages/tools/src/react-compiler.test.ts` fails
  for any it skips). Follow the Rules of React in [STYLEGUIDE.md](STYLEGUIDE.md#rules-of-react-the-react-compiler-depends-on-them).
- **Adding shadcn components:** `cd packages/ui && bunx --bun shadcn@4.23.0 add <component>`. Afterwards check `cn`
  comes from `@raineworks/ui/lib/utils`, drop anything it added to `package.json` that we don't use, make focus rings
  solid (`focus-visible:ring-2 focus-visible:ring-ring`), and run `bun run format`.
- **Logo:** `@raineworks/ui/blocks/brand` (`AppLogo`, `AppMark`), drawn inline from the SVG source in Raine's Google
  Drive ("raineworks logo") so it takes `currentColor`. Pass a heavier `strokeWidth` the smaller it's drawn.

## ui-sdk

- Before using ui-sdk, follow the ui-sdk skill if it's installed, and read `node_modules/@ui-sdk/react/docs/llms.txt`
  (from `packages/ui`). To build a new component, also search `node_modules/@ui-sdk/react/docs/core.md` by heading, and
  read `rendering.md` next to it.
- ui-sdk parts are unstyled: style them with the same tokens and classes as the shadcn components (`theme-toggle`
  mirrors shadcn's dropdown menu). `@ui-sdk/core/web.css` isn't imported, so give overlays their own layout (a backdrop
  needs `fixed inset-0 m-0 size-auto border-0 p-0`). `globals.css` declares `@layer ui-sdk;` first so our styles win.

## Development

- `bun run dev:init` sets a clone up (`scripts/init.sh`): each package's `.env.local` from its `.env.example`, keeping
  what's set, and the SSH dev host key. A setting a package reads goes in its `.env.example` (commented when it has a
  default), never only in someone's `.env.local`. Local services, once there are any, start there too
  (`.docker/compose.yaml`).
- `bun run dev` runs every package's `dev` script at once (`--filter '*'`): every zone's watch build, the server
  (`NODE_ENV=development`, loopback, port 3032) and the SSH server (port 2222, with a development host key it makes
  in `packages/ssh/.dev`, git-ignored; never production's). A new package with a `dev` script joins it.
  `bun run dev:kill` stops this repo's dev processes only (matched by working directory; another project on the
  same port is reported, never killed); `--dry-run` lists them.
- `.env.test` and `.env.example` are committed; `.env.local` never is.

## Pull requests and code review

The base rules' "Pull requests and code review" is how every change lands. Here, the checks a pull request waits for
are CI's (`ci.yml`: `plan / plan` and `checks / Lint`, `Typecheck`, `Test`), the Base rules check and Claude's
review (`Code review / review`), which `master`'s rulesets (applied from `raine-works/agents`) require with an
approval and every thread resolved.
