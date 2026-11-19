#!/usr/bin/env bash
# `bun run dev:init` (after `bun install`): sets a clone up for development. Safe to run again: nothing set by hand is
# lost.
#
#   1. each package's .env.local from its .env.example (scripts/secrets.sh), keeping the values already there;
#   2. the SSH app's development host key (packages/ssh/.dev/host_key, git-ignored), the one `bun run dev` serves with.
#
# There are no local services to start yet (a database, object storage): when there are, put them in
# .docker/compose.yaml and start them here first (`docker compose -f .docker/compose.yaml up -d`).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"${ROOT_DIR}/scripts/secrets.sh"
bun "${ROOT_DIR}/packages/ssh/scripts/dev-host-key.ts"

echo "Ready: bun run dev"
