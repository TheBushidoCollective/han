#!/usr/bin/env bash
set -e

BIN_DIR="${HOME}/.claude/bin"
LSP_NAME="rust-analyzer"

# Determine platform
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) PLATFORM="aarch64-apple-darwin" ;;
  Darwin-x86_64) PLATFORM="x86_64-apple-darwin" ;;
  Linux-x86_64) PLATFORM="x86_64-unknown-linux-gnu" ;;
  Linux-aarch64) PLATFORM="aarch64-unknown-linux-gnu" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="x86_64-pc-windows-msvc"; EXT=".exe" ;;
  *) echo "Unsupported platform" >&2; exit 0 ;;
esac

BINARY="${BIN_DIR}/${LSP_NAME}${EXT:-}"

# Skip if already installed
[[ -x "$BINARY" ]] && exit 0

mkdir -p "$BIN_DIR"
echo "Installing rust-analyzer..." >&2

# Download from GitHub releases
DOWNLOAD_URL="https://github.com/rust-lang/rust-analyzer/releases/latest/download/rust-analyzer-${PLATFORM}.gz"

if command -v curl &>/dev/null; then
  curl -fsSL "$DOWNLOAD_URL" | gunzip > "$BINARY"
else
  wget -qO- "$DOWNLOAD_URL" | gunzip > "$BINARY"
fi

chmod +x "$BINARY"
echo "✓ rust-analyzer installed to ${BINARY}" >&2
