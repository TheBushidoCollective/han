#!/usr/bin/env bash
# Markdown LSP entrypoint - installs marksman if not available
set -e

if ! command -v marksman &> /dev/null; then
  echo "Installing marksman..." >&2
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install marksman
  elif command -v cargo &> /dev/null; then
    cargo install marksman
  else
    echo "Please install marksman manually: https://github.com/artempyanykh/marksman" >&2
    exit 1
  fi
fi

exec marksman server "$@"
