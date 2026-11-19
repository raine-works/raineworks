# raineworks

Raine Petersen's site, [raineworks.com](https://raineworks.com): who Raine is, what Raine is building, and the projects
behind it. A Bun workspace whose Hono server compiles to a single binary with the site embedded, serving a React 19 front
end built on shadcn/ui and ui-sdk.

## Packages

| Package | What |
| --- | --- |
| [`@raineworks/server`](packages/server) | The Hono server: probes, `/api`, every web zone; compiled into one standalone binary |
| [`@raineworks/api`](packages/api) | The typed `hc` client over the server's routes |
| [`@raineworks/ui`](packages/ui) | The design system: tokens, shadcn components, blocks, the zone root, About (What's new and Legal) |
| [`@raineworks/web-marketing`](packages/web-marketing) | The site itself, the `marketing` zone at `/` |
| [`@raineworks/tools`](packages/tools) | The shared toolbox: zones, the frontend build, env, HTTP, versions, releases, licence notices |
| [`@raineworks/tsconfig`](packages/tsconfig) | The TypeScript configs every package extends |

## Getting started

Bun 1.4.4 (`.bun-version`), then:

```bash
bun install
bun run dev         # every zone in watch mode, and the server on http://127.0.0.1:3000
```

| Command | What |
| --- | --- |
| `bun run dev` / `dev:kill` | Develop / stop this repo's dev processes |
| `bun run build` | Every zone, then the standalone binary (`packages/server/dist/server`) |
| `bun run format` / `lint` / `typecheck` / `test` | `bun fmt`, `bun fmt --check`, `bun check -b`, every package's tests |
| `bun run release` | Start the next release's note |

More in [docs/development.md](docs/development.md).

## Docs

| Doc | What |
| --- | --- |
| [AGENTS.md](AGENTS.md) | The rules for changing this repo (`CLAUDE.md` links to it) |
| [STYLEGUIDE.md](STYLEGUIDE.md) | How the code reads |
| [docs/architecture.md](docs/architecture.md) | Packages, zones, the server, production |
| [docs/development.md](docs/development.md) | Running, testing, releasing, deploying |
| [docs/frontend.md](docs/frontend.md) | Zones, the design system, About, versions and updates |

## Releases

Calendar versions, `YEAR.MONTH.N`, tagged `v<version>`. GitHub Actions mints them: a push to `master` that changes the
image is released, the image pushed to `ghcr.io/raine-works/raineworks-server` and tagged with the version, and its
GitHub release written from its note in `packages/ui/src/release-notes/` (Actions → Release note has Claude write one). Every page shows its version in the footer; clicking it opens
What's new.

## License

[MIT](LICENSE) © raineworks. The open-source packages the site is built with, and their licences, are listed under
About → Legal on every page.
