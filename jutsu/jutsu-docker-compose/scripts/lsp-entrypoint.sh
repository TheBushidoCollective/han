#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="docker-compose-langserver"
PACKAGE="@microsoft/compose-language-service"

# Graceful degradation: Check if docker-compose files exist
has_compose_files() {
    [[ -f "docker-compose.yml" ]] || [[ -f "docker-compose.yaml" ]] || \
    [[ -f "compose.yml" ]] || [[ -f "compose.yaml" ]]
}

if ! has_compose_files; then
    echo "No docker-compose.yml or compose.yml found. Docker Compose LSP disabled." >&2
    exit 0
fi

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2
    npm install -g "$PACKAGE"
fi

exec "$LSP_CMD" "$@"
