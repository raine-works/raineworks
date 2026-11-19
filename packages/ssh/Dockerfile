# syntax=docker/dockerfile:1
# The `ssh raineworks.com` image: the OpenTUI terminal UI and its ssh2 server, bundled for Bun (`scripts/build.ts`)
# and run on Bun's distroless image as non-root (no shell, no package manager). Built from the repository's root:
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
COPY tsconfig.json LICENSE ./
COPY packages ./packages
# The version every session's About and status bar show.
ARG VERSION=""
RUN bun run --filter @raineworks/ssh build

# Bun's own distroless image (the app runs on Bun: OpenTUI's native library is a separate file, below), pinned by
# digest so a rebuild never picks up a different image unseen.
FROM oven/bun:1.4.4-distroless@sha256:153a951ae40106e125898103e6e990ee0f38e6aee7f561029e26cf9fbed23470 AS runner

ARG VERSION
ARG GIT_SHA=""
ARG IMAGE_SOURCE=https://github.com/raine-works/raineworks

# OTUI_ASSET_ROOT: where OpenTUI finds its native library, /app/opentui/@opentui/core-<platform>/libopentui.so. It's
# under the MIT License and, for the decode-only FFmpeg it statically links, the GNU LGPL 2.1 or later: a separate
# file anyone may replace (point OTUI_ASSET_ROOT at another), with its licence texts beside it and in /app/licenses,
# with every other package's.
ENV VERSION=${VERSION} \
	GIT_SHA=${GIT_SHA} \
	NODE_ENV=production \
	TZ=UTC \
	SSH_PORT=2222 \
	OTUI_ASSET_ROOT=/app/opentui

WORKDIR /app
COPY --chown=65532:65532 --from=builder /workspace/packages/ssh/dist/ ./
USER 65532:65532
EXPOSE 2222
CMD ["/app/main.js"]

# Links the image to the repository on GitHub's registry (it takes the repository's visibility and access).
LABEL org.opencontainers.image.source=${IMAGE_SOURCE} \
	org.opencontainers.image.url=${IMAGE_SOURCE} \
	org.opencontainers.image.documentation=${IMAGE_SOURCE}/tree/master/packages/ssh \
	org.opencontainers.image.title=raineworks-ssh \
	org.opencontainers.image.description="ssh raineworks.com: the site as a terminal UI" \
	org.opencontainers.image.vendor="raineworks" \
	org.opencontainers.image.licenses="MIT AND LGPL-2.1-or-later" \
	org.opencontainers.image.version=${VERSION} \
	org.opencontainers.image.revision=${GIT_SHA}
