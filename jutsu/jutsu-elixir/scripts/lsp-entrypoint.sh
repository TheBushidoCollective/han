#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="expert"
BIN_DIR="${HOME}/.claude/bin"

# Check if already installed
if command -v "$LSP_CMD" &> /dev/null; then
    exec "$LSP_CMD" "$@"
fi

if [[ -x "${BIN_DIR}/${LSP_CMD}" ]]; then
    exec "${BIN_DIR}/${LSP_CMD}" "$@"
fi

echo "Installing Elixir Expert LSP..." >&2

# Determine platform
case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) PLATFORM="darwin_arm64" ;;
    Darwin-x86_64) PLATFORM="darwin_amd64" ;;
    Linux-x86_64) PLATFORM="linux_amd64" ;;
    Linux-aarch64) PLATFORM="linux_arm64" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows_amd64"; EXT=".exe" ;;
    *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

mkdir -p "$BIN_DIR"

BINARY="${BIN_DIR}/${LSP_CMD}${EXT:-}"
DOWNLOAD_URL="https://github.com/elixir-lang/expert/releases/download/nightly/expert_${PLATFORM}${EXT:-}"

if command -v curl &>/dev/null; then
    curl -fsSL "$DOWNLOAD_URL" -o "$BINARY"
elif command -v wget &>/dev/null; then
    wget -q "$DOWNLOAD_URL" -O "$BINARY"
else
    echo "Neither curl nor wget found" >&2
    exit 1
fi

chmod +x "$BINARY"
echo "Elixir Expert LSP installed to ${BINARY}" >&2

exec "$BINARY" "$@"
