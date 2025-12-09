#!/usr/bin/env bash
# Han installation script
# Usage: curl -fsSL https://han.guru/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Install to user's local bin directory
BIN_DIR="${HOME}/.local/bin"
HAN_BIN="${BIN_DIR}/han"

echo -e "${GREEN}Installing han binary to $HAN_BIN...${NC}"

# Create bin directory if it doesn't exist
mkdir -p "$BIN_DIR"

# Detect platform and architecture
detect_platform() {
	local os
	local arch
	os="$(uname -s)"
	arch="$(uname -m)"

	case "$os" in
	Darwin)
		case "$arch" in
		arm64 | aarch64) echo "darwin-arm64" ;;
		x86_64 | amd64) echo "darwin-x64" ;;
		*)
			echo -e "${RED}Unsupported architecture: $arch${NC}" >&2
			exit 1
			;;
		esac
		;;
	Linux)
		case "$arch" in
		arm64 | aarch64) echo "linux-arm64" ;;
		x86_64 | amd64) echo "linux-x64" ;;
		*)
			echo -e "${RED}Unsupported architecture: $arch${NC}" >&2
			exit 1
			;;
		esac
		;;
	MINGW* | MSYS* | CYGWIN*)
		echo "win32-x64"
		;;
	*)
		echo -e "${RED}Unsupported operating system: $os${NC}" >&2
		exit 1
		;;
	esac
}

PLATFORM=$(detect_platform)

# Get latest version from GitHub API
echo -e "${YELLOW}Fetching latest version...${NC}"
get_latest_version() {
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "https://api.github.com/repos/TheBushidoCollective/han/releases/latest" |
			grep '"tag_name":' |
			sed -E 's/.*"tag_name": "v?([^"]+)".*/\1/'
	elif command -v wget >/dev/null 2>&1; then
		wget -qO- "https://api.github.com/repos/TheBushidoCollective/han/releases/latest" |
			grep '"tag_name":' |
			sed -E 's/.*"tag_name": "v?([^"]+)".*/\1/'
	else
		echo -e "${RED}Neither curl nor wget found. Cannot download han binary.${NC}" >&2
		exit 1
	fi
}

LATEST_VERSION=$(get_latest_version)

if [ -z "$LATEST_VERSION" ]; then
	echo -e "${RED}Could not determine latest version.${NC}" >&2
	exit 1
fi

echo -e "${GREEN}Installing han v$LATEST_VERSION...${NC}"

DOWNLOAD_URL="https://github.com/TheBushidoCollective/han/releases/download/v${LATEST_VERSION}/han-${PLATFORM}"

# Download binary
if command -v curl >/dev/null 2>&1; then
	curl -fsSL "$DOWNLOAD_URL" -o "$HAN_BIN"
elif command -v wget >/dev/null 2>&1; then
	wget -qO "$HAN_BIN" "$DOWNLOAD_URL"
else
	echo -e "${RED}Neither curl nor wget found. Cannot download han binary.${NC}" >&2
	exit 1
fi

# Make it executable
chmod +x "$HAN_BIN"

echo -e "${GREEN}✓ Han v$LATEST_VERSION installed successfully!${NC}"
echo ""
echo -e "Han binary installed to: ${YELLOW}$HAN_BIN${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo ""
echo "  1. Ensure $BIN_DIR is in your PATH"
echo "     Add this to your shell rc file (.bashrc, .zshrc, etc.):"
echo ""
echo -e "     ${YELLOW}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
echo ""
echo "  2. Reload your shell or run:"
echo ""
echo -e "     ${YELLOW}source ~/.bashrc${NC}  # or ~/.zshrc"
echo ""
echo "  3. Install plugins for your project:"
echo ""
echo -e "     ${YELLOW}han plugin install --auto${NC}"
echo ""
echo "  4. Or browse and install specific plugins:"
echo ""
echo -e "     ${YELLOW}han plugin install${NC}"
echo ""
echo -e "For more information, visit ${GREEN}https://han.guru${NC}"
