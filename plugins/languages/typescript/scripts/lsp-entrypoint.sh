#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="typescript-language-server"
PACKAGE="typescript-language-server"

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2
    npm install -g "$PACKAGE"
fi

exec "$LSP_CMD" "$@"
