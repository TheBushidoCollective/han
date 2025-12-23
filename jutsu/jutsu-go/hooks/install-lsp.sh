#!/usr/bin/env bash
set -e

BIN_DIR="${HOME}/.claude/bin"
LSP_NAME="gopls"

BINARY="${BIN_DIR}/${LSP_NAME}"

# Skip if already installed
[[ -x "$BINARY" ]] && exit 0

# Check if go is available
if ! command -v go &>/dev/null; then
  echo "Go not installed, skipping gopls installation" >&2
  exit 0
fi

mkdir -p "$BIN_DIR"
echo "Installing gopls..." >&2

# Install gopls using go install
GOBIN="$BIN_DIR" go install golang.org/x/tools/gopls@latest

echo "✓ gopls installed to ${BINARY}" >&2
