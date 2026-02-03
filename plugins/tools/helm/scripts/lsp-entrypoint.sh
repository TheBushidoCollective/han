#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="helm_ls"
GO_PACKAGE="github.com/mrjosh/helm-ls@latest"

# Graceful degradation: Check if this is a Helm chart
has_helm_files() {
    [[ -f "Chart.yaml" ]] || [[ -f "Chart.yml" ]] || \
    [[ -d "charts" && -f "charts/*/Chart.yaml" ]]
}

if ! has_helm_files; then
    echo "No Chart.yaml found. Helm LSP disabled." >&2
    exit 0
fi

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2
    go install "$GO_PACKAGE"
fi

exec "$LSP_CMD" "$@"
