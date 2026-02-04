#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="lua-language-server"
BIN_DIR="${HOME}/.claude/bin"
INSTALL_DIR="${HOME}/.claude/lsp/lua-language-server"

# Check if wrapper exists and works
if [[ -x "${BIN_DIR}/${LSP_CMD}" ]]; then
    exec "${BIN_DIR}/${LSP_CMD}" "$@"
fi

# Check if command is in PATH
if command -v "$LSP_CMD" &> /dev/null; then
    exec "$LSP_CMD" "$@"
fi

echo "Installing $LSP_CMD..." >&2

# Determine platform
case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) PLATFORM="darwin-arm64" ;;
    Darwin-x86_64) PLATFORM="darwin-x64" ;;
    Linux-x86_64) PLATFORM="linux-x64" ;;
    Linux-aarch64) PLATFORM="linux-arm64" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="win32-x64" ;;  # EXT=".exe" if needed
    *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

# Try brew first on macOS
if [[ "$(uname -s)" == "Darwin" ]] && command -v brew &> /dev/null; then
    brew install lua-language-server
    exec "$LSP_CMD" "$@"
fi

# Download from GitHub releases
mkdir -p "$BIN_DIR" "$INSTALL_DIR"

LATEST_VERSION=$(curl -fsSL https://api.github.com/repos/LuaLS/lua-language-server/releases/latest | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
DOWNLOAD_URL="https://github.com/LuaLS/lua-language-server/releases/download/${LATEST_VERSION}/lua-language-server-${LATEST_VERSION}-${PLATFORM}.tar.gz"

if command -v curl &>/dev/null; then
    curl -fsSL "$DOWNLOAD_URL" | tar xz -C "$INSTALL_DIR"
else
    wget -qO- "$DOWNLOAD_URL" | tar xz -C "$INSTALL_DIR"
fi

# Create wrapper script
cat > "${BIN_DIR}/${LSP_CMD}" << 'WRAPPER'
#!/usr/bin/env bash
exec "${HOME}/.claude/lsp/lua-language-server/bin/lua-language-server" "$@"
WRAPPER

chmod +x "${BIN_DIR}/${LSP_CMD}"
echo "$LSP_CMD installed successfully" >&2

exec "${BIN_DIR}/${LSP_CMD}" "$@"
