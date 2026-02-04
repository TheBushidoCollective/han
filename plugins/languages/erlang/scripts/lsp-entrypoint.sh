#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="erlang_ls"
BIN_DIR="${HOME}/.claude/bin"

# Check if already installed
if command -v "$LSP_CMD" &> /dev/null; then
    exec "$LSP_CMD" "$@"
fi

if [[ -x "${BIN_DIR}/${LSP_CMD}" ]]; then
    exec "${BIN_DIR}/${LSP_CMD}" "$@"
fi

echo "Installing $LSP_CMD..." >&2

# Determine platform
case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) PLATFORM="macos-arm64" ;;
    Darwin-x86_64) PLATFORM="macos-x64" ;;
    Linux-x86_64) PLATFORM="linux-x64" ;;
    *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

# Try brew first on macOS
if [[ "$(uname -s)" == "Darwin" ]] && command -v brew &> /dev/null; then
    brew install erlang_ls
    exec "$LSP_CMD" "$@"
fi

# Download from GitHub releases
mkdir -p "$BIN_DIR"

LATEST_VERSION=$(curl -fsSL https://api.github.com/repos/erlang-ls/erlang_ls/releases/latest | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
DOWNLOAD_URL="https://github.com/erlang-ls/erlang_ls/releases/download/${LATEST_VERSION}/erlang_ls-${PLATFORM}.tar.gz"

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

if command -v curl &>/dev/null; then
    curl -fsSL "$DOWNLOAD_URL" | tar xz -C "$TEMP_DIR"
else
    wget -qO- "$DOWNLOAD_URL" | tar xz -C "$TEMP_DIR"
fi

# Find and move the binary
find "$TEMP_DIR" -name "erlang_ls" -type f -exec mv {} "${BIN_DIR}/${LSP_CMD}" \;
chmod +x "${BIN_DIR}/${LSP_CMD}"
echo "$LSP_CMD installed successfully" >&2

exec "${BIN_DIR}/${LSP_CMD}" "$@"
