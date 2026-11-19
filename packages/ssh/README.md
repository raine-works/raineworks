# @raineworks/ssh

`ssh raineworks.com`: the site as a terminal UI, built with Ink (React for terminals) and served by an `ssh2` server,
compiled into its own standalone binary and image (`ghcr.io/raine-works/raineworks-ssh`). It isn't a web zone: the
server doesn't serve it and it has no `index.html`.

| Path | What |
| --- | --- |
| `src/main.ts` | Process entry: loads the host key and limits, starts the server |
| `src/app.tsx` | The TUI: home, work, projects, hobbies, contact; ←/→, `h`/`l`, Tab or 1–5 to move, `q` to quit |
| `src/screens/*.tsx` | One per page, plain Ink, testable without SSH (`ink-testing-library`, `src/app.test.tsx`) |
| `src/sanitize.ts` | Every piece of content goes through it before it's rendered, so none can inject terminal escape sequences |
| `src/server/` | `ssh2` server (`index.ts`), connection and rate limits (`limits.ts`), TTY streams over the channel (`terminal.ts`) |
| `scripts/build.ts` | `bun run build` → `dist/ssh-server` |
| `Dockerfile` | Distroless, non-root (uid 65532), no shell |

Content comes from `@raineworks/web-marketing/content/profile`, the module the website renders: edit it there, never
in a copy here. Keep the TUI read-only and its width responsive (`useWindowSize`); don't assume a terminal size or
colour support.

## The server

- `none` auth only, and a single pty `shell` session running the Ink app. Exec, subsystems, port forwarding,
  agent/X11 forwarding and shells without a pty are refused: don't add handlers for them. Pty sizes are clamped.
- Limits (`src/server/limits.ts`, unit-tested) are per client IP: `SSH_MAX_CONNECTIONS` (200), `SSH_MAX_PER_IP` (5),
  `SSH_RATE_PER_IP` (10 new connections a minute). They're keyed on the TCP peer address, so the server must see real
  client addresses: publish the port directly or use an L4 passthrough that keeps the source IP. Behind a proxy that
  rewrites it (PROXY protocol isn't supported), every visitor shares one bucket: raise the limits then.
- The build keeps `target: 'bun'` and minifies with `keepNames`: without names, the binary crashes on disconnect,
  since `ssh2` checks `channel.constructor.name === 'Session'`. `react-devtools-core` and `cpu-features` are stubbed
  out on purpose.

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
watcher: `SSH_HOST_KEY_PATH=./host_key bun run --filter @raineworks/ssh start`.

## Deploying

The container listens on `SSH_PORT` (2222); map the host's port 22 to it (in Dokploy, publish TCP 22 → 2222 on the SSH
service) after moving the host's own sshd to another port. `ssh raineworks.com` needs the apex DNS record to point at
that host.
