#!/bin/bash
# Create npm platform-specific package
# Usage: ./create-npm-platform-package.sh v3.4.1 linux-x64 han-linux-x64

set -e

VERSION="${1#v}"
PLATFORM="$2"
ARTIFACT="$3"

mkdir -p package

# Copy binary (handle .exe for Windows)
if [ -f "artifact/${ARTIFACT}.exe" ]; then
  cp "artifact/${ARTIFACT}.exe" package/han.exe
else
  cp "artifact/${ARTIFACT}" package/han
  chmod +x package/han
fi

# Copy coordinator binary if present
if [ -f "artifact/han-coordinator.exe" ]; then
  cp "artifact/han-coordinator.exe" package/han-coordinator.exe
elif [ -f "artifact/han-coordinator" ]; then
  cp "artifact/han-coordinator" package/han-coordinator
  chmod +x package/han-coordinator
fi

# Determine bin entry based on platform
if [[ "$PLATFORM" == win32-* ]]; then
  BIN_ENTRY="han.exe"
else
  BIN_ENTRY="han"
fi

# Create package.json
cat > package/package.json << EOF
{
  "name": "@thebushidocollective/han-${PLATFORM}",
  "version": "${VERSION}",
  "description": "Han CLI binary for ${PLATFORM}",
  "homepage": "https://han.guru",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/TheBushidoCollective/han"
  },
  "bin": {
    "han": "./${BIN_ENTRY}"
  },
  "os": ["${PLATFORM%-*}"],
  "cpu": ["${PLATFORM#*-}"]
}
EOF

# Create README
cat > package/README.md << EOF
# Han CLI - ${PLATFORM}

Platform-specific binary for [Han](https://han.guru), a Claude Code plugin marketplace.

This package is automatically installed as a fallback when GitHub releases are unavailable.
EOF

echo "Package contents:"
ls -la package/
