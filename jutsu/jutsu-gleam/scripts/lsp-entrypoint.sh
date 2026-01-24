#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="gleam"

# Check if gleam is installed
if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2

    # Try brew first on macOS
    if [[ "$(uname -s)" == "Darwin" ]] && command -v brew &> /dev/null; then
        brew install gleam
    # Try asdf if available
    elif command -v asdf &> /dev/null; then
        asdf plugin add gleam 2>/dev/null || true
        asdf install gleam latest
        asdf global gleam latest
    else
        echo "Error: Please install Gleam from https://gleam.run/getting-started/installing/" >&2
        exit 1
    fi
fi

# Gleam has built-in LSP support via 'gleam lsp'
exec "$LSP_CMD" "$@"
