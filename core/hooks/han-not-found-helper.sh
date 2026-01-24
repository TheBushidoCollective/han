#!/usr/bin/env bash
#
# Helper shown when 'han' command not found
# This wrapper catches command not found errors and provides helpful guidance

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${RED}✗ Han binary not found${NC}"
echo ""
echo "The han plugin requires the han CLI, but it's not installed or not in PATH."
echo ""
echo -e "${BLUE}Quick Fix:${NC}"
echo ""
echo "  Install via curl (recommended):"
echo "    ${YELLOW}curl -fsSL https://han.guru/install.sh | bash${NC}"
echo ""
echo "  Or via Homebrew:"
echo "    ${YELLOW}brew install thebushidocollective/tap/han${NC}"
echo ""
echo "After installing, restart your Claude Code session."
echo ""
echo "For more help, visit: https://han.guru/docs/installation"
echo ""

exit 127  # Command not found exit code
