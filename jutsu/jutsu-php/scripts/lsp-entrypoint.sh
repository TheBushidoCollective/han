#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="intelephense"

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2

    if command -v npm &> /dev/null; then
        npm install -g intelephense
    elif command -v yarn &> /dev/null; then
        yarn global add intelephense
    elif command -v pnpm &> /dev/null; then
        pnpm add -g intelephense
    else
        echo "Error: npm, yarn, or pnpm not found. Please install Node.js first." >&2
        exit 1
    fi
fi

exec "$LSP_CMD" "$@"
