# raineworks style guide

How code in this repo should read. `bun fmt` formats (`bun run format`; `bun run lint` checks it) and `bun check`
type checks and reports what's unused (`bun run typecheck`). This guide
covers the things a formatter can't. When in doubt, match the surrounding file.

---

## Formatting (`bun fmt`)

- Tabs for indentation, single quotes (double quotes in JSX attributes), semicolons, trailing commas everywhere, 120-column lines.
- Always parenthesise arrow parameters: `(x) => x`.
- Imports are sorted and grouped by `bun fmt` (`sortImports`: built-ins, packages, then ours), and Tailwind classes
  put in Tailwind's order (`sortTailwindcss`, by our theme). Don't hand-order either.
- Unused imports, variables and function parameters are **errors** (`bun check`: `noUnusedLocals`,
  `noUnusedParameters`). Delete them rather than prefixing with `_`.
- Keep something as written with `// prettier-ignore` (the formatter's own comment), only with a reason beside it.
  Never suppress a type error: fix it (`@ts-expect-error` only in a test proving something doesn't type check).

## Imports & modules

- **No relative imports**, in any file. Use the package alias, even inside the same package:

  ```ts
  import { env } from '@raineworks/server/lib/env';            // ✓
  import { env } from '../lib/env';                      // ✗
  ```

  Each package maps `@raineworks/<pkg>/*` → `./src/*` in its `tsconfig.json` and exposes the same paths through `package.json` `exports`.
- Cross-package imports go through the target package's public entry or its exported paths (`@raineworks/api`, `@raineworks/ui/blocks/page`, …).
  Don't reach into another package's internals.
- Use `import type` for type-only imports.
- ESM only (`"type": "module"`). Use `node:` specifiers for Node built-ins (`node:crypto`, `node:path`).
- Side-effect import `@raineworks/tools/prototypes` in every module that uses the prototype extensions (entry points
  and scripts included), so it works however it's loaded; the root workspace has `@raineworks/tools` for its own scripts.

## TypeScript

- `strict` is on. Don't use `any`. Use `unknown` and narrow it. If `any` is truly unavoidable (e.g. test assertions on arbitrary JSON), say why in a comment beside it.
- Model closed sets as `as const` tuples with a derived union, and reuse the tuple for Zod:

  ```ts
  export const TASK_STATUSES = ['pending', 'processing', 'failed'] as const;
  export type TaskStatus = (typeof TASK_STATUSES)[number];
  ```

- Prefer discriminated unions (`kind: 'ping' | 'export'`) over optional-field soup, and narrow with `switch`.
- `undefined` means "not provided / leave unchanged"; `null` means "explicitly empty / clear it". Update inputs depend on this distinction.
- Custom errors extend `Error` and set `override readonly name = 'XxxError' as const`.
- Use `satisfies` to check literal shapes without widening (e.g. `satisfies ErrorBody`).

## Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Files | kebab-case | `rate-limit.ts`, `queues-table.tsx` |
| Tests | next to the subject | `rate-limit.test.ts` |
| Functions, variables | camelCase, verb-first for actions | `recordActivity`, `enforceRateLimit` |
| Types, classes | PascalCase | `QueueHealth`, `TransactionAbortedError` |
| Module-level constants | SCREAMING_SNAKE | `ZONES`, `GRACE_MS` |
| Durations | a `Temporal.DurationLike` (`{ minutes: 5 }`); a number only where an API takes one, its unit suffixed | `ttl`, `window`; `pollIntervalMs`, `idleTimeout` (seconds, documented) |
| Hono routers | `<name>Router` | `buildRouter` |
| Error codes | snake_case strings | `invalid_request`, `rate_limited` |
| Log/cache/rate-limit keys | `namespace:subject` / dotted | `ratelimit:<namespace>:<subject>`, `widget.retire` |

## Comments & docs

- Every source file opens with a JSDoc block saying **what the module is for** and any invariant a caller must respect,
  ending in `@module <path>`. See `packages/server/src/lib/spa.ts`, `packages/tools/src/zones.ts`.
- Document exported functions with one-line JSDoc focused on *why* and *contract* (what `null` means, what throws, what's atomic),
  not a restatement of the signature.
- Inline comments explain non-obvious decisions ("Read before the handler runs: the clone tees the stream…"). Don't narrate the code.
- Security-relevant reasoning belongs in the code comment **and** in [docs/architecture.md](docs/architecture.md#security).

## Errors & results

- Catch with the Go-style `{ data, error }` helpers, never `try/catch`: `tryCatch(() => …)` (imported from
  `@raineworks/tools/prototypes`) for work you call, and `await promise.tryCatch()` for a promise you already have.
  `tryCatch` returns synchronous work's `Result` at once and async work's as a promise to `await`; its types say which.
  Rethrow what you don't handle: `if (error instanceof ParseError) return …; if (error) throw error;`.
  `try/finally` without a `catch` is fine.
- Fire-and-forget work must not produce unhandled rejections: `void work.tryCatch();`.
- API errors are `{ error: { code, message } }` with a snake_case `code` and a user-facing sentence for `message`.

## raineworks tools

`@raineworks/tools` is the shared toolbox. Use it whenever it covers the job, and extend it (with a test in `packages/tools`) when it
almost does. Don't hand-roll a parallel helper in another package.

| Module | Use for | Instead of |
| --- | --- | --- |
| `prototypes` | `promise.tryCatch()`, `tryCatch(() => …)` → `{ data, error }` | `try/catch` blocks |
| | `array.isEmpty()`, `array.unique(by?)`, `array.flush()` | `length === 0`, `[...new Set(a)]`, `a.length = 0` |
| | `string.isEmpty()` (`value.trim().isEmpty()` for blank), `set.isEmpty()`, `map.isEmpty()` | `value.length === 0`, `value === ''`, `.size === 0` |
| `env` | `baseEnvSchema`, `loadEnvFiles`, `parseEnv` | reading `process.env` / `Bun.env` directly |
| `build-env` | `buildEnv()`: what build-time tools (`build`, `version`) read, before any service's env exists | reading `Bun.env` in a build script |
| `zones` | `ZONES`, `zoneHref`, `resolveZone`, `zonePublicPath`, `safeRedirectPath` | hard-coded zone paths, unchecked redirects |
| `text` | `plural(n, word, plural?)`: "1 item", "3 items" | `n === 1 ? … : …` in copy |
| `markdown` | `markdownPlugin`, `renderDoc`, `splitFrontmatter`: the release notes rendered to HTML at build time | shipping a Markdown parser to the browser |
| `highlight` | `highlight(code, language)`: coloured, escaped code in rendered Markdown | loading all of highlight.js, escaping code by hand |
| `calver` | `isVersion`, `compareVersions`, `nextVersion`: `YEAR.MONTH.N` versions (pure, for pages) | comparing version strings by hand |
| `version` | `latestVersion`, `buildInfo`, `RELEASE_NOTES_DIR`: the version and commit being built (build-time only) | reading release notes or git in each build script |
| `notices` | `collectNotices`, `ALLOWED_LICENSES`, `LICENSE_OVERRIDES`: the packages a zone ships and their licences (`dist/notices.json`, build-time only); only permissive ones (and the fonts' OFL) build | listing dependencies or licences by hand |
| `release` | `upcomingVersion`, `releaseText`: `bun run release` (next version, notes, tags) | writing release text or tags by hand |
| `http`, `build`, `cli` | MIME types, compression, asset headers, `buildFrontend` (`Bun.build`), CLI colours | re-implementing them per package |

Fine as they are:
- `performance.now()` for measuring elapsed time.

## Tests

- `bun:test` (`describe` / `test` / `expect`). Name tests as behaviour statements: `test('a kind it has no handler for is dead-lettered at once, never retried')`.
- Test through the public surface: HTTP via `createApp().request(…)` for routes (`packages/server/src/app.test.ts`).

## Frontend

Design: [docs/frontend.md](docs/frontend.md).

- React 19 + React Compiler, Tailwind v4, shadcn/ui (via the shadcn MCP server or CLI, into `@raineworks/ui`), TanStack Router
  (code-based routes in each zone's `src/router.tsx`) and TanStack Query, built with `Bun.build` (`@raineworks/tools/build`).
- Talk to the server only through the shared client in `@raineworks/ui/lib/api` (`api`, `unwrap`). Never call `fetch` against `/api` directly.
- Reads are `queryOptions` factories; mutations are hooks that invalidate the keys they change. Show failures with `errorMessage(error)`.
- Reusable UI goes in `@raineworks/ui` (`components/` for shadcn primitives, `blocks/` for the app's compositions). Zone-only code stays in the zone.
- Zone code uses TanStack Router's typed `Link` / `useNavigate`.
- Use theme tokens (`bg-primary`, `text-muted-foreground`, `bg-brand`), never raw colours. Write canonical Tailwind classes.
- Don't import runtime values from `@raineworks/server` into a zone; `import type` only, so no server code is bundled.

### Rules of React (the React Compiler depends on them)

The compiler skips any component or hook that breaks these, silently, and `packages/tools/src/react-compiler.test.ts`
fails the build for it ([docs/frontend.md](docs/frontend.md#react-compiler)).

- No ref reads or writes during render: `ref.current` only in effects and event handlers. For a value made once, use a
  lazy `useState(() => make())` (or a module constant), not `useRef(null)` filled in on first render.
- A callback that must see the latest props or state but is used from an effect or a listener set up once is a
  `useEffectEvent`, never a ref updated during render (`latest.current = …`). Call it only from effects and what they
  set up (timers, DOM, map or editor listeners), never from render or JSX handlers.
- No manual `useMemo`, `useCallback` or `memo` in first-party code: the compiler memoizes. Keep one only where
  identity itself is the behaviour (a value a library compares by reference and the compiler can't see), and say why
  in a comment. Generated shadcn components keep theirs.
- Default parameter values are constants, not inline arrow functions: hoist `(x) => …` to a module constant.
- No computed keys in a destructuring rest (`const { [key]: _, ...rest } = obj`): filter `Object.entries` instead. No
  `??=` / `||=` on a ref: write the `if`.
- Put a hook whose results are used for their identity in a `.tsx` file: `.ts` modules aren't compiled.
