#!/usr/bin/env bash
#
# Embedded Han installer for core plugin
#
# Downloads han binary from GitHub releases.
# Used by han-wrapper.sh for auto-install in ephemeral environments.
#
# Environment variables:
#   HAN_INSTALL_TARGET - Binary name (default: "han", wrapper sets "han-bin")
#

set -e

BIN_DIR="${HOME}/.local/bin"
HAN_BIN="${BIN_DIR}/${HAN_INSTALL_TARGET:-han}"

mkdir -p "$BIN_DIR"

# Detect platform
detect_platform() {
    local os arch
    os="$(uname -s)"
    arch="$(uname -m)"

    case "$os" in
        Darwin)
            case "$arch" in
                arm64|aarch64) echo "darwin-arm64" ;;
                x86_64|amd64) echo "darwin-x64" ;;
                *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
            esac
            ;;
        Linux)
            case "$arch" in
                arm64|aarch64) echo "linux-arm64" ;;
                x86_64|amd64) echo "linux-x64" ;;
                *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
            esac
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "win32-x64"
            ;;
        *)
            echo "Unsupported OS: $os" >&2
            exit 1
            ;;
    esac
}

PLATFORM=$(detect_platform)

# Get latest version from GitHub API
get_latest_version() {
    curl -fsSL "https://api.github.com/repos/TheBushidoCollective/han/releases/latest" 2>/dev/null |
        grep '"tag_name":' |
        sed -E 's/.*"tag_name": "v?([^"]+)".*/\1/'
}

VERSION=$(get_latest_version)
if [ -z "$VERSION" ]; then
    echo "Failed to get latest version" >&2
    exit 1
fi

DOWNLOAD_URL="https://github.com/TheBushidoCollective/han/releases/download/v${VERSION}/han-${PLATFORM}"

# Download to temp file for atomic replacement
TEMP_BIN="${HAN_BIN}.tmp.$$"
trap 'rm -f "$TEMP_BIN"' EXIT

curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_BIN"
chmod +x "$TEMP_BIN"
mv -f "$TEMP_BIN" "$HAN_BIN"

echo "Installed han v${VERSION} to ${HAN_BIN}" >&2
