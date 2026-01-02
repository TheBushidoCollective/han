#!/usr/bin/env bash
set -e

BIN_DIR="${HOME}/.claude/bin"
LSP_NAME="lua-language-server"

# Determine platform
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) PLATFORM="darwin-arm64" ;;
  Darwin-x86_64) PLATFORM="darwin-x64" ;;
  Linux-x86_64) PLATFORM="linux-x64" ;;
  Linux-aarch64) PLATFORM="linux-arm64" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="win32-x64"; EXT=".exe" ;;
  *) echo "Unsupported platform" >&2; exit 0 ;;
esac

BINARY="${BIN_DIR}/${LSP_NAME}${EXT:-}"

# Skip if already installed
[[ -x "$BINARY" ]] && exit 0

mkdir -p "$BIN_DIR"
echo "Installing lua-language-server..." >&2

# Get latest version
LATEST_VERSION=$(curl -fsSL https://api.github.com/repos/LuaLS/lua-language-server/releases/latest | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

DOWNLOAD_URL="https://github.com/LuaLS/lua-language-server/releases/download/${LATEST_VERSION}/lua-language-server-${LATEST_VERSION}-${PLATFORM}.tar.gz"

INSTALL_DIR="${HOME}/.claude/lsp/lua-language-server"
mkdir -p "$INSTALL_DIR"

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

if command -v curl &>/dev/null; then
  curl -fsSL "$DOWNLOAD_URL" | tar xz -C "$INSTALL_DIR"
else
  wget -qO- "$DOWNLOAD_URL" | tar xz -C "$INSTALL_DIR"
fi

# Create wrapper script in bin directory
cat > "$BINARY" << 'WRAPPER'
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${HOME}/.claude/lsp/lua-language-server/bin/lua-language-server" "$@"
WRAPPER

chmod +x "$BINARY"
echo "✓ lua-language-server installed" >&2
