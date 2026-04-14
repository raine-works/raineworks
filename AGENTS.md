# AGENTS.md

This document describes the **RaineWorks** monorepo — its architecture, project structure, conventions, and rules that every contributor (human or AI agent) must follow. Treat this file as the authoritative reference for how to work in this codebase.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Package Dependency Graph](#package-dependency-graph)
- [Package Details](#package-details)
  - [`@raineworks/tools`](#raineworkstools)
  - [`@raineworks/database`](#raineworksdatabase)
  - [`@raineworks/server`](#raineworksserver)
  - [`@raineworks/api`](#raineworksapi)
  - [`@raineworks/ui`](#raineworksui)
  - [`@raineworks/web`](#raineworksweb)
  - [`@raineworks/tsconfig`](#raineworkstsconfig)
- [Development Rules](#development-rules)
  - [Dependency Management](#dependency-management)
  - [UI Components](#ui-components)
  - [Database Operations](#database-operations)
  - [Temporal API Usage](#temporal-api-usage)
  - [Prototypes](#prototypes)
  - [Error Handling with tryCatch](#error-handling-with-trycatch)
  - [Documentation](#documentation)
  - [Code Style & Formatting](#code-style--formatting)
  - [TypeScript Configuration](#typescript-configuration)
  - [Import Aliases](#import-aliases)
  - [Server Architecture](#server-architecture)
- [Scripts & Commands](#scripts--commands)
- [Environment Variables](#environment-variables)
- [Infrastructure](#infrastructure)

---

## Overview

RaineWorks is a full-stack TypeScript monorepo powered by **Bun**, **Turborepo**, and **Prisma**. It serves a single React frontend from the same Bun HTTP server that exposes the oRPC API.

The monorepo is organised under `packages/` with shared libraries (`tools`, `database`, `ui`, `api`, `tsconfig`) and deployable applications (`server`, `web`).

---

## Tech Stack

| Layer          | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| Runtime        | Bun 1.3.12                                                     |
| Monorepo       | Turborepo with Bun workspaces                                 |
| Language       | TypeScript 6.0.2 (strict mode)                                |
| Backend        | Bun HTTP server, oRPC (contract-first), Pino logging          |
| Database       | PostgreSQL 18.1, Prisma 7.3 (with `@prisma/adapter-pg`)      |
| Frontend       | React 19.2, Vite 7.3, React Router 7, TanStack Query 5       |
| UI             | shadcn/ui (base-vega style), Tailwind CSS 4.1, Lucide icons   |
| Auth           | JWT (jose), OTP, OIDC (GitHub), WebAuthn passkeys              |
| Linting        | Biome 2.3 (formatting + linting)                               |
| Validation     | Zod 4.1                                                        |
| Date/Time      | Temporal API via `temporal-polyfill`                            |
| Docker         | Docker Compose for local PostgreSQL                             |

---

## Monorepo Structure

```
mystack/
├── AGENTS.md                    # This file — project rules and structure
├── package.json                 # Root workspace config with dependency catalog
├── turbo.json                   # Turborepo task pipeline
├── biome.json                   # Biome linter + formatter configuration
├── tsconfig.json                # Root TypeScript config (extends @raineworks/tsconfig)
├── bun.lock                     # Bun lockfile
├── .bun-version                 # Pinned Bun version
├── docker/
│   ├── Dockerfile.dev           # Custom postgres image with pg_cron built from source
│   └── docker-compose.dev.yaml  # Docker Compose for local PostgreSQL
└── packages/
    ├── tools/                   # Shared utilities (tryCatch, Temporal, prototypes)
    ├── database/                # Prisma schema, client, actor transactions, listener
    ├── server/                  # Bun HTTP server, oRPC routes, data layer, auth
    ├── api/                     # Client-side oRPC client factory, TanStack Query utils
    ├── ui/                      # Shared React component library (shadcn/ui)
   ├── web/                     # Website frontend (Vite + React)
    └── tsconfig/                # Shared TypeScript configurations
```

---

## Package Dependency Graph

```
tsconfig ─────────────────────────────────────────────────────┐
                                                              │
tools ────────────────────────────────────────┐               │
  │                                           │               │
database ──────────┐                          │               │
  │                │                          │               │
server ────────────┤                          │               │
  │ (type-only)    │                          │               │
api ───────────────┤                          │               │
  │                │                          │               │
ui ────────────────┤                          │               │
  │                │                          │               │
web ───────────────┘                          │               │
```

- `tools` → standalone (depends on `temporal-polyfill`)
- `database` → depends on `tools`
- `server` → depends on `database`, `tools`
- `api` → depends on `tools`, type-only dependency on `server` (for `Router` type)
- `ui` → depends on `tools`
- `web` → depends on `api`, `ui`, `tools`

---

## Package Details

### `@raineworks/tools`

**Purpose:** Shared, framework-agnostic utility library used across all packages.

**Location:** `packages/tools/`

**Exports (subpath):**
- `@raineworks/tools/try-catch` — `tryCatch()` error-handling primitive
- `@raineworks/tools/temporal` — Prisma ↔ Temporal conversion utilities (`toInstant`, `toDate`, `toISO`, `toISOOrNull`)
- `@raineworks/tools/temporal-polyfill` — Side-effect import that installs the Temporal API globally
- `@raineworks/tools/prototypes` — Side-effect import that extends Array, Set, Map, Number, String, and Object prototypes with convenience methods

**Key files:**
| File                    | Description                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `src/try-catch.ts`      | `tryCatch()` — wraps sync functions, Promises, and AsyncIterables into `{ data, error }` discriminated unions |
| `src/temporal.ts`       | `toInstant()`, `toDate()`, `toISO()`, `toISOOrNull()` for Prisma Date ↔ Temporal.Instant conversion |
| `src/temporal-polyfill.ts` | Re-exports `temporal-polyfill/global` to install the Temporal API on `globalThis` |
| `src/prototypes.ts`     | Extends `Array.prototype` with `isEmpty()` and `flush()`, extends `Set.prototype` and `Map.prototype` with `isEmpty()`, adds `exists` getter to Number, String, and Object prototypes |

---

### `@raineworks/database`

**Purpose:** Database schema, Prisma client, actor-tracked transactions, error utilities, and real-time LISTEN/NOTIFY listener.

**Location:** `packages/database/`

**Exports:**
- `@raineworks/database` — Singleton `db` client, `PrismaClient`, all generated types, `DatabaseListener`, error helpers, actor helpers
- `@raineworks/database/actor` — `withActor()`, `abortable()`, `TransactionAbortedError`
- `@raineworks/database/errors` — `isPrismaError()`, `uniqueViolation()`, `recordNotFound()`

**Key files:**
| File                  | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `src/index.ts`        | Singleton PrismaClient backed by `@prisma/adapter-pg` with `pg.Pool` |
| `src/actor.ts`        | `withActor()` — interactive transaction with `SET LOCAL app.current_user_id` for audit triggers; `abortable()` — cancellable transactions via `AbortSignal` |
| `src/errors.ts`       | Type-safe Prisma error extractors (P2002 unique violation, P2025 record not found) |
| `src/listener.ts`     | `DatabaseListener` class — LISTEN/NOTIFY subscriptions with auto-reconnect and exponential backoff |
| `prisma/schema.prisma`| Prisma schema defining all models (User, Post, Account, OtpCode, RefreshToken, Passkey, OAuth*, etc.) |
| `prisma.config.ts`    | Prisma 7 config — connection URL from `DATABASE_URL` env var |
| `scripts/triggers.sql` | NOTIFY triggers, audit triggers, purge function, pg_cron job |
| `scripts/apply-triggers.ts` | Script to apply triggers, audit infra, and cron jobs to the database |

**Connection architecture:**

| Consumer            | Connection type                   |
| ------------------- | --------------------------------- |
| Prisma Client       | `pg.Pool` (pooled, via PrismaPg)  |
| DatabaseListener    | `pg.Client` (dedicated, long-lived)|
| Prisma CLI          | Direct (via prisma.config.ts)      |
| Trigger setup       | `pg.Client` (one-shot)             |

**Table classification:**

Tables are classified as **persistent** or **ephemeral**. This classification determines which tables receive NOTIFY triggers, audit (history/trash) triggers, and cron-based cleanup.

| Classification | Tables | NOTIFY | Audit (history/trash) | Cron purge |
| -------------- | ------ | ------ | --------------------- | ---------- |
| **Persistent** | `User`, `Post`, `Account`, `Passkey`, `OAuthClient`, `OAuthScope`, `OAuthConsent` | ✅ | ✅ | — |
| **Ephemeral**  | `OtpCode`, `RefreshToken`, `PasskeyChallenge`, `OAuthAuthorizationCode`, `OAuthAccessToken`, `OAuthRefreshToken` | ❌ | ❌ | ✅ |

- **Persistent** tables represent long-lived domain entities. They receive NOTIFY triggers (cross-instance change awareness via `DatabaseListener`) and audit triggers (`audit.change_log` on UPDATE, `audit.deleted_records` on DELETE).
- **Ephemeral** tables store short-lived, single-use artefacts with an `expiresAt` column (tokens, challenges, OTP codes). They do **not** receive NOTIFY or audit triggers — tracking their changes would generate noise and bloat the audit tables. Instead, a daily pg_cron job purges expired rows.

**Trigger & cron infrastructure (`scripts/triggers.sql`):**

| Section | What it does |
| ------- | ------------ |
| `notify_table_change()` | PL/pgSQL function that fires `pg_notify` on INSERT/UPDATE/DELETE with a JSON payload |
| `attach_notify_trigger()` | Helper to attach NOTIFY to a persistent table |
| `detach_notify_trigger()` | Helper to remove NOTIFY from an ephemeral table (cleanup) |
| `resolve_actor()` | Returns the authenticated user's CUID (from `SET LOCAL app.current_user_id`) or falls back to `session_user` |
| `track_row_changes()` | AFTER UPDATE trigger — records column-level diffs into `audit.change_log` |
| `trash_deleted_row()` | BEFORE DELETE trigger — snapshots the full row into `audit.deleted_records` |
| `purge_expired_ephemeral_records()` | Deletes all rows past their `expiresAt` from every ephemeral table; returns a summary of `(table_name, rows_deleted)` |
| pg_cron job `purge-expired-ephemeral-records` | Runs `purge_expired_ephemeral_records()` daily at 03:00 UTC; gracefully skipped if pg_cron is not available |

**Purge function — manual invocation:**

If pg_cron is not available, you can call the purge function manually at any time:

```sql
SELECT * FROM purge_expired_ephemeral_records();
```

---

### `@raineworks/server`

**Purpose:** Bun HTTP server exposing oRPC API routes, static frontend serving, authentication, and real-time database listening.

**Location:** `packages/server/`

**Architecture:**

| Path                | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `/api/*`            | oRPC procedure calls (OpenAPI-compatible)|
| `/api/openapi.json` | OpenAPI 3.x specification                |
| `/api/contract.json`| oRPC contract router (for client factory)|
| `/healthz`          | Liveness / readiness probe               |
| `/*`                | Static website frontend (SPA)            |

**Directory structure:**
| Directory      | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| `src/data/`    | **Data layer** — pure database operations per model. Every function accepts a `db` parameter (Prisma client or transaction client). Mutations use `withActor()` for audit attribution. |
| `src/routes/`  | **Route layer** — oRPC route definitions chained from `publicProcedure` or `authedProcedure`. Maps HTTP endpoints to data layer functions. Handles error mapping (Prisma errors → ORPCError). |
| `src/lib/`     | **Shared library** — middleware, auth, env, logger, JWT, oRPC base config, schemas, shutdown, static serving. |

**Middleware stack (applied in order):**
1. `databaseMiddleware` — injects `db` and `listener` into context
2. `requestMiddleware` — generates request ID, creates child Pino logger, logs request/response with timing
3. `authMiddleware` — verifies JWT access token, injects `user` and `jwtPayload` (nullable)
4. `actorMiddleware` — injects `actorId`, pre-bound `withActor()` and `abortable()` helpers

**Data layer files:**
| File               | Description                         |
| ------------------ | ----------------------------------- |
| `src/data/users.ts`    | User CRUD operations            |
| `src/data/posts.ts`    | Post CRUD operations            |
| `src/data/accounts.ts` | Linked OIDC account operations  |
| `src/data/otp.ts`      | OTP code generation/verification|
| `src/data/tokens.ts`   | Refresh token management        |
| `src/data/passkeys.ts` | WebAuthn passkey operations     |

**Route files:**
| File                  | Description                       |
| --------------------- | --------------------------------- |
| `src/routes/auth.ts`  | OTP, OIDC, passkey, session, refresh, logout |
| `src/routes/users.ts` | User CRUD endpoints               |
| `src/routes/posts.ts` | Post CRUD endpoints               |

**Schemas:**
All Zod schemas for input validation and output serialisation are defined in `src/lib/schemas.ts` with these naming conventions:

| Suffix     | Purpose                                      |
| ---------- | -------------------------------------------- |
| `Schema`   | Full model shape (used for outputs / selects) |
| `Input`    | Create/update payloads from the client        |
| `Params`   | Path/query parameters (IDs, filters, etc.)    |

---

### `@raineworks/api`

**Purpose:** Client-side API layer providing a fully-typed oRPC client, TanStack Query integration, and token storage.

**Location:** `packages/api/`

**Exports:**
- `@raineworks/api` — `createApiClient()` factory
- `@raineworks/api/router` — Re-exports `Router` type from server (type-only bridge)
- `@raineworks/api/storage` — Async wrapper around `localStorage` / `sessionStorage`
- `@raineworks/api/query-provider` — `QueryProvider` React component with shared defaults
- `@raineworks/api/tanstack-query` — Re-exports `createTanstackQueryUtils` from `@orpc/tanstack-query`

**Client features:**
- Automatic JWT authorization header
- Transparent token refresh on 401
- 15-second request timeout with `AbortSignal`
- Contract router cached in `sessionStorage`

**Usage in frontend zones:**
```ts
// packages/web/src/lib/api.ts
import { createApiClient } from '@raineworks/api';
import type { Router } from '@raineworks/api/router';
import { createTanstackQueryUtils } from '@raineworks/api/tanstack-query';

export const api = await createApiClient<Router>(location.origin);
export const orpc = createTanstackQueryUtils(api);
```

---

### `@raineworks/ui`

**Purpose:** Shared React component library built on shadcn/ui (base-vega style) with Tailwind CSS, Lucide icons, and Base UI primitives.

**Location:** `packages/ui/`

**Exports (subpath):**
- `@raineworks/ui` — barrel re-exports of `cn()`, providers (`ThemeProvider`, `LogoProvider`, `Head`)
- `@raineworks/ui/components/ui/*` — Individual UI primitives (button, card, dialog, table, etc.)
- `@raineworks/ui/components/blocks/*` — Composed block components (brand-logo, not-found, theme-picker)
- `@raineworks/ui/providers/*` — Context providers (theme, head/favicon, logo)
- `@raineworks/ui/hooks/*` — Shared hooks (use-mobile)
- `@raineworks/ui/lib/*` — Utilities (`cn()` class-name merging)
- `@raineworks/ui/styles/*` — CSS files (theme.css)

**Available UI components:**
`accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `button-group`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `combobox`, `command`, `context-menu`, `dialog`, `direction`, `drawer`, `dropdown-menu`, `empty`, `field`, `hover-card`, `input`, `input-group`, `input-otp`, `item`, `kbd`, `label`, `menubar`, `native-select`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`

**Block components:**
`brand-logo`, `not-found`, `theme-picker`

**shadcn/ui configuration (`components.json`):**
- Style: `base-vega`
- RSC: `false`
- Icon library: `lucide`
- Path aliases: `@ui/components`, `@ui/lib/utils`, `@ui/hooks`

---

### `@raineworks/web`

**Purpose:** The main website frontend served at `/`. Handles root layout, primary routes, and acts as the catch-all for unmatched URLs.

**Location:** `packages/web/`

**Key files:**
| File                       | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `src/main.tsx`             | Entry point — mounts React root with providers   |
| `src/app.tsx`              | Root routes with `BrowserRouter`                 |
| `src/lib/api.ts`           | Singleton API client and TanStack Query utils    |
| `src/components/layout.tsx` | Shell layout with `<Outlet />`                  |
| `src/routes/home.tsx`      | Home page route                                  |
| `vite.config.ts`           | Vite config with React compiler, Tailwind, proxy |
| `microfrontends.json`      | Turborepo local proxy configuration              |

**Entry point initialisation order:**
1. Import `@raineworks/tools/prototypes` (extends Array prototype)
2. Import `@raineworks/tools/temporal-polyfill` (installs Temporal globally)
3. Import global CSS
4. Mount React root with `ThemeProvider` → `QueryProvider` → `App` → `Toaster`

---

### `@raineworks/tsconfig`

**Purpose:** Shared TypeScript configurations extended by all packages.

**Location:** `packages/tsconfig/`

**Configurations:**
| File                 | Used by                          | Description                                |
| -------------------- | -------------------------------- | ------------------------------------------ |
| `base.json`          | tools, database, server          | Strict, ESNext, bundler resolution, bun-types |
| `react-library.json` | ui                               | Extends base + DOM libs, JSX, isolatedModules |
| `react-app.json`     | web                              | Extends react-library, relaxed unused locals  |

---

## Development Rules

### Dependency Management

> **CRITICAL: All dependencies MUST be defined in the `catalog` section of the root `package.json`.**

1. **Always use the catalog.** When adding a new dependency, add it to the `workspaces.catalog` object in the **root** `package.json` with a pinned version. In the consuming package's `package.json`, reference it with `"catalog:"`.

   ```jsonc
   // Root package.json → workspaces.catalog
   {
     "some-package": "3.2.1"
   }

   // packages/server/package.json → dependencies
   {
     "some-package": "catalog:"
   }
   ```

2. **Always pin exact versions.** Never use `^`, `~`, or ranges in the catalog. Every dependency version must be an exact pinned version (e.g. `"3.2.1"`, not `"^3.2.1"`). The only exception is workspace packages which use `"workspace:*"`.

3. **Workspace dependencies** use `"workspace:*"` syntax:
   ```jsonc
   {
     "@raineworks/tools": "workspace:*"
   }
   ```

4. **Package manager:** Bun 1.3.12 — never use npm or yarn. Run `bun install` to install dependencies.

---

### UI Components

> **Always use the UI components from `@raineworks/ui` before creating new ones.**

1. **Check the UI package first.** Before building any UI element, check if a component already exists in `packages/ui/src/components/ui/` or `packages/ui/src/components/blocks/`. The library has 50+ components covering most common patterns.

2. **Import from subpaths, not the barrel:**
   ```tsx
   // ✅ Correct — tree-shakeable subpath import
   import { Button } from '@raineworks/ui/components/ui/button';
   import { Card, CardContent } from '@raineworks/ui/components/ui/card';

   // ❌ Wrong — barrel import
   import { Button } from '@raineworks/ui';
   ```

3. **Use `cn()` for class merging:**
   ```tsx
   import { cn } from '@raineworks/ui';
   // or
   import { cn } from '@raineworks/ui/lib/utils';
   ```

4. **Use the shared providers:**
   - `ThemeProvider` / `useTheme` for dark/light mode
   - `LogoProvider` / `useLogo` for brand logos
   - `Head` / `HeadContent` for document head management

5. **Use shared hooks:**
   - `useMobile` from `@raineworks/ui/hooks/use-mobile`

6. **New UI components** should be added to `packages/ui/src/components/ui/` (primitives) or `packages/ui/src/components/blocks/` (composed patterns) — not duplicated inside individual apps.

---

### Database Operations

> **Always use the `withActor` wrapper when performing database writes. Database operations MUST be defined in the data layer.**

1. **Data layer is in `packages/server/src/data/`.** All database queries and mutations MUST be defined here as pure functions that accept a `db` parameter (either the singleton client or a transaction client). Never put raw Prisma calls directly in route handlers.

   ```ts
   // ✅ Correct — data layer function
   // packages/server/src/data/posts.ts
   export async function findById(db: Db, id: string) {
     return db.post.findUnique({ where: { id } });
   }

   // ✅ Correct — route calls data layer
   // packages/server/src/routes/posts.ts
   const post = await postsData.findById(context.db, input.id);
   ```

2. **Use `withActor()` for all mutations.** Every write operation must be wrapped in `withActor()` to set the `app.current_user_id` PostgreSQL session variable for audit triggers. This applies in BOTH the data layer and route handlers:

   ```ts
   // Data layer — withActor wraps the mutation
   export async function create(db: Db, actorId: string | null, data: CreatePostData) {
     return withActor(db, actorId, async (tx) => {
       return tx.post.create({ data: { ... } });
     });
   }
   ```

3. **In route handlers, use `context.withActor()`.** The `actorMiddleware` provides a pre-bound `withActor` on the context:

   ```ts
   // Route handler — using context.withActor
   const post = await context.withActor(async (tx) => {
     return postsData.create(tx, data);
   });
   ```

4. **`withActor` is nestable.** If `db` is already a transaction client, `withActor` passes through without creating a new transaction. Data layer functions can unconditionally use `withActor` without worrying about composition.

5. **Use `context.abortable()` for cancellable reads.** For long-running read operations that should be cancellable:

   ```ts
   const controller = new AbortController();
   const stats = await context.abortable(controller.signal, async (tx) => {
     return tx.user.count();
   });
   ```

6. **Never add audit or NOTIFY triggers to ephemeral tables.** Tables classified as ephemeral (`OtpCode`, `RefreshToken`, `PasskeyChallenge`, `OAuthAuthorizationCode`, `OAuthAccessToken`, `OAuthRefreshToken`) must not receive history, trash, or NOTIFY triggers. If you add a new model with an `expiresAt` column, it is ephemeral — add it to the `purge_expired_ephemeral_records()` function in `scripts/triggers.sql` instead.

7. **Use error utilities from `@raineworks/database/errors`** to handle Prisma errors in routes:

   ```ts
   import { uniqueViolation, recordNotFound } from '@raineworks/database/errors';

   try {
     return await postsData.create(db, actorId, data);
   } catch (error) {
     const violation = uniqueViolation(error);
     if (violation) throw new ORPCError('CONFLICT', { message: '...' });
     if (recordNotFound(error)) throw new ORPCError('NOT_FOUND', { message: '...' });
     throw error;
   }
   ```

8. **Type `db` as `PrismaClient`.** The type alias `Db = PrismaClient` is used throughout. Prisma's interactive transaction client is structurally compatible.

---

### Temporal API Usage

> **Always use the Temporal API imported from `@raineworks/tools`. Never use native `Date` for date/time logic in application code.**

1. **Import the polyfill at entry points.** Every application entry point (`main.tsx`, `index.ts`) must import the polyfill as its first side-effect import:

   ```ts
   import '@raineworks/tools/temporal-polyfill';
   ```

2. **Use Temporal utilities from the tools package** for Prisma Date ↔ Temporal conversion:

   ```ts
   import { toInstant, toDate, toISO, toISOOrNull } from '@raineworks/tools/temporal';

   // Prisma Date → Temporal.Instant
   const instant = toInstant(user.createdAt);

   // Temporal.Instant → Prisma Date (for writes)
   const date = toDate(Temporal.Now.instant());

   // Prisma Date → ISO-8601 string (for API responses)
   const iso = toISO(post.publishedAt);
   const isoOrNull = toISOOrNull(post.publishedAt); // handles null
   ```

3. **Use `Temporal.Now.instant()`** instead of `new Date()` for timestamps in application logic. In data layer code where Prisma requires a `Date`, use the `toDate()` converter.

---

### Prototypes

> **Always use the prototypes defined in `@raineworks/tools` and import them at entry points.**

1. **Import prototypes at entry points:**

   ```ts
   import '@raineworks/tools/prototypes';
   ```

2. **Available prototype extensions:**

   **Array extensions (methods):**
   - `Array.prototype.isEmpty()` — returns `true` when the array has no elements
   - `Array.prototype.flush()` — removes all elements in place by setting `length` to 0

   ```ts
   const items = [1, 2, 3];
   items.isEmpty(); // false
   items.flush();   // items is now []
   items.isEmpty(); // true
   ```

   **Collection extensions (methods):**
   - `Set.prototype.isEmpty()` — returns `true` when the set has no elements
   - `Map.prototype.isEmpty()` — returns `true` when the map has no entries

   ```ts
   const set = new Set();
   set.isEmpty(); // true
   set.add(1);
   set.isEmpty(); // false
   
   const map = new Map();
   map.isEmpty(); // true
   map.set('key', 'value');
   map.isEmpty(); // false
   ```

   **Primitive type extensions (getters):**
   - `Number.prototype.exists` — returns `true` when the value is not `NaN`
   - `String.prototype.exists` — returns `true` when the string is not empty
   - `Object.prototype.exists` — returns `true` when the object has own properties

   ```ts
   const num = NaN;
   num.exists; // false
   
   const str = '';
   str.exists; // false
   
   const obj = {};
   obj.exists; // false
   
   const validNum = 42;
   validNum.exists; // true
   
   const text = 'hello';
   text.exists; // true
   
   const record = { a: 1 };
   record.exists; // true
   ```

3. **All extensions are fully typed** in the global TypeScript namespace, so they work with IntelliSense and type checking.

---

### Error Handling with tryCatch

> **Always use the `tryCatch` function from `@raineworks/tools/try-catch` instead of bare try/catch blocks wherever practical.**

1. **Import from tools:**

   ```ts
   import { tryCatch } from '@raineworks/tools/try-catch';
   ```

2. **Use for async operations:**

   ```ts
   const { data, error } = await tryCatch(fetchUser(id));
   if (error) return handleError(error);
   console.log(data.name);
   ```

3. **Use for sync operations:**

   ```ts
   const { data, error } = tryCatch(() => JSON.parse(raw));
   if (error) return handleParseError(error);
   ```

4. **Use for async iterables (streaming):**

   ```ts
   for await (const { data, error } of tryCatch(stream)) {
     if (error) break;
     process(data);
   }
   ```

5. **Custom error types** can be specified via generics:

   ```ts
   const { data, error } = await tryCatch<User, ApiError>(fetchUser(id));
   if (error) {
     console.log(error.status); // fully typed as ApiError
   }
   ```

6. **Traditional try/catch is acceptable** in data layer functions that need to re-throw or when `tryCatch` would reduce clarity (e.g. multiple sequential operations with different error handling). But prefer `tryCatch` as the default.

---

### Documentation

> **Always update the README and AGENTS.md when making changes to the project.**

1. **When you add a new package, feature, route, component, or change architecture**, update this `AGENTS.md` file to reflect the change.

2. **When you add or modify README files** in any package, keep them consistent with the actual code.

3. **Every source file should have a JSDoc module comment** at the top explaining its purpose, as established throughout the codebase:

   ```ts
   /**
    * Brief description of what this module does.
    *
    * @module module-name
    */
   ```

4. **Every exported function, class, and type should have JSDoc comments** with `@example` blocks where useful.

---

### Code Style & Formatting

The project uses **Biome** for both formatting and linting. Configuration is in the root `biome.json`.

**Formatting rules:**
- Indent style: **tabs**
- Quote style: **single quotes** (JSX uses double quotes)
- Semicolons: **always**
- Trailing commas: **none**
- Arrow parens: **always**
- Bracket spacing: **true**
- Line width: **120**

**Linting rules:**
- Recommended rules enabled
- Notable disabled rules: `useExhaustiveDependencies`, `noChildrenProp`, `noBannedTypes`, `noArrayIndexKey`, `noDangerouslySetInnerHtml`, some a11y rules

**Run formatting:**
```sh
bun run format
```

**Run linting:**
```sh
bun run lint
```

---

### TypeScript Configuration

1. **Strict mode is always on.** All packages extend from `@raineworks/tsconfig/base.json` which enables `"strict": true`.

2. **Module system:** ESNext modules with bundler resolution.

3. **Path aliases** are configured per package via `tsconfig.json` `paths`:

   | Alias          | Resolves to                    | Used in            |
   | -------------- | ------------------------------ | ------------------ |
   | `@tools/*`     | `packages/tools/src/*`         | tools, database, server |
   | `@database/*`  | `packages/database/src/*`      | database, server, web |
   | `@server/*`    | `packages/server/src/*`        | server, web        |
   | `@api/*`       | `packages/api/src/*`           | api, web           |
   | `@ui/*`        | `packages/ui/src/*`            | ui, web            |
   | `@web/*`       | `packages/web/src/*`           | web                |

---

### Import Aliases

When importing across workspace packages, use the `@raineworks/*` package names. Within a package, use the `@alias/*` path aliases.

```ts
// ✅ Cross-package import (from web → ui)
import { Button } from '@raineworks/ui/components/ui/button';

// ✅ Within-package import (inside server)
import { log } from '@server/lib/logger';
import * as postsData from '@server/data/posts';

// ✅ Within-package import (inside database)
import { tryCatch } from '@raineworks/tools/try-catch';
import type { PrismaClient } from '@database/generated/prisma/client';
```

---

### Server Architecture

1. **Entry point imports.** The server entry point (`packages/server/src/index.ts`) imports prototypes and temporal polyfill first:

   ```ts
   import '@raineworks/tools/prototypes';
   import '@raineworks/tools/temporal-polyfill';
   ```

2. **oRPC procedures.** Routes use `publicProcedure` (no auth) or `authedProcedure` (JWT required):

   ```ts
   import { publicProcedure, authedProcedure } from '@server/lib/orpc';
   ```

3. **Route structure.** Each route file exports a router object:

   ```ts
   export const postRouter = { list, getById, create, update, remove };
   ```

4. **Environment variables.** Always access via the validated `env` object from `@server/lib/env`:

   ```ts
   import { env } from '@server/lib/env';
   // env.DATABASE_URL, env.JWT_SECRET, etc.
   ```
   Never access `process.env` or `Bun.env` directly in server code.

5. **Logging.** Use the Pino logger from `@server/lib/logger`:

   ```ts
   import { log } from '@server/lib/logger';
   const moduleLog = log.child({ module: 'my-module' });
   ```
   In route handlers, use `context.log` (the request-scoped child logger).

6. **Frontend assets.** The web build is served statically. The server discovers it from `STATIC_DIR/web` (production) or `packages/web/dist` (development).

---

## Scripts & Commands

**Root-level scripts:**

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `bun run dev`       | Start all packages in development mode            |
| `bun run build`     | Build all packages                                |
| `bun run lint`      | Lint all packages                                 |
| `bun run typecheck` | Type-check all packages                           |
| `bun run format`    | Format all files with Biome                       |
| `bun run db:start`  | Start local PostgreSQL via Docker Compose          |
| `bun run db:dev`    | Run Prisma migrations + apply triggers (dev)      |
| `bun run db:deploy` | Run Prisma migrations + apply triggers (production)|
| `bun run clean`     | Remove all `node_modules` directories             |

**⚠️ CRITICAL: Always run these commands before committing:**

```bash
bun run typecheck  # Must pass with no errors
bun run lint       # Must pass with no errors
bun run build      # Must complete successfully
```

These checks are **mandatory** for all code changes. Do not skip them.

**Database scripts (from `packages/database/`):**

| Command                  | Description                          |
| ------------------------ | ------------------------------------ |
| `bunx --bun prisma generate` | Generate Prisma client           |
| `bunx --bun prisma migrate dev` | Create + apply a new migration |
| `bunx --bun prisma migrate deploy` | Apply pending migrations    |
| `bun run scripts/apply-triggers.ts` | Apply SQL triggers          |

---

## Environment Variables

Required environment variables (validated by Zod in `packages/server/src/lib/env.ts`):

| Variable              | Required | Description                                |
| --------------------- | -------- | ------------------------------------------ |
| `DATABASE_URL`        | Yes      | PostgreSQL connection string               |
| `JWT_SECRET`          | Yes      | HMAC-SHA256 secret for JWTs (min 32 chars) |
| `NODE_ENV`            | No       | `development` / `production` / `test`      |
| `LOG_LEVEL`           | No       | Pino log level (default: `debug` in dev)   |
| `STATIC_DIR`          | No       | Root dir for built frontend assets         |
| `GITHUB_CLIENT_ID`    | No       | GitHub OAuth client ID                     |
| `GITHUB_CLIENT_SECRET`| No       | GitHub OAuth client secret                 |
| `RP_ID`               | No       | WebAuthn Relying Party ID (default: `localhost`) |
| `RP_NAME`             | No       | WebAuthn Relying Party name (default: `RaineWorks`) |
| `RP_ORIGIN`           | No       | WebAuthn origin URL (default: `http://localhost:3000`) |

**Turbo global env vars** (from `turbo.json`): `DATABASE_URL`, `HOME`, `LOG_LEVEL`, `NODE_ENV`, `TZ`

---

## Infrastructure

**Local development PostgreSQL:**

```sh
bun run db:start   # Builds the custom image (if needed) and starts PostgreSQL via Docker Compose
```

The standard `postgres:18.1` image does **not** ship the `pg_cron` extension. The dev setup uses a custom Dockerfile (`docker/Dockerfile.dev`) that extends the official image and builds pg_cron from source so the daily ephemeral-record purge job can be registered inside the database.

**Docker files:**

| File                  | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `docker/Dockerfile.dev` | Extends `postgres:18.1`, installs build tools, clones and compiles pg_cron from GitHub, then removes build dependencies to keep the image lean |
| `docker/docker-compose.dev.yaml`     | Compose service that builds from `Dockerfile.dev`, configures PostgreSQL, and mounts a persistent volume |

**Configuration (`docker/docker-compose.dev.yaml`):**
- Image: built from `docker/Dockerfile.dev` (base `postgres:18.1` + pg_cron)
- User: `dev_user`
- Password: `dev_password`
- Database: `dev_db`
- Port: `5432`
- Timezone: `UTC`
- Network bound to `127.0.0.1` only
- `shared_preload_libraries`: `pg_cron` (loads the pg_cron background worker at server start)
- `cron.database_name`: `dev_db` (pg_cron stores its metadata and runs jobs in the application database)

> **Troubleshooting:** If the database container fails to start after switching images or changing the Dockerfile, the existing volume may contain a stale data directory. Destroy the volume and recreate:
> ```sh
> docker compose -f ./docker/docker-compose.dev.yaml down -v
> bun run db:start
> ```

**Ephemeral record cleanup:**

Expired rows in ephemeral tables are purged automatically by a pg_cron job that runs daily at 03:00 UTC. The job calls `purge_expired_ephemeral_records()`, which deletes all rows past their `expiresAt` from: `OtpCode`, `RefreshToken`, `PasskeyChallenge`, `OAuthAuthorizationCode`, `OAuthAccessToken`, `OAuthRefreshToken`.

If pg_cron is unavailable in your environment, the purge function still exists and can be called manually or from an application-level scheduler.

**Frontend proxy:**

Turborepo's local proxy runs on port `3024` and routes requests to `@raineworks/web` (port `3100`).

In development, `vite.config.ts` proxies `/api` requests to `http://localhost:3000` (the Bun server).

---

## Rules Summary (Quick Reference)

1. ✅ **Catalog dependencies** — always add to root `package.json` `workspaces.catalog` with exact pinned versions
2. ✅ **UI components** — always check and use `@raineworks/ui` before creating new components
3. ✅ **`withActor` wrapper** — always use when performing database writes for audit attribution
4. ✅ **Data layer** — always define database operations in `packages/server/src/data/`
5. ✅ **Temporal API** — always import from `@raineworks/tools/temporal` and `@raineworks/tools/temporal-polyfill`
6. ✅ **Prototypes** — always import `@raineworks/tools/prototypes` at entry points, use the extensions
7. ✅ **`tryCatch`** — always prefer `tryCatch()` from `@raineworks/tools/try-catch` over bare try/catch
8. ✅ **Documentation** — always update README and AGENTS.md when making changes
9. ✅ **Biome** — always follow the project's formatting and linting rules
10. ✅ **Env vars** — always access through the validated `env` object, never `process.env` directly
11. ✅ **Ephemeral tables** — never add NOTIFY or audit triggers to ephemeral tables; add new ephemeral models to the purge function in `triggers.sql` instead
12. ✅ **ALWAYS TEST** — run `bun run typecheck`, `bun run lint`, and `bun run build` before considering any work complete
