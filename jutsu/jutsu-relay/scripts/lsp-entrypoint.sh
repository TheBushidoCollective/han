#!/usr/bin/env bash
# Relay LSP entrypoint - installs relay-compiler if not available
set -e

if ! command -v relay-compiler &> /dev/null; then
  echo "Installing relay-compiler..." >&2
  npm install -g relay-compiler
fi

exec relay-compiler lsp "$@"
