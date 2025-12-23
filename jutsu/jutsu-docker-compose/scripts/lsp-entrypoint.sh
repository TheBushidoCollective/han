#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="docker-compose-langserver"
PACKAGE="@microsoft/compose-language-service"

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2
    npm install -g "$PACKAGE"
fi

exec "$LSP_CMD" "$@"
