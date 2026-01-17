#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="gopls"

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2

    if command -v go &> /dev/null; then
        go install golang.org/x/tools/gopls@latest

        # Add GOPATH/bin to PATH if not already there
        GOBIN="${GOPATH:-$HOME/go}/bin"
        if [[ ":$PATH:" != *":$GOBIN:"* ]]; then
            export PATH="${GOBIN}:${PATH}"
        fi
    else
        echo "Error: Go is not installed. Please install Go first." >&2
        exit 1
    fi
fi

exec "$LSP_CMD" "$@"
