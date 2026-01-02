#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="crystalline"
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
    Darwin-arm64) PLATFORM="darwin-arm64" ;;
    Darwin-x86_64) PLATFORM="darwin-x86_64" ;;
    Linux-x86_64) PLATFORM="linux-x86_64" ;;
    Linux-aarch64) PLATFORM="linux-aarch64" ;;
    *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

# Try brew first on macOS
if [[ "$(uname -s)" == "Darwin" ]] && command -v brew &> /dev/null; then
    brew install crystalline
    exec "$LSP_CMD" "$@"
fi

# Download from GitHub releases
mkdir -p "$BIN_DIR"

LATEST_VERSION=$(curl -fsSL https://api.github.com/repos/elbywan/crystalline/releases/latest | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
DOWNLOAD_URL="https://github.com/elbywan/crystalline/releases/download/${LATEST_VERSION}/crystalline-${PLATFORM}.gz"

if command -v curl &>/dev/null; then
    curl -fsSL "$DOWNLOAD_URL" | gunzip > "${BIN_DIR}/${LSP_CMD}"
else
    wget -qO- "$DOWNLOAD_URL" | gunzip > "${BIN_DIR}/${LSP_CMD}"
fi

chmod +x "${BIN_DIR}/${LSP_CMD}"
echo "$LSP_CMD installed successfully" >&2

exec "${BIN_DIR}/${LSP_CMD}" "$@"
