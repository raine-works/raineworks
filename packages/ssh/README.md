# @raineworks/ssh

`ssh raineworks.com`: the site as a terminal UI, built with OpenTUI (`@opentui/react`: React, flexbox layout, truecolour,
the mouse) and served by an `ssh2` server, in its own image (`ghcr.io/raine-works/raineworks-ssh`). It isn't a web
zone: the server doesn't serve it and it has no `index.html`.

| Path | What |
| --- | --- |
| `src/main.ts` | Process entry: reads `lib/env`, loads the host key, starts the server |
| `src/app.tsx` | The app: the header, sidebar (tabs when narrow), the screen, the status bar, and the palette and help overlays; every key |
| `src/screens/*.tsx` | Home (the logo over rain), Work, Projects, Hobbies, Contact (a form that sends), About (versions, licences) |
| `src/ui/` | The parts: `logo` (the mark, from its SVG geometry, in braille), `rain`, `palette` (⌃K), `help` (?), `panel`, … |
| `src/sanitize.ts` | Every piece of content goes through it before it's rendered, so none can inject terminal escape sequences |
| `src/server/` | `ssh2` server (`index.ts`), limits (`limits.ts`), TTY streams over the channel (`terminal.ts`), messages (`messages.ts`) |
| `src/lib/env.ts` | Its settings, Zod-validated (`.env.example` lists them) |
| `scripts/build.ts` | `bun run build` → `dist/` (below) |
| `Dockerfile` | Bun's distroless image, non-root (uid 65532), no shell |

Content comes from `@raineworks/web-marketing/content/profile`, the module the website renders: edit it there, never
in a copy here. Keep the TUI read-only and responsive (`useTerminalDimensions`): it draws at any size from 60×20 up
(smaller says so), the title takes the biggest font that fits, and below 96 columns the sidebar becomes tabs.

Tests (`bun test`) render the app with OpenTUI's `testRender` and drive it with keys: every screen at two sizes, the
palette, the contact form (empty, sent, refused), quitting. No SSH needed.

## The server

- `none` auth only, and a single pty `shell` session, each with its own OpenTUI renderer sized to the pty (and resized
  on `window-change`). Exec, subsystems, port forwarding, agent/X11 forwarding and shells without a pty are refused:
  don't add handlers for them. Pty sizes are clamped.
- Limits (`src/server/limits.ts`, unit-tested) are per client IP: `SSH_MAX_CONNECTIONS` (200), `SSH_MAX_PER_IP` (5),
  `SSH_RATE_PER_IP` (10 new connections a minute). They're keyed on the TCP peer address, so the server must see real
  client addresses: publish the port directly or use an L4 passthrough that keeps the source IP. Behind a proxy that
  rewrites it (PROXY protocol isn't supported), every visitor shares one bucket: raise the limits then.
- Contact messages go to the site's `POST /api/contact` at `RAINEWORKS_API_URL` (default `https://raineworks.com`;
  in development, the local server), one a minute per session.

## The build and its licences

`bun run build` makes `dist/`: `main.js` (the app, bundled for `target: 'bun'`, minified with `keepNames`: without
names it crashes on disconnect, since `ssh2` checks `channel.constructor.name === 'Session'`); `opentui/@opentui/core-<platform>/`,
OpenTUI's native library for the platform it's built on; and `licenses/`, the licence of every package it ships.
`react-devtools-core` and `cpu-features` are stubbed out on purpose.

OpenTUI's native library is MIT and, for the decode-only FFmpeg it statically links, LGPL-2.1-or-later. That's why
this isn't a compiled binary: the library stays a separate file anyone can replace (OpenTUI loads it from
`OTUI_ASSET_ROOT`, which the image sets to `/app/opentui`), with its licence texts and `FFMPEG-SOURCE.md` (where
FFmpeg's source is) beside it. It's the repository's one LGPL exception, for this image only.

## The host key

Never baked in or generated: the server refuses to start without one, and it must stay the same across deploys or
every client sees a host-key-changed warning. Set **either**:

- `SSH_HOST_KEY`: the private key's PEM text. A single line with literal `\n` escapes works too, which is what
  `.env`-style stores (Dokploy's environment tab) need: `awk '{printf "%s\\n", $0}' host_key`. It wins if both are set.
- `SSH_HOST_KEY_PATH`: a mounted file (default `/run/secrets/ssh_host_key`), readable by uid 65532
  (`chown 65532`, or mode `0440` with group 65532).

```bash
ssh-keygen -t ed25519 -N '' -f host_key
sudo chown 65532:65532 host_key && chmod 400 host_key
docker run -p 22:2222 -v "$PWD/host_key:/run/secrets/ssh_host_key:ro" --read-only --cap-drop ALL \
  ghcr.io/raine-works/raineworks-ssh:latest
ssh localhost
```

In development, `bun run dev` (at the root, or here) serves it on port 2222 with a development key it makes the first
time (`.dev/host_key`, git-ignored; ed25519 through `ssh-keygen`, else RSA): `ssh -p 2222 localhost`. Without the
watcher: `SSH_HOST_KEY_PATH=./host_key bun run --filter @raineworks/ssh start`. Contact messages go to the local
server (`bun run dev` runs it too).

## Deploying

The container listens on `SSH_PORT` (2222); map the host's port 22 to it (in Dokploy, publish TCP 22 → 2222 on the SSH
service) after moving the host's own sshd to another port. `ssh raineworks.com` needs the apex DNS record to point at
that host.
