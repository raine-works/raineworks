# syntax=docker/dockerfile:1
# The `ssh raineworks.com` image: the Ink terminal UI and its ssh2 server, compiled into one standalone binary
# (`scripts/build.ts`), run on distroless as non-root (no shell, no package manager, no Bun). Built from the
# repository's root:
#
#   docker build --build-arg VERSION=$(bun run --silent release next) --build-arg GIT_SHA=$(git rev-parse HEAD) \
#     -f packages/ssh/Dockerfile .
#
# The host key is never in the image: provide an ed25519 private key as SSH_HOST_KEY (PEM text, `\n` escapes
# allowed) or mount it at SSH_HOST_KEY_PATH, readable by uid 65532:
#
#   docker run -p 22:2222 -v "$PWD/host_key:/run/secrets/ssh_host_key:ro" --read-only --cap-drop ALL <image>
#
# CI builds it (release-images.yml) once per set of inputs (`bun run images plan`) and tags it at release.

# Pinned by digest like the runtime below; moved by hand with Bun (package.json packageManager).
FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS base
WORKDIR /workspace

# Only the packages' manifests: the install below is cached on them and the lockfile, so a change to any source
# reuses it.
FROM base AS manifests
COPY packages ./packages
RUN find packages -mindepth 2 -maxdepth 2 ! -name package.json -exec rm -rf {} +

FROM base AS deps
COPY bun.lock package.json bunfig.toml ./
COPY --from=manifests /workspace/packages ./packages
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

FROM deps AS builder
COPY tsconfig.json ./
COPY packages ./packages
RUN bun run --filter @raineworks/ssh build

# Pinned by digest so a rebuild never picks up a different image unseen.
FROM gcr.io/distroless/base-debian13:nonroot@sha256:a08d9054afbaf1af9b90fd02cdc7b32236319b5376d374505a41548d42b0c5db AS runner

ARG VERSION
ARG GIT_SHA=""
ARG IMAGE_SOURCE=https://github.com/raine-works/raineworks

ENV VERSION=${VERSION} \
	GIT_SHA=${GIT_SHA} \
	NODE_ENV=production \
	TZ=UTC \
	SSH_PORT=2222 \
	SSH_HOST_KEY_PATH=/run/secrets/ssh_host_key

WORKDIR /app
COPY --chown=65532:65532 --from=builder /workspace/packages/ssh/dist/ssh-server ./ssh-server
EXPOSE 2222
CMD ["./ssh-server"]

# Links the image to the repository on GitHub's registry (it takes the repository's visibility and access).
LABEL org.opencontainers.image.source=${IMAGE_SOURCE} \
	org.opencontainers.image.url=${IMAGE_SOURCE} \
	org.opencontainers.image.documentation=${IMAGE_SOURCE}/tree/master/packages/ssh \
	org.opencontainers.image.title=raineworks-ssh \
	org.opencontainers.image.description="ssh raineworks.com: the site as a terminal UI" \
	org.opencontainers.image.vendor="raineworks" \
	org.opencontainers.image.licenses="MIT" \
	org.opencontainers.image.version=${VERSION} \
	org.opencontainers.image.revision=${GIT_SHA}
