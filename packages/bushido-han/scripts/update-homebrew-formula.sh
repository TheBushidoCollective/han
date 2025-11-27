#!/bin/bash
# Updates the Homebrew formula with SHA256 checksums from the release
set -e

VERSION="${1:-}"
FORMULA_PATH="${2:-Formula/han.rb}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version> [formula-path]"
  echo "Example: $0 1.17.0"
  exit 1
fi

# Remove v prefix if present
VERSION="${VERSION#v}"

REPO="TheBushidoCollective/han"
BASE_URL="https://github.com/${REPO}/releases/download/v${VERSION}"

echo "Updating formula for version ${VERSION}..."

# Download checksum files
DARWIN_ARM64_SHA=$(curl -fsSL "${BASE_URL}/han-darwin-arm64.sha256" | awk '{print $1}')
DARWIN_X64_SHA=$(curl -fsSL "${BASE_URL}/han-darwin-x64.sha256" | awk '{print $1}')
LINUX_ARM64_SHA=$(curl -fsSL "${BASE_URL}/han-linux-arm64.sha256" | awk '{print $1}')
LINUX_X64_SHA=$(curl -fsSL "${BASE_URL}/han-linux-x64.sha256" | awk '{print $1}')

echo "SHA256 checksums:"
echo "  darwin-arm64: ${DARWIN_ARM64_SHA}"
echo "  darwin-x64:   ${DARWIN_X64_SHA}"
echo "  linux-arm64:  ${LINUX_ARM64_SHA}"
echo "  linux-x64:    ${LINUX_X64_SHA}"

# Update formula
sed -i.bak \
  -e "s/version \".*\"/version \"${VERSION}\"/" \
  -e "s/PLACEHOLDER_DARWIN_ARM64_SHA256/${DARWIN_ARM64_SHA}/" \
  -e "s/PLACEHOLDER_DARWIN_X64_SHA256/${DARWIN_X64_SHA}/" \
  -e "s/PLACEHOLDER_LINUX_ARM64_SHA256/${LINUX_ARM64_SHA}/" \
  -e "s/PLACEHOLDER_LINUX_X64_SHA256/${LINUX_X64_SHA}/" \
  -e "s/sha256 \"[a-f0-9]*\"  # darwin-arm64/sha256 \"${DARWIN_ARM64_SHA}\"  # darwin-arm64/" \
  -e "s/sha256 \"[a-f0-9]*\"  # darwin-x64/sha256 \"${DARWIN_X64_SHA}\"  # darwin-x64/" \
  -e "s/sha256 \"[a-f0-9]*\"  # linux-arm64/sha256 \"${LINUX_ARM64_SHA}\"  # linux-arm64/" \
  -e "s/sha256 \"[a-f0-9]*\"  # linux-x64/sha256 \"${LINUX_X64_SHA}\"  # linux-x64/" \
  "$FORMULA_PATH"

rm -f "${FORMULA_PATH}.bak"

echo "Formula updated at ${FORMULA_PATH}"
