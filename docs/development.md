# Development

Running, testing, releasing and deploying. Rules are in [AGENTS.md](../AGENTS.md).

---

## Setup

Bun 1.4.4 (`.bun-version`; `bun upgrade --version 1.4.4` or your version manager), then:

```bash
bun install
bun run dev:init
bun run dev
```

## Commands

Run at the root.

| Command | What it does |
| --- | --- |
| `bun run dev` | Every package's `dev` script, in parallel: each zone's `Bun.build --watch` (rebuilding on a change in the zone or `@raineworks/ui`), the server on `http://127.0.0.1:3032` and the SSH app on port 2222 (`ssh -p 2222 localhost`), all restarting on save. Reload the page after a rebuild. |
| `bun run dev:init` | Sets a clone up for development (`scripts/init.sh`): each package's `.env.local` from its `.env.example` (`scripts/secrets.sh`; values already set are kept, keys only there too), and the SSH app's dev host key. Safe to run again. |
| `bun run dev:kill` | Stops this repo's dev processes (matched by working directory; another project's server on the port is reported, never killed). `--dry-run` lists them. |
| `bun run build:web` | Builds every zone into `packages/web-*/dist` (minified, precompressed, stamped) |
| `bun run build` | `build:web`, then the standalone server binary, `packages/server/dist/server` |
| `bun run start` | The server from source (`NODE_ENV` unset is production) |
| `bun run format` / `lint` | `bun fmt` / `bun fmt --check` (Prettier's options, imports and Tailwind classes sorted: `bunfig.toml`) |
| `bun run typecheck` | `bun check -b`: every package, through the root `tsconfig.json`'s references |
| `bun run test` | Every package's `bun test`, one after another |
| `bun run release` | Starts the next release's note; see [Releases](#releases) |
| `bun run openapi` | Prints the API's OpenAPI 3.1 document (`--out api.json` writes it); the same one `GET /api/openapi.json` serves |
| `bun run clean` | Removes every `node_modules` and `dist` |

The server reads `packages/server/.env.local` if present (`.env.example` lists the settings: `PORT`, `HOST`,
`WEB_DIST`, `SHUTDOWN_DRAIN_MS`; all have defaults). Tests load `.env.test` instead.

## Testing

Tests sit next to what they cover (`*.test.ts`) and run with `bun test`. Test what someone sees or calls, never
internals:

- **Routes:** `createApp().request(…)` (`packages/server/src/app.test.ts`), with a zone of its own in a temporary
  `WEB_DIST`.
- **Tools:** each module's own test, the release CLI in a throwaway repository.
- **The React Compiler:** `packages/tools/src/react-compiler.test.ts` builds every zone and fails for any first-party
  component or hook the compiler skipped.
- **The licence:** `packages/ui/src/lib/brand.test.ts` holds About's licence to the root `LICENSE`.

## Releases

Versions are calendar versions, `YEAR.MONTH.N`: `2026.11.1` is November 2026's first release, `2026.11.2` its second,
`2026.12.1` December's first. Each is tagged `v<version>` and every page shows the one it's from (the footer's
version label, and About).

**A push to `master` that changes the image is a release**, minted by GitHub Actions (`.github/workflows/ci.yml`,
wiring `release-plan.yml`, `checks.yml`, `release-images.yml` and `release-publish.yml`):

1. **Plan:** the version it takes (`bun run release next`), and each image's inputs (`bun run images plan`). A service
   is a package with a `Dockerfile` (`server`, `ssh`); its inputs are the root's install and build files and every
   package it's built from (the server's include the zones; tests and docs don't count, release notes do). An image
   is never built twice from the same inputs: one already in the registry (`…:inputs-<hash>`) is reused.
2. **Checks and images, side by side:** lint, types and tests (`checks.yml`); the changed images built (on a pull
   request only built, with a read-only token; on `master`, pushed).
3. **Release**, once both pass: the image tagged with the version, `latest` and `sha-<commit>` (a registry copy, never
   a rebuild), then the repository tagged `v<version>` and its GitHub release published from its note, or from the
   pull requests merged since the last when there isn't one. A re-run after a newer release tags nothing.

A push that changes nothing the image is built from (docs, workflows, tests) is checked, not released. Master's runs
take turns (the `release` concurrency group), so versions are cut one at a time, in order.

To have Claude write a release's note, run **Actions → Release note → Run workflow** (`release.yml`): it writes the next
version's note from what changed since the last one and opens it as the pull request `Release note <version>`; merging
it is the release. Claude signs in with workload identity federation: the job's GitHub OIDC token is exchanged
for a short-lived Anthropic one (the federation rule's identifiers are in `release-note.yml`; no API key is stored).
**Actions → anthropic-wif-test** checks that exchange on its own. The pull request needs one repository secret,
`RELEASE_NOTE_TOKEN` (a fine-grained token for this repository with contents and pull requests write; a pull request
opened with the workflow's own token would start no checks).

A release people would notice has a note. To write one:

```bash
bun run release            # starts packages/ui/src/release-notes/<next version>.md, a stub to fill in
```

```md
---
title: What this release is about, in a few words
date: 2026-11-18
---

## Everywhere

- What changed, for the people who read the site, not how.
```

Merge it in the pull request it describes: that merge is released as its version, and About's **What's new** shows it.
Parts only one zone should show go in `::: for <zone>` … `:::` blocks (a release with nothing for a zone isn't listed
there).

| Command | What it does |
| --- | --- |
| `bun run release next` | Prints the next version: a note written ahead of the newest tag, else the one after it |
| `bun run release check` | Fails if a note added since the newest tag names a version already taken (CI runs it) |
| `bun run release notes <version>` | Prints a note as a GitHub release's text |
| `bun run release tag <version>` | Tags HEAD `v<version>` (CI does this; by hand only to repair a release) |
| `bun run images plan [--since <ref>]` | Prints the image's inputs hash, and whether it changed since `<ref>` (CI's plan) |

## Claude in GitHub

Mention `@claude` in an issue, a comment or a pull request review and Claude answers there: it explains, reviews, or
makes the change and opens a pull request for it (`.github/workflows/claude.yml`). Only people with write access can
start it. It signs in to Anthropic the same way as the release note (workload identity federation, no stored key), and
can run the checks (`bun run lint`, `typecheck`, `test`) but nothing else.

**Code review** (`.github/workflows/code-review.yml`, the check `Code review / review`): on every pull request (not
drafts or forks), Claude reviews the change against `AGENTS.md` and the docs it lists, inline, with one summary comment
ending `Reviewed up to <sha>`. On each push it follows up on its own findings (resolving what's fixed) and reviews
what's new; a reply to one of its inline comments is answered in that thread (one mentioning `@claude` is
`claude.yml`'s instead). It reviews the docs-sync app's pull requests too. It fails when it couldn't finish, so a review
that didn't happen never passes quietly, and on a pull request that changes `code-review.yml` itself (Claude runs only
`master`'s copy), so a person reviews that one. It posts as `claude[bot]`: the [Claude GitHub
App](https://github.com/apps/claude) must be installed on the repository. How a pull request handles the review:
[AGENTS.md](../AGENTS.md#pull-requests-and-code-review).

## Deployment

Every release is two images on GitHub's registry, each tagged `<version>`, `latest` and `sha-<commit>` (public, like
the repository), named after the repository (`imageSuffix`, `@raineworks/tools/images`):

| Image | Service | Listens on |
| --- | --- | --- |
| `ghcr.io/raine-works/raineworks` | `@raineworks/server`: the site | `PORT` (3032) |
| `ghcr.io/raine-works/raineworks-ssh` | `@raineworks/ssh`: `ssh raineworks.com` | `SSH_PORT` (2222); needs a host key ([its README](../packages/ssh/README.md#the-host-key)) |

Production is Dokploy, which pulls `latest`: once a release has tagged the images, CI's `deploy` job calls its webhook
(the `DOKPLOY_WEBHOOK_URL` secret).

```bash
docker run -p 3032:3032 ghcr.io/raine-works/raineworks:latest
bun run --filter @raineworks/server docker:build    # or build one locally: raineworks-server:latest
```

The image is the standalone binary on distroless ([architecture.md](architecture.md#production)). Probes:
`/healthz` (liveness) and `/readyz` (readiness; 503 while draining after SIGTERM).
