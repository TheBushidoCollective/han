#!/usr/bin/env bash
set -e

BIN_DIR="${HOME}/.claude/bin"
LSP_NAME="gleam"

# Determine platform
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) PLATFORM="aarch64-apple-darwin" ;;
  Darwin-x86_64) PLATFORM="x86_64-apple-darwin" ;;
  Linux-x86_64) PLATFORM="x86_64-unknown-linux-musl" ;;
  Linux-aarch64) PLATFORM="aarch64-unknown-linux-musl" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="x86_64-pc-windows-msvc"; EXT=".exe" ;;
  *) echo "Unsupported platform" >&2; exit 0 ;;
esac

BINARY="${BIN_DIR}/${LSP_NAME}${EXT:-}"

# Skip if already installed
[[ -x "$BINARY" ]] && exit 0

mkdir -p "$BIN_DIR"
echo "Installing Gleam..." >&2

# Get latest version using han parse (removes jq/grep dependency)
LATEST_VERSION=$(curl -fsSL https://api.github.com/repos/gleam-lang/gleam/releases/latest | han parse json tag_name -r 2>/dev/null | sed 's/^v//')

DOWNLOAD_URL="https://github.com/gleam-lang/gleam/releases/download/v${LATEST_VERSION}/gleam-v${LATEST_VERSION}-${PLATFORM}.tar.gz"

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

if command -v curl &>/dev/null; then
  curl -fsSL "$DOWNLOAD_URL" | tar xz -C "$TEMP_DIR"
else
  wget -qO- "$DOWNLOAD_URL" | tar xz -C "$TEMP_DIR"
fi

mv "$TEMP_DIR/gleam" "$BINARY"
chmod +x "$BINARY"
echo "Gleam installed to ${BINARY}" >&2
