#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="csharp-ls"

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2

    if command -v dotnet &> /dev/null; then
        dotnet tool install -g csharp-ls

        # Add dotnet tools to PATH if needed
        DOTNET_TOOLS="${HOME}/.dotnet/tools"
        if [[ -d "$DOTNET_TOOLS" ]] && [[ ":$PATH:" != *":$DOTNET_TOOLS:"* ]]; then
            export PATH="${DOTNET_TOOLS}:${PATH}"
        fi
    else
        echo "Error: dotnet not found. Please install .NET SDK first." >&2
        exit 1
    fi
fi

exec "$LSP_CMD" "$@"
