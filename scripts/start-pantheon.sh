#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_DIR="${REPO_ROOT}/.runtime-pantheon"

mkdir -p "${RUNTIME_DIR}"

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-39021}"
export DATABASE_PATH="${DATABASE_PATH:-${RUNTIME_DIR}/auth.db}"
export WORKSPACES_ROOT="${WORKSPACES_ROOT:-/root}"

cd "${REPO_ROOT}"
exec node server/index.js
