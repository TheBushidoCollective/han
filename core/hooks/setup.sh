#!/usr/bin/env bash
#
# Han Setup Hook
#
# Ensures han binary is available before running hooks.
# Runs on plugin installation and periodically for maintenance.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

HAN_BIN_DIR="${HOME}/.claude/bin"
HAN_BIN="${HAN_BIN_DIR}/han"

# Check for hanBinary override in .claude/han.yml (local development)
# If set, skip installation entirely - user is using a custom binary path
HAN_CONFIG=".claude/han.yml"
if [ -f "${HAN_CONFIG}" ]; then
    if grep -q "^hanBinary:" "${HAN_CONFIG}" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Custom hanBinary configured in ${HAN_CONFIG}"
        echo "  Skipping installation (using local development binary)"
        exit 0
    fi
fi

# Check if han is already in PATH
if command -v han &> /dev/null; then
    echo -e "${GREEN}✓${NC} Han is already installed: $(command -v han)"
    han --version
    exit 0
fi

# Check if han exists in ~/.claude/bin
if [ -f "${HAN_BIN}" ]; then
    echo -e "${GREEN}✓${NC} Han binary found at ${HAN_BIN}"
    "${HAN_BIN}" --version

    # Add to PATH for this session
    export PATH="${HAN_BIN_DIR}:${PATH}"

    # Suggest adding to shell profile
    echo ""
    echo -e "${YELLOW}Note:${NC} Han is installed but not in your PATH."
    echo "Add this to your shell profile (~/.zshrc, ~/.bashrc, etc.):"
    echo ""
    echo "    export PATH=\"${HAN_BIN_DIR}:\${PATH}\""
    echo ""

    exit 0
fi

# Han not found - attempt installation
echo -e "${YELLOW}Han binary not found.${NC}"
echo ""
echo "The han plugin requires the han CLI to be installed."
echo ""
echo "Options:"
echo ""
echo "  1. ${BLUE}Auto-install via curl${NC} (recommended):"
echo "     curl -fsSL https://han.guru/install.sh | bash"
echo ""
echo "  2. ${BLUE}Install via Homebrew${NC}:"
echo "     brew install thebushidocollective/tap/han"
echo ""
echo "  3. ${BLUE}Download manually${NC} from:"
echo "     https://github.com/thebushidocollective/han/releases"
echo ""

# Check if we're in --init mode (first-time setup)
if [ "$1" = "--init" ] || [ "$1" = "--init-only" ]; then
    echo -e "${BLUE}Attempting auto-installation...${NC}"
    echo ""

    # Create bin directory if it doesn't exist
    mkdir -p "${HAN_BIN_DIR}"

    # Download install script and run
    if curl -fsSL https://han.guru/install.sh | bash; then
        echo ""
        echo -e "${GREEN}✓${NC} Han installed successfully!"
        "${HAN_BIN}" --version

        # Add to PATH for this session
        export PATH="${HAN_BIN_DIR}:${PATH}"

        echo ""
        echo -e "${GREEN}Setup complete!${NC} Han hooks will now work correctly."
        echo ""
        echo "To use han from your terminal, add to your shell profile:"
        echo ""
        echo "    export PATH=\"${HAN_BIN_DIR}:\${PATH}\""
        echo ""
        exit 0
    else
        echo ""
        echo -e "${RED}✗${NC} Auto-installation failed."
        echo ""
        echo "Please install han manually using one of the methods above."
        echo ""
        exit 1
    fi
fi

# Not in init mode - just warn and exit successfully
# (hooks will fail gracefully with command not found)
echo ""
echo -e "${YELLOW}Skipping auto-installation.${NC}"
echo "Run one of the commands above to install han."
echo ""
echo "Once installed, han hooks will work automatically."
echo ""

# Exit 0 to not block plugin installation
exit 0
