# Contributing to RaineStack

Thank you for your interest in contributing to RaineStack! This guide will help you get started with contributing to the project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

By participating in this project, you agree to:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Accept responsibility for your mistakes
- Prioritize the community's best interests

---

## Getting Started

### Prerequisites

- **Bun 1.3.9** — [Install Bun](https://bun.sh)
- **Docker** — For local PostgreSQL
- **Git** — For version control

### Setup

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/rainestack.git
   cd rainestack
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/yourusername/rainestack.git
   ```

4. **Install dependencies:**
   ```bash
   bun install
   ```

5. **Start the database:**
   ```bash
   bun run db:start
   bun run db:dev
   ```

6. **Start development servers:**
   ```bash
   bun run dev
   ```

---

## Development Workflow

### Creating a Branch

Always create a new branch for your changes:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

**Branch naming conventions:**
- `feature/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `refactor/` — Code refactoring
- `test/` — Test additions or updates

### Making Changes

1. **Read the relevant documentation** in `/docs` before starting
2. **Follow the project rules** in `AGENTS.md`
3. **Write tests** for new functionality
4. **Update documentation** if needed
5. **Run linters and formatters:**
   ```bash
   bun run format
   bun run lint
   bun run typecheck
   ```

### Testing Your Changes

```bash
# Run all tests
bun test

# Run tests for specific package
cd packages/server
bun test

# Type-check all packages
bun run typecheck

# Lint all packages
bun run lint
```

---

## Project Structure

```
rainestack/
├── docs/                    # Markdown documentation
├── packages/
│   ├── tools/               # Shared utilities
│   ├── database/            # Prisma schema and client
│   ├── server/              # Bun HTTP server + oRPC API
│   ├── api/                 # Client-side oRPC client
│   ├── ui/                  # Shared React components
│   ├── web/                 # Web shell micro-frontend
│   ├── docs/                # Docs micro-frontend
│   └── tsconfig/            # Shared TypeScript configs
├── AGENTS.md                # Project rules (READ THIS!)
└── README.md                # Project overview
```

**Important:** Read `AGENTS.md` before making any changes — it contains critical project conventions.

---

## Coding Standards

### TypeScript

- **Strict mode enabled** — No implicit `any`, proper null checking
- **Functional style** — Prefer pure functions with explicit parameters
- **Explicit types** — Avoid relying solely on inference for public APIs

### Dependencies

**All dependencies MUST be in the catalog:**

1. Add to root `package.json` catalog with exact version:
   ```json
   {
     "workspaces": {
       "catalog": {
         "new-package": "1.2.3"
       }
     }
   }
   ```

2. Reference in package:
   ```json
   {
     "dependencies": {
       "new-package": "catalog:"
     }
   }
   ```

3. Never use version ranges (`^`, `~`) — always exact versions

### Database Changes

1. **Modify Prisma schema** in `packages/database/prisma/schema.prisma`
2. **Create migration:**
   ```bash
   cd packages/database
   bunx --bun prisma migrate dev --name your_migration_name
   ```
3. **Update triggers** if needed in `scripts/triggers.sql`
4. **Classify tables** as persistent or ephemeral (see AGENTS.md)

### API Endpoints

1. **Define data layer function** in `packages/server/src/data/`
2. **Create Zod schemas** in `packages/server/src/lib/schemas.ts`
3. **Create route** in `packages/server/src/routes/`
4. **Use `withActor()`** for all mutations
5. **Handle Prisma errors** with utilities from `@rainestack/database/errors`

### UI Components

1. **Check existing components** in `@rainestack/ui` first
2. **Use shadcn/ui** for new components:
   ```bash
   cd packages/ui
   bunx shadcn@latest add component-name
   ```
3. **Import via subpaths:**
   ```typescript
   import { Button } from '@rainestack/ui/components/ui/button';
   ```

### Formatting & Linting

We use **Biome** for both:

```bash
# Format code
bun run format

# Lint code
bun run lint

# Fix auto-fixable issues
bun run lint --apply
```

**Rules:**
- Tabs for indentation
- Single quotes (double for JSX)
- Semicolons required
- No trailing commas
- 120 character line width

### Git Commits

**Commit message format:**
```
type(scope): brief description

Longer explanation if needed.

Fixes #123
```

**Types:**
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `refactor:` — Code refactoring
- `test:` — Test additions/updates
- `chore:` — Maintenance tasks

**Examples:**
```
feat(api): add user profile endpoint

Implements GET /api/users/:id endpoint with full type safety.

Fixes #42
```

```
fix(database): resolve unique constraint issue in OTP codes

The OTP code table was missing a unique constraint on (email, code).
This caused potential duplicate codes for the same user.
```

---

## Submitting Changes

### Pull Request Process

1. **Sync with upstream:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open a Pull Request** on GitHub

4. **Fill out the PR template** with:
   - Description of changes
   - Related issue numbers
   - Testing instructions
   - Screenshots (if UI changes)

5. **Respond to review feedback**

### PR Requirements

- ✅ All tests pass
- ✅ Linter and formatter pass
- ✅ Type-check passes
- ✅ Documentation updated (if needed)
- ✅ No merge conflicts with `main`
- ✅ Follows project conventions in `AGENTS.md`

### Review Process

1. Maintainers will review your PR
2. Address any requested changes
3. Once approved, a maintainer will merge

---

## Reporting Issues

### Bug Reports

Include:
- **Clear title** describing the issue
- **Steps to reproduce** the bug
- **Expected behavior** vs. actual behavior
- **Environment:** OS, Bun version, browser (if applicable)
- **Error messages** and stack traces
- **Screenshots** (if relevant)

### Feature Requests

Include:
- **Clear title** describing the feature
- **Problem** the feature solves
- **Proposed solution** with examples
- **Alternatives** you've considered
- **Willingness to contribute** the implementation

---

## Documentation Contributions

Documentation is stored in `/docs` as Markdown files and served dynamically by the docs zone.

### Updating Documentation

1. **Edit markdown files** in `/docs`
2. **Test locally:**
   ```bash
   bun run dev
   open http://localhost:3024/docs
   ```
3. **Follow markdown conventions:**
   - Clear headings and structure
   - Code examples with syntax highlighting
   - Links to related topics
   - Both "do" and "don't" examples

### Adding New Documentation

1. Create new `.md` file in `/docs`
2. Add route in `packages/docs/src/app.tsx`
3. Add link in `packages/docs/src/routes/home.tsx`
4. Update `docs/README.md` index

---

## Questions?

- **GitHub Discussions** — Ask questions and share ideas
- **GitHub Issues** — Report bugs or request features
- **AGENTS.md** — Comprehensive project rules and architecture

---

Thank you for contributing to RaineStack! Your efforts help make this project better for everyone. 🚀