# @raineworks/tools

The shared toolbox: what more than one package needs, so no package hand-rolls its own. Use it whenever it covers the
job, and extend it (with a test here) when it almost does.

| Module | Use for |
| --- | --- |
| `prototypes` | `tryCatch(() => …)` / `promise.tryCatch()` → `{ data, error }` instead of `try/catch`; `array.isEmpty()`, `string.isEmpty()`, `set.isEmpty()`, … |
| `env` | `baseEnvSchema`, `portSchema`, `loadEnvFiles`, `parseEnv`: every package's `lib/env` is built from these (never `process.env` directly) |
| `zones` | `ZONES`, `zonePublicPath`, `zoneHref`, `resolveZone`, `safeRedirectPath`: the web zones and where they're served |
| `build` | `runFrontendBuildCli` / `buildFrontend`: every zone's `Bun.build` (Tailwind, React Compiler, module preloads, precompression) |
| `http` | MIME types, content-coding negotiation and compression, `Cache-Control` for build outputs |
| `cli` | terminal colours, `cleanBunBuildArtifacts` |

`@raineworks/tools` (the package root) re-exports `cli`, `env`, `http` and `prototypes`; import the rest by path.
