#!/usr/bin/env bash
#
# Ensure han binary is available for this session.
# Installs if missing and adds ~/.claude/bin to PATH via CLAUDE_ENV_FILE.
#

HAN_BIN_DIR="$HOME/.claude/bin"
HAN_BIN="$HAN_BIN_DIR/han"

# Already in PATH - nothing to do
if command -v han >/dev/null 2>&1; then
  exit 0
fi

# Not in PATH but installed - just need to update env file
if [ -x "$HAN_BIN" ]; then
  if [ -n "$CLAUDE_ENV_FILE" ]; then
    echo "export PATH=\"$HAN_BIN_DIR:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  fi
  exit 0
fi

# Not installed - install via hosted script
curl -fsSL https://han.guru/install.sh | bash

# Add to session PATH
if [ -n "$CLAUDE_ENV_FILE" ] && [ -x "$HAN_BIN" ]; then
  echo "export PATH=\"$HAN_BIN_DIR:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi
