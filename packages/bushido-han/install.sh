#!/bin/sh
# Han CLI Installer
# Usage: curl -fsSL https://han.guru/install.sh | sh
#    or: curl -fsSL https://raw.githubusercontent.com/TheBushidoCollective/han/main/packages/bushido-han/install.sh | sh

set -e

REPO="TheBushidoCollective/han"
INSTALL_DIR="${HAN_INSTALL_DIR:-$HOME/.han/bin}"
BINARY_NAME="han"

# Colors (if terminal supports it)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

info() {
    printf "${BLUE}info${NC}: %s\n" "$1"
}

success() {
    printf "${GREEN}success${NC}: %s\n" "$1"
}

warn() {
    printf "${YELLOW}warn${NC}: %s\n" "$1"
}

error() {
    printf "${RED}error${NC}: %s\n" "$1" >&2
    exit 1
}

# Detect OS and architecture
detect_platform() {
    OS="$(uname -s)"
    ARCH="$(uname -m)"

    case "$OS" in
        Linux)
            OS="linux"
            ;;
        Darwin)
            OS="darwin"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            OS="windows"
            ;;
        *)
            error "Unsupported operating system: $OS"
            ;;
    esac

    case "$ARCH" in
        x86_64|amd64)
            ARCH="x64"
            ;;
        arm64|aarch64)
            ARCH="arm64"
            ;;
        *)
            error "Unsupported architecture: $ARCH"
            ;;
    esac

    PLATFORM="${OS}-${ARCH}"

    # Windows binary has .exe extension
    if [ "$OS" = "windows" ]; then
        BINARY_NAME="han.exe"
        PLATFORM="windows-x64"
    fi
}

# Get latest release version
get_latest_version() {
    VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -z "$VERSION" ]; then
        error "Failed to get latest version"
    fi
}

# Download and install
install() {
    detect_platform
    get_latest_version

    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/han-${PLATFORM}"

    if [ "$OS" = "windows" ]; then
        DOWNLOAD_URL="${DOWNLOAD_URL}.exe"
    fi

    info "Installing Han CLI ${VERSION} for ${PLATFORM}..."
    info "Download URL: ${DOWNLOAD_URL}"

    # Create install directory
    mkdir -p "$INSTALL_DIR"

    # Download binary
    TEMP_FILE=$(mktemp)
    if ! curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_FILE"; then
        rm -f "$TEMP_FILE"
        error "Failed to download Han CLI"
    fi

    # Move to install directory
    mv "$TEMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"
    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

    success "Han CLI installed to ${INSTALL_DIR}/${BINARY_NAME}"

    # Check if install dir is in PATH
    case ":$PATH:" in
        *":${INSTALL_DIR}:"*)
            success "Han CLI is ready to use!"
            ;;
        *)
            warn "Add ${INSTALL_DIR} to your PATH:"
            echo ""
            echo "  For bash, add to ~/.bashrc:"
            echo "    export PATH=\"${INSTALL_DIR}:\$PATH\""
            echo ""
            echo "  For zsh, add to ~/.zshrc:"
            echo "    export PATH=\"${INSTALL_DIR}:\$PATH\""
            echo ""
            echo "  For fish, run:"
            echo "    fish_add_path ${INSTALL_DIR}"
            echo ""
            ;;
    esac

    # Verify installation
    if [ -x "${INSTALL_DIR}/${BINARY_NAME}" ]; then
        echo ""
        info "Verifying installation..."
        "${INSTALL_DIR}/${BINARY_NAME}" --version
    fi
}

# Uninstall
uninstall() {
    if [ -f "${INSTALL_DIR}/${BINARY_NAME}" ]; then
        rm -f "${INSTALL_DIR}/${BINARY_NAME}"
        success "Han CLI uninstalled"
    else
        warn "Han CLI not found at ${INSTALL_DIR}/${BINARY_NAME}"
    fi
}

# Main
case "${1:-}" in
    uninstall)
        uninstall
        ;;
    *)
        install
        ;;
esac
