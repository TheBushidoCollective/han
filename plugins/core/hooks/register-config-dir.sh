#!/usr/bin/env bash
# Register non-default config directories with the central coordinator
# This enables multi-environment session indexing

set -e

# Get the config directory
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
DEFAULT_CONFIG_DIR="$HOME/.claude"

# If using the default config dir, nothing to register
if [ "$CONFIG_DIR" = "$DEFAULT_CONFIG_DIR" ]; then
    exit 0
fi

# Register this config directory with the coordinator
# This is silent - we don't want to clutter the session start output
han coordinator register --config-dir "$CONFIG_DIR" 2>/dev/null || true
