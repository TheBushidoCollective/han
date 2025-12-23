#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="nimlsp"

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2

    if command -v nimble &> /dev/null; then
        nimble install nimlsp -y
    else
        echo "Error: nimble not found. Please install Nim first." >&2
        exit 1
    fi

    # Add nimble bin to PATH if needed
    NIMBLE_BIN="${HOME}/.nimble/bin"
    if [[ -d "$NIMBLE_BIN" ]] && [[ ":$PATH:" != *":$NIMBLE_BIN:"* ]]; then
        export PATH="${NIMBLE_BIN}:${PATH}"
    fi
fi

exec "$LSP_CMD" "$@"
