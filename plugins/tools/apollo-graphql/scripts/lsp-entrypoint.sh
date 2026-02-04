#!/usr/bin/env bash
# Apollo Rover LSP entrypoint - installs rover if not available
set -e

if ! command -v rover &> /dev/null; then
  echo "Installing Apollo Rover CLI..." >&2
  curl -sSL https://rover.apollo.dev/nix/latest | sh
  export PATH="$HOME/.rover/bin:$PATH"
fi

exec rover lsp "$@"
