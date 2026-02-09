#!/usr/bin/env bash
# Install Han bridge extension for Gemini CLI.
#
# Copies the extension to ~/.gemini/extensions/han/ and
# sets up the Gemini CLI hooks from gemini-hooks.json.
#
# Usage:
#   bash install.sh [source_dir]
#
# source_dir defaults to the directory containing this script.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="${1:-$SCRIPT_DIR}"
TARGET_DIR="$HOME/.gemini/extensions/han"

echo "Installing Han bridge for Gemini CLI..."
echo "  Source: $SOURCE_DIR"
echo "  Target: $TARGET_DIR"

# Create target directory
mkdir -p "$TARGET_DIR/hooks" "$TARGET_DIR/src"

# Copy extension manifest and context
cp "$SOURCE_DIR/gemini-extension.json" "$TARGET_DIR/"
cp "$SOURCE_DIR/GEMINI.md" "$TARGET_DIR/"

# Copy Gemini CLI hooks (NOT the Claude Code hooks/hooks.json)
cp "$SOURCE_DIR/gemini-hooks.json" "$TARGET_DIR/hooks/hooks.json"

# Copy source files
cp "$SOURCE_DIR/src/"*.ts "$TARGET_DIR/src/"

echo ""
echo "Han extension installed to $TARGET_DIR"
echo ""
echo "Verify with: gemini extensions list"
