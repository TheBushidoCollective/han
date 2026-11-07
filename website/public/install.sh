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
# HAN_INSTALL_TARGET allows wrapper to specify 'han-bin' while manual installs use 'han'
BIN_DIR="${HAN_INSTALL_DIR:-${HOME}/.local/bin}"
BIN_DIR="${BIN_DIR//\\//}"
HAN_TARGET="${HAN_INSTALL_TARGET:-han}"
HAN_TARGET="${HAN_TARGET//\\//}"
HAN_BIN="${BIN_DIR}/${HAN_TARGET}"

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
		case "$arch" in
		x86_64 | amd64) echo "windows-x64" ;;
		*) echo -e "${RED}Unsupported architecture: $arch${NC}" >&2; exit 1 ;;
		esac
		;;
	*)
		echo -e "${RED}Unsupported operating system: $os${NC}" >&2
		exit 1
		;;
	esac
}

PLATFORM=$(detect_platform)

# Windows binaries are published with a .exe suffix; everything else is bare.
case "$PLATFORM" in
windows-*)
	BINARY_SUFFIX=".exe"
	HAN_BIN="${HAN_BIN}.exe"
	;;
*)
	BINARY_SUFFIX=""
	;;
esac

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

LATEST_VERSION="${HAN_VERSION:-$(get_latest_version)}"

if [ -z "$LATEST_VERSION" ]; then
	echo -e "${RED}Could not determine latest version.${NC}" >&2
	exit 1
fi

echo -e "${GREEN}Installing han v$LATEST_VERSION...${NC}"

DOWNLOAD_BASE="${HAN_RELEASE_DOWNLOAD_BASE:-https://github.com/TheBushidoCollective/han/releases/download}"
BASE_URL="${DOWNLOAD_BASE}/v${LATEST_VERSION}"
TEMP_DIR=$(mktemp -d "${BIN_DIR}/.han-install.XXXXXXXX")
RELEASE_DIR=""
cleanup() {
	rm -rf "$TEMP_DIR"
	if [ -n "$RELEASE_DIR" ]; then
		rm -rf "$RELEASE_DIR"
	fi
}
trap cleanup EXIT

download() {
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$1" -o "$2"
	elif command -v wget >/dev/null 2>&1; then
		wget -qO "$2" "$1"
	else
		echo "Neither curl nor wget found." >&2
		return 1
	fi
}

download_verified() {
	local asset="$1"
	local expected actual
	echo -e "${YELLOW}Downloading and verifying ${asset}...${NC}"
	download "${BASE_URL}/${asset}" "${TEMP_DIR}/${asset}"
	download "${BASE_URL}/${asset}.sha256" "${TEMP_DIR}/${asset}.sha256"
	expected=$(awk 'NR == 1 {print $1}' "${TEMP_DIR}/${asset}.sha256")
	if ! [[ "$expected" =~ ^[[:xdigit:]]{64}$ ]]; then
		echo "Invalid checksum for ${asset}" >&2
		return 1
	fi
	if command -v sha256sum >/dev/null 2>&1; then
		actual=$(sha256sum "${TEMP_DIR}/${asset}" | awk '{print $1}')
	elif command -v shasum >/dev/null 2>&1; then
		actual=$(shasum -a 256 "${TEMP_DIR}/${asset}" | awk '{print $1}')
	else
		echo "A SHA-256 utility is required." >&2
		return 1
	fi
	if [ "$expected" != "$actual" ]; then
		echo "Checksum verification failed for ${asset}" >&2
		return 1
	fi
	chmod +x "${TEMP_DIR}/${asset}"
}

CLI_ASSET="han-${PLATFORM}${BINARY_SUFFIX}"
COORDINATOR_ASSET="han-coordinator-${PLATFORM}${BINARY_SUFFIX}"
download_verified "$CLI_ASSET"
download_verified "$COORDINATOR_ASSET"

# Publish a complete pair per K6 install layout
if [ -n "$BINARY_SUFFIX" ]; then
	# Delete leftover *.old-* from previous installs
	rm -f "${BIN_DIR}"/*.old-* 2>/dev/null || true

	# Coordinator first: rename existing to .old-<rand> and move verified new file in
	COORD_BIN="${BIN_DIR}/han-coordinator.exe"
	if [ -f "$COORD_BIN" ]; then
		RAND_SUFFIX="${RANDOM}${RANDOM}"
		mv "$COORD_BIN" "${BIN_DIR}/han-coordinator.old-${RAND_SUFFIX}" || true
	fi
	mv "${TEMP_DIR}/${COORDINATOR_ASSET}" "$COORD_BIN"

	# CLI binary next: rename existing to .old-<rand> and move verified new file in
	if [ -f "$HAN_BIN" ]; then
		RAND_SUFFIX="${RANDOM}${RANDOM}"
		mv "$HAN_BIN" "${BIN_DIR}/han.old-${RAND_SUFFIX}" || true
	fi
	mv "${TEMP_DIR}/${CLI_ASSET}" "$HAN_BIN"
	RELEASE_DIR=""
else
	# POSIX: store in .han-releases/<name>/{han,han-coordinator} with symlink
	mkdir -p "${BIN_DIR}/.han-releases"
	RELEASE_NAME="$(basename "$TEMP_DIR")"
	RELEASE_DIR="${BIN_DIR}/.han-releases/${RELEASE_NAME}"
	mkdir -p "$RELEASE_DIR"
	mv "${TEMP_DIR}/${CLI_ASSET}" "${RELEASE_DIR}/han"
	mv "${TEMP_DIR}/${COORDINATOR_ASSET}" "${RELEASE_DIR}/han-coordinator"

	# Delete stale regular file at $BIN/han-coordinator when publishing symlink
	if [ -f "${BIN_DIR}/han-coordinator" ] && [ ! -L "${BIN_DIR}/han-coordinator" ]; then
		rm -f "${BIN_DIR}/han-coordinator"
	fi

	ln -s ".han-releases/${RELEASE_NAME}/han" "${TEMP_DIR}/han-link"
	# Once the pair is complete, keep it even if publishing is interrupted.
	RELEASE_DIR=""
	mv -f "${TEMP_DIR}/han-link" "$HAN_BIN"

	# Prune to the current pair and one previous pair
	if [ -d "${BIN_DIR}/.han-releases" ]; then
		(
			cd "${BIN_DIR}/.han-releases" 2>/dev/null || exit 0
			ls -1dt .han-install.* 2>/dev/null | tail -n +3 | while read -r old_rel; do
				if [ -n "$old_rel" ]; then
					rm -rf "$old_rel"
				fi
			done
		)
	fi
fi
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
