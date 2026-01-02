#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="helm_ls"
GO_PACKAGE="github.com/mrjosh/helm-ls@latest"

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2
    go install "$GO_PACKAGE"
fi

exec "$LSP_CMD" "$@"
