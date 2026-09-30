# Multi-stage distroless Dockerfile for @app/backend
# Build context is the repo root: docker build -f packages/backend/Dockerfile .
# ------------------------------------------------------------------------------
# Stage 1: install workspace deps, build + embed all micro-frontends into a
# standalone binary
# ------------------------------------------------------------------------------
FROM oven/bun:1.4 AS builder
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY packages/ ./packages/

RUN bun install --frozen-lockfile
RUN bun run --filter @app/backend build

# ------------------------------------------------------------------------------
# Stage 2: distroless minimal runtime image — no shell, no package manager,
# no Bun install. The binary embeds every micro-frontend; nothing else to copy.
# ------------------------------------------------------------------------------
FROM gcr.io/distroless/cc-debian12

COPY --from=builder /app/packages/backend/dist/server /server

ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/server"]
