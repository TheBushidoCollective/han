#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="gopls"

# Graceful degradation: Check if Go project files exist
has_go_files() {
    # Check for go.mod first (fastest check)
    [[ -f "go.mod" ]] && return 0

    # Search for .go files with monorepo-friendly depth, excluding common dirs
    local found
    found=$(find . -maxdepth 5 \
        -path "*/node_modules" -prune -o \
        -path "*/.git" -prune -o \
        -path "*/vendor" -prune -o \
        -name "*.go" -type f -print 2>/dev/null | head -1)
    [[ -n "$found" ]]
}

if ! has_go_files; then
    echo "No go.mod or .go files found. Go LSP disabled." >&2
    exit 0
fi

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
