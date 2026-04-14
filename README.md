# RaineWorks

A personal website codebase built with Bun, Turborepo, Prisma, and React.

[![Bun](https://img.shields.io/badge/Bun-1.3.12-black?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.2-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.3-2D3748?logo=prisma)](https://www.prisma.io/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)

---

## ⚡️ Quick Start

```bash
# Install dependencies
bun install

# Start PostgreSQL (Docker)
bun run db:start
bun run db:dev

# Start all dev servers
bun run dev
```

Visit **http://localhost:3024** to see your app!

---

## 🚀 What's Included

This repo keeps a focused stack for a personal site with a custom backend, shared UI, and modern auth:

### Backend
- **⚡️ Bun 1.3.12** — Fast runtime, package manager, and HTTP server
- **🗄️ PostgreSQL 18.1 + Prisma 7.3** — Type-safe database with migrations
- **🔌 oRPC** — Contract-first APIs with auto-generated OpenAPI spec
- **📝 Audit Trail** — Automatic change tracking with actor attribution
- **🔔 Real-time** — LISTEN/NOTIFY for cross-instance awareness
- **⏰ Scheduled Jobs** — pg_cron for automatic cleanup

### Frontend
- **⚛️ React 19.2 + Vite 7.3** — Modern UI with React Compiler
- **🎨 shadcn/ui** — 50+ beautiful, accessible components
- **🎯 React Router 7** — Type-safe routing with loaders
- **📊 TanStack Query 5** — Powerful data fetching and caching
- **🌙 Dark Mode** — Built-in theme system
- **📱 Responsive** — Mobile-first design

### Developer Experience
- **📦 Turborepo** — Cached builds and parallel execution
- **🔒 TypeScript 6.0.2** — Strict mode, full type safety
- **✨ Biome** — Fast formatting and linting
- **🧪 Bun Test** — Built-in test runner
- **🔧 Path Aliases** — Clean imports across packages

### Authentication
- **🔐 JWT Tokens** — Access (15m) + refresh (30d) with rotation
- **📧 OTP** — Email-based passwordless authentication
- **🔑 OIDC** — GitHub social login
- **🔒 WebAuthn** — Hardware-backed passkeys
- **👤 Actor Tracking** — Know who made every change

---

## 📁 Project Structure

```
packages/
├── tools/        # Shared utilities (tryCatch, Temporal, prototypes)
├── tsconfig/     # Shared TypeScript configurations
├── database/     # Prisma schema, migrations, audit infrastructure
├── server/       # Bun HTTP server with oRPC API
├── api/          # Type-safe API client for frontend
├── ui/           # shadcn/ui component library
└── web/          # Main website frontend
```

---

## 🔧 Available Commands

### Development

```bash
bun run dev         # Start all packages in development mode
bun run build       # Build all packages for production
bun run typecheck   # Type-check all packages
bun run lint        # Lint all packages with Biome
bun run format      # Format all files with Biome
```

### Database

```bash
bun run db:start    # Start PostgreSQL via Docker Compose
bun run db:dev      # Run migrations + apply triggers (development)
bun run db:deploy   # Run migrations + apply triggers (production)
```

---

## 🏗️ Tech Stack

| Layer          | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| **Runtime**    | Bun 1.3.12                                                     |
| **Monorepo**   | Turborepo with Bun workspaces                                 |
| **Language**   | TypeScript 6.0.2 (strict mode)                                |
| **Backend**    | Bun HTTP server, oRPC, Pino logging                           |
| **Database**   | PostgreSQL 18.1, Prisma 7.3 (`@prisma/adapter-pg`)           |
| **Frontend**   | React 19.2, Vite 7.3, React Router 7, TanStack Query 5       |
| **UI**         | shadcn/ui (base-vega), Tailwind CSS 4.1, Lucide icons         |
| **Auth**       | JWT (jose), OTP, OIDC (GitHub), WebAuthn passkeys             |
| **Linting**    | Biome 2.3 (formatting + linting)                              |
| **Validation** | Zod 4.1                                                       |
| **Date/Time**  | Temporal API via `temporal-polyfill`                          |

---

## 🌟 Key Features

### Type Safety Everywhere

```typescript
// Define API once
export const getUser = authedProcedure
  .input(z.object({ id: z.string() }))
  .output(UserSchema)
  .handler(async ({ input, context }) => {
    return usersData.findById(context.db, input.id);
  });

// Use with full type safety
const user = await api.users.getUser({ id: '123' });
//    ^? User (fully typed!)
```

### Actor-Tracked Transactions

Every database mutation knows who made it:

```typescript
await withActor(db, userId, async (tx) => {
  return tx.post.create({ data });
});
// Automatically logged in audit.change_log
```

### Real-Time Database Subscriptions

```typescript
import { listener } from '@raineworks/database';

listener.on('post', (event) => {
  console.log(`Post ${event.operation}:`, event.id);
  // Invalidate caches, broadcast to WebSocket clients, etc.
});
```

### Beautiful UI Components

```typescript
import { Button } from '@raineworks/ui/components/ui/button';
import { Card } from '@raineworks/ui/components/ui/card';
import { useTheme } from '@raineworks/ui/providers/theme';

<Button variant="default">Click me</Button>
```

### Error Handling with tryCatch

```typescript
import { tryCatch } from '@raineworks/tools/try-catch';

const { data, error } = await tryCatch(fetchUser(id));
if (error) return handleError(error);

console.log(data.name); // fully typed, no try/catch blocks
```

---

## 📝 Environment Variables

Create a `.env` file in the root:

```env
# Required
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/dev_db
JWT_SECRET=your-super-secret-key-at-least-32-characters-long

# Optional - GitHub Sign-In
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Optional - WebAuthn
RP_ID=localhost
RP_NAME=RaineWorks
RP_ORIGIN=http://localhost:3000
```

**Generate a secure JWT_SECRET:**

```bash
# Using openssl
openssl rand -base64 32

# Using Bun
bun -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🎨 Customization

This repo is already trimmed for a personal site, but the core extension points stay the same:

### 1. Replace Example Models

The `Post` model is just a placeholder. Replace it with your domain models:

```prisma
// packages/database/prisma/schema.prisma
model YourModel {
  id        String   @id @default(cuid())
  // Your fields here
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Then create a migration:

```bash
cd packages/database
bunx --bun prisma migrate dev --name add_your_model
```

### 2. Customize the UI Theme

Edit Tailwind CSS variables in `packages/ui/src/styles/theme.css`:

```css
:root {
  --primary: 240 5.9% 10%;        /* Your brand color */
  --primary-foreground: 0 0% 98%;
  /* ... */
}
```

### 3. Add Your Domain Logic

- **Data Layer**: `packages/server/src/data/` — Database operations
- **Routes**: `packages/server/src/routes/` — API endpoints
- **Components**: `packages/web/src/components/` — UI components
- **Pages**: `packages/web/src/routes/` — Application pages

### 4. Configure Authentication

Set GitHub OAuth credentials only if you want social sign-in. Email OTP and passkeys remain available for passwordless auth.

---

## 🚢 Deployment

### Build for Production

```bash
# Build all packages
bun run build

# Run migrations
bun run db:deploy

# Start server
cd packages/server
bun run dist/index.js
```

Set `STATIC_DIR` to the directory containing the built `web` frontend assets.

---

## 📖 Endpoints

When you run `bun run dev`, these endpoints are available:

- **Site**: http://localhost:3024
- **API Spec**: http://localhost:3000/api/openapi.json
- **Health Check**: http://localhost:3000/healthz

For detailed project rules and architecture, see **[AGENTS.md](./AGENTS.md)**.

---

## 🛠️ Key Conventions

### Dependency Management

All dependencies MUST be in the catalog with exact versions:

```jsonc
// Root package.json
{
  "workspaces": {
    "catalog": {
      "some-package": "1.2.3"  // Exact version, no ^ or ~
    }
  }
}

// Package package.json
{
  "dependencies": {
    "some-package": "catalog:"
  }
}
```

### Database Operations

Always use `withActor()` for mutations:

```typescript
// ✅ Correct
await withActor(db, userId, async (tx) => {
  return tx.post.create({ data });
});

// ❌ Wrong
await db.post.create({ data });  // No audit trail!
```

### UI Components

Always check `@raineworks/ui` before creating new components:

```typescript
// ✅ Use existing components
import { Button } from '@raineworks/ui/components/ui/button';

// Import from subpaths for tree-shaking
import { Card } from '@raineworks/ui/components/ui/card';
```

### Error Handling

Prefer `tryCatch` over try/catch:

```typescript
// ✅ Type-safe error handling
const { data, error } = await tryCatch(operation());
if (error) return handleError(error);

// ❌ Traditional try/catch
try {
  const data = await operation();
} catch (error) {
  handleError(error);
}
```

---

## 📜 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Built With

- [Bun](https://bun.sh) — Fast all-in-one JavaScript runtime
- [Turborepo](https://turbo.build) — High-performance monorepo build system
- [Prisma](https://prisma.io) — Next-generation ORM
- [oRPC](https://orpc.unnoq.com) — Contract-first RPC framework
- [shadcn/ui](https://ui.shadcn.com) — Beautifully designed components
- [Temporal API Polyfill](https://github.com/js-temporal/temporal-polyfill) — Modern date/time

---

<div align="center">
  <p>⭐️ Star this repo if you find it useful!</p>
  <p>
    <a href="https://github.com/yourusername/raineworks">GitHub</a> •
    <a href="https://github.com/yourusername/raineworks/issues">Issues</a> •
    <a href="./AGENTS.md">Documentation</a>
  </p>
</div>