#!/usr/bin/env bash
set -euo pipefail

# Eclipse JDT Language Server (jdtls) entrypoint
# Installation is complex - requires Eclipse download and proper Java setup

BIN_DIR="${HOME}/.claude/bin"
JDTLS_DIR="${HOME}/.claude/lsp/jdtls"
LSP_CMD="jdtls"

# Check if jdtls is in PATH or our bin directory
if command -v "$LSP_CMD" &> /dev/null; then
    exec "$LSP_CMD" "$@"
fi

if [[ -x "${BIN_DIR}/${LSP_CMD}" ]]; then
    exec "${BIN_DIR}/${LSP_CMD}" "$@"
fi

# Check if we have a local installation
if [[ -x "${JDTLS_DIR}/bin/jdtls" ]]; then
    exec "${JDTLS_DIR}/bin/jdtls" "$@"
fi

# Attempt installation via coursier if available
if command -v cs &> /dev/null || command -v coursier &> /dev/null; then
    echo "Installing jdtls via coursier..." >&2
    CS_CMD=$(command -v cs || command -v coursier)
    "$CS_CMD" install jdtls --install-dir "$BIN_DIR"
    if [[ -x "${BIN_DIR}/${LSP_CMD}" ]]; then
        exec "${BIN_DIR}/${LSP_CMD}" "$@"
    fi
fi

# Try to install coursier and then jdtls
echo "Installing coursier and jdtls..." >&2
mkdir -p "$BIN_DIR"

# Determine platform for coursier
case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) CS_PLATFORM="cs-aarch64-apple-darwin" ;;
    Darwin-x86_64) CS_PLATFORM="cs-x86_64-apple-darwin" ;;
    Linux-x86_64) CS_PLATFORM="cs-x86_64-pc-linux" ;;
    Linux-aarch64) CS_PLATFORM="cs-aarch64-pc-linux" ;;
    *)
        echo "Error: Unsupported platform for automatic installation." >&2
        echo "Please install jdtls manually:" >&2
        echo "  Option 1: Install via coursier - https://get-coursier.io/" >&2
        echo "    cs install jdtls" >&2
        echo "  Option 2: Download from Eclipse - https://download.eclipse.org/jdtls/snapshots/" >&2
        exit 1
        ;;
esac

# Download and install coursier
CS_URL="https://github.com/coursier/launchers/raw/master/${CS_PLATFORM}.gz"
CS_BIN="${BIN_DIR}/cs"

if command -v curl &>/dev/null; then
    curl -fsSL "$CS_URL" | gunzip > "$CS_BIN"
else
    wget -qO- "$CS_URL" | gunzip > "$CS_BIN"
fi
chmod +x "$CS_BIN"

# Install jdtls using coursier
"$CS_BIN" install jdtls --install-dir "$BIN_DIR"

if [[ -x "${BIN_DIR}/${LSP_CMD}" ]]; then
    echo "jdtls installed to ${BIN_DIR}/${LSP_CMD}" >&2
    exec "${BIN_DIR}/${LSP_CMD}" "$@"
fi

echo "Error: Failed to install jdtls" >&2
exit 1
