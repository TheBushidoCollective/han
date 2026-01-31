#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="solargraph"

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2

    if command -v gem &> /dev/null; then
        gem install solargraph
    else
        echo "Error: Ruby gem command not found. Please install Ruby first." >&2
        exit 1
    fi
fi

exec "$LSP_CMD" "$@"
