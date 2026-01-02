#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="pyright-langserver"

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing pyright..." >&2

    # Try npm first (more reliable for the language server binary)
    if command -v npm &> /dev/null; then
        npm install -g pyright
    # Fall back to pip
    elif command -v pip &> /dev/null; then
        pip install pyright
    elif command -v pip3 &> /dev/null; then
        pip3 install pyright
    else
        echo "Error: Neither npm nor pip is available. Please install one of them first." >&2
        exit 1
    fi
fi

exec "$LSP_CMD" "$@"
