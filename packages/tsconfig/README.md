# @raineworks/tsconfig

Centralized TypeScript base configurations shared by every package in the monorepo.

## Configs

| File | Extends | Used by |
| --- | --- | --- |
| `base.json` | — | Bun packages: `server`, `tools` (and the root `tsconfig.json`, and `scripts`) |
| `react-library.json` | `base` | React libraries: `ui`. Adds the DOM libs, `jsx: react-jsx`, `resolveJsonModule`, `isolatedModules`. |
| `react-app.json` | `react-library` | The web zones (`web-*`). |

## Usage

In a package's `tsconfig.json`:

```jsonc
{
	"extends": "@raineworks/tsconfig/base.json",
	"compilerOptions": {
		"rootDir": "./"
	},
	"include": ["src"]
}
```

## What `base.json` sets

- `strict: true`, `forceConsistentCasingInFileNames: true`, `skipLibCheck: true`
- `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`: the lint `bun check` does. An unused import,
  variable or parameter is an error, in every package (there's no separate linter: `bun fmt` formats)
- `module`/`target`/`lib`: `ESNext` with `moduleResolution: "bundler"` and `moduleDetection: "force"`: matches Bun's runtime resolution
- `noEmit: true`: Bun runs TypeScript directly, and type checking is `bun check` (`bun run typecheck`)
- `composite: true`, so the root `tsconfig.json` can reference every package (`bun check -b`); build info, for
  editors, goes in each package's own `.types/` (`${configDir}`, git-ignored)
- `allowImportingTsExtensions`, `allowArbitraryExtensions`, `allowJs`, `allowSyntheticDefaultImports`
- `types: ["bun"]` (from `@types/bun`)

A change here affects every package's `typecheck`: keep it deliberate and run `bun run typecheck` at the root.
