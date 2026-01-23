#!/usr/bin/env bash
# Relay LSP entrypoint - gracefully skips if config not found
set -e

# Check if relay-compiler is available
if ! command -v relay-compiler &> /dev/null; then
  echo "Installing relay-compiler..." >&2
  npm install -g relay-compiler
fi

# Check for relay config in common locations
# Priority: explicit arg > package.json > relay.config.json > relay.config.js
if [ $# -gt 0 ]; then
  # Config path provided as argument
  exec relay-compiler lsp "$@"
elif [ -f "package.json" ] && grep -q '"relay"' package.json 2>/dev/null; then
  # Config in package.json
  exec relay-compiler lsp
elif [ -f "relay.config.json" ]; then
  # relay.config.json in root
  exec relay-compiler lsp
elif [ -f "relay.config.js" ]; then
  # relay.config.js in root
  exec relay-compiler lsp
else
  # No config found - exit gracefully without error
  echo "No Relay config found (package.json, relay.config.json, or relay.config.js). LSP disabled for this project." >&2
  exit 0
fi
