# syntax=docker/dockerfile:1
# The raineworks server image: every web zone and the server, compiled into one standalone binary
# (`scripts/build.ts`), run on distroless (no shell, no package manager, no Bun). Built from the repository's root:
#
#   docker build --build-arg VERSION=$(bun run --silent release next) --build-arg GIT_SHA=$(git rev-parse HEAD) \
#     -f packages/server/Dockerfile .
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
# The version and commit every page (and About) shows (`@raineworks/tools/version`): there's no .git here. Set only
# for the build, so they never bust the layers above.
ARG VERSION=""
ARG GIT_SHA=""
ENV RAINEWORKS_VERSION=${VERSION} \
	RAINEWORKS_COMMIT=${GIT_SHA}
# Every web zone (minified, precompressed), then the server compiled with them embedded.
RUN bun run build

# Pinned by digest so a rebuild never picks up a different image unseen.
FROM gcr.io/distroless/base-debian13:nonroot@sha256:a08d9054afbaf1af9b90fd02cdc7b32236319b5376d374505a41548d42b0c5db AS runner

ARG VERSION
ARG GIT_SHA=""
ARG IMAGE_SOURCE=https://github.com/raine-works/raineworks

ENV VERSION=${VERSION} \
	GIT_SHA=${GIT_SHA} \
	NODE_ENV=production \
	TZ=UTC

WORKDIR /app
COPY --chown=65532:65532 --from=builder /workspace/packages/server/dist/server ./server
EXPOSE 3032
CMD ["./server"]

# Links the image to the repository on GitHub's registry (it takes the repository's visibility and access).
LABEL org.opencontainers.image.source=${IMAGE_SOURCE} \
	org.opencontainers.image.url=${IMAGE_SOURCE} \
	org.opencontainers.image.documentation=${IMAGE_SOURCE}/tree/master/packages/server \
	org.opencontainers.image.title=raineworks-server \
	org.opencontainers.image.description="raineworks.com: the server, serving the site" \
	org.opencontainers.image.vendor="raineworks" \
	org.opencontainers.image.licenses="MIT" \
	org.opencontainers.image.version=${VERSION} \
	org.opencontainers.image.revision=${GIT_SHA}
