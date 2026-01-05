#!/usr/bin/env bash
set -euo pipefail

# Kotlin Language Server entrypoint
# Installs via GitHub releases or SDKMAN if needed

BIN_DIR="${HOME}/.claude/bin"
LSP_CMD="kotlin-language-server"
VERSION="1.3.9"

# Check if kotlin-language-server is in PATH or our bin directory
if command -v "$LSP_CMD" &> /dev/null; then
    exec "$LSP_CMD" "$@"
fi

if [[ -x "${BIN_DIR}/${LSP_CMD}" ]]; then
    exec "${BIN_DIR}/${LSP_CMD}" "$@"
fi

# Check in SDKMAN candidates
SDKMAN_KLS="${HOME}/.sdkman/candidates/kls/current/bin/kotlin-language-server"
if [[ -x "$SDKMAN_KLS" ]]; then
    exec "$SDKMAN_KLS" "$@"
fi

echo "Installing kotlin-language-server..." >&2
mkdir -p "$BIN_DIR"

# Determine platform
case "$(uname -s)" in
    Darwin|Linux)
        # ARCHIVE_EXT would be "zip" on Windows/Darwin if needed
        ;;
    MINGW*|MSYS*|CYGWIN*)
        # ARCHIVE_EXT would be "zip" on Windows/Darwin if needed
        ;;
    *)
        echo "Error: Unsupported platform" >&2
        exit 1
        ;;
esac

# Download from GitHub releases
DOWNLOAD_URL="https://github.com/fwcd/kotlin-language-server/releases/download/${VERSION}/server.zip"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

if command -v curl &>/dev/null; then
    curl -fsSL "$DOWNLOAD_URL" -o "${TMP_DIR}/server.zip"
else
    wget -q "$DOWNLOAD_URL" -O "${TMP_DIR}/server.zip"
fi

# Extract
if command -v unzip &>/dev/null; then
    unzip -q "${TMP_DIR}/server.zip" -d "${TMP_DIR}"
else
    echo "Error: unzip is required but not installed" >&2
    exit 1
fi

# Install the server
KLS_INSTALL_DIR="${HOME}/.claude/lsp/kotlin-language-server"
rm -rf "$KLS_INSTALL_DIR"
mkdir -p "$KLS_INSTALL_DIR"
mv "${TMP_DIR}/server/"* "$KLS_INSTALL_DIR/"
chmod +x "${KLS_INSTALL_DIR}/bin/kotlin-language-server"

# Create symlink in bin directory
ln -sf "${KLS_INSTALL_DIR}/bin/kotlin-language-server" "${BIN_DIR}/${LSP_CMD}"

echo "kotlin-language-server installed to ${BIN_DIR}/${LSP_CMD}" >&2
exec "${BIN_DIR}/${LSP_CMD}" "$@"
