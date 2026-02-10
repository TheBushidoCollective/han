#!/usr/bin/env bash
# Register the current Claude config directory with the coordinator
# This enables multi-environment session indexing (e.g., ~/.claude, ~/.claude-work)

set -e

# Get the config directory
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

# Always register - this is idempotent (upsert) and ensures the coordinator
# knows about all config directories, including the default ~/.claude
han coordinator register --config-dir "$CONFIG_DIR" 2>/dev/null || true
