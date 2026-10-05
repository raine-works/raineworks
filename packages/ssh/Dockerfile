# Multi-stage distroless Dockerfile for @app/ssh (the `ssh raineworks.com` TUI)
# Build context is the repo root: docker build -f packages/ssh/Dockerfile .
# ------------------------------------------------------------------------------
# Stage 1: install workspace deps and compile the standalone binary
# ------------------------------------------------------------------------------
FROM oven/bun:1.4 AS builder
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY packages/ ./packages/

RUN bun install --frozen-lockfile
RUN bun run --filter @app/ssh build

# ------------------------------------------------------------------------------
# Stage 2: distroless runtime, non-root, no shell. The host key is NOT in the
# image: mount an ed25519 private key at SSH_HOST_KEY_PATH (read-only), e.g.
#   docker run -p 22:2222 -v /path/to/host_key:/run/secrets/ssh_host_key:ro \
#     --read-only --cap-drop ALL raineworks-ssh
# Generate once with: ssh-keygen -t ed25519 -N '' -f host_key
# ------------------------------------------------------------------------------
FROM gcr.io/distroless/cc-debian12:nonroot

COPY --from=builder /app/packages/ssh/dist/ssh-server /ssh-server

ENV NODE_ENV=production
ENV SSH_PORT=2222
ENV SSH_HOST_KEY_PATH=/run/secrets/ssh_host_key
EXPOSE 2222

USER nonroot
ENTRYPOINT ["/ssh-server"]
