#!/usr/bin/env bash
# Tailwind CSS LSP entrypoint - installs @tailwindcss/language-server if not available
set -e

if ! command -v tailwindcss-language-server &> /dev/null; then
  echo "Installing @tailwindcss/language-server..." >&2
  npm install -g @tailwindcss/language-server
fi

exec tailwindcss-language-server --stdio "$@"
