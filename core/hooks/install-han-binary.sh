#!/usr/bin/env bash
# Install/update han binary to $CLAUDE_CONFIG_DIR/bin

set -e

# Ensure CLAUDE_CONFIG_DIR is set
if [ -z "$CLAUDE_CONFIG_DIR" ]; then
  CLAUDE_CONFIG_DIR="${HOME}/.claude"
fi

BIN_DIR="${CLAUDE_CONFIG_DIR}/bin"
HAN_BIN="${BIN_DIR}/han"

# Create bin directory if it doesn't exist
mkdir -p "$BIN_DIR"

# Detect platform and architecture
detect_platform() {
  local os="$(uname -s)"
  local arch="$(uname -m)"

  case "$os" in
    Darwin)
      case "$arch" in
        arm64|aarch64) echo "darwin-arm64" ;;
        x86_64|amd64) echo "darwin-x64" ;;
        *) echo "unsupported-arch" ;;
      esac
      ;;
    Linux)
      case "$arch" in
        arm64|aarch64) echo "linux-arm64" ;;
        x86_64|amd64) echo "linux-x64" ;;
        *) echo "unsupported-arch" ;;
      esac
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "win32-x64"
      ;;
    *)
      echo "unsupported-os"
      ;;
  esac
}

PLATFORM=$(detect_platform)

if [ "$PLATFORM" = "unsupported-os" ] || [ "$PLATFORM" = "unsupported-arch" ]; then
  echo "Unsupported platform: $(uname -s) $(uname -m)" >&2
  echo "Falling back to npx for han execution" >&2
  exit 0
fi

# Get latest version from GitHub API
get_latest_version() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "https://api.github.com/repos/TheBushidoCollective/han/releases/latest" | \
      grep '"tag_name":' | \
      sed -E 's/.*"tag_name": "v?([^"]+)".*/\1/'
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "https://api.github.com/repos/TheBushidoCollective/han/releases/latest" | \
      grep '"tag_name":' | \
      sed -E 's/.*"tag_name": "v?([^"]+)".*/\1/'
  else
    echo "Neither curl nor wget found. Cannot download han binary." >&2
    exit 0
  fi
}

# Check if han binary exists and get its version
get_installed_version() {
  if [ -x "$HAN_BIN" ]; then
    "$HAN_BIN" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown"
  else
    echo "none"
  fi
}

INSTALLED_VERSION=$(get_installed_version)
LATEST_VERSION=$(get_latest_version)

if [ -z "$LATEST_VERSION" ]; then
  echo "Could not determine latest version. Skipping han binary installation." >&2
  exit 0
fi

# Only download if we don't have it or if there's a newer version
if [ "$INSTALLED_VERSION" != "$LATEST_VERSION" ]; then
  echo "Installing han binary v$LATEST_VERSION to $HAN_BIN..." >&2

  DOWNLOAD_URL="https://github.com/TheBushidoCollective/han/releases/download/v${LATEST_VERSION}/han-${PLATFORM}"

  # Download binary
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$DOWNLOAD_URL" -o "$HAN_BIN"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$HAN_BIN" "$DOWNLOAD_URL"
  else
    echo "Neither curl nor wget found. Cannot download han binary." >&2
    exit 0
  fi

  # Make it executable
  chmod +x "$HAN_BIN"

  echo "Han binary v$LATEST_VERSION installed successfully to $HAN_BIN" >&2
else
  # Binary is up to date, no output needed
  :
fi

exit 0
