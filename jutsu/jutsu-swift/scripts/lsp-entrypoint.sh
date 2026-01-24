#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="sourcekit-lsp"

# Check if available (usually bundled with Xcode on macOS)
if command -v "$LSP_CMD" &> /dev/null; then
    exec "$LSP_CMD" "$@"
fi

# Check common Xcode toolchain locations on macOS
if [[ "$(uname -s)" == "Darwin" ]]; then
    # Try xcrun to find it
    if command -v xcrun &> /dev/null; then
        SOURCEKIT_PATH=$(xcrun --find sourcekit-lsp 2>/dev/null || true)
        if [[ -n "$SOURCEKIT_PATH" ]] && [[ -x "$SOURCEKIT_PATH" ]]; then
            exec "$SOURCEKIT_PATH" "$@"
        fi
    fi

    # Check Xcode toolchain directly
    XCODE_TOOLCHAIN="/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/sourcekit-lsp"
    if [[ -x "$XCODE_TOOLCHAIN" ]]; then
        exec "$XCODE_TOOLCHAIN" "$@"
    fi

    echo "Error: sourcekit-lsp not found. Please install Xcode or Swift toolchain." >&2
    echo "You can install Xcode from the App Store or download Swift from swift.org" >&2
    exit 1
fi

# On Linux, try swift toolchain
if [[ "$(uname -s)" == "Linux" ]]; then
    # Check common Swift installation paths
    for SWIFT_PATH in /usr/bin /usr/local/bin "${HOME}/.swiftenv/shims"; do
        if [[ -x "${SWIFT_PATH}/sourcekit-lsp" ]]; then
            exec "${SWIFT_PATH}/sourcekit-lsp" "$@"
        fi
    done

    echo "Error: sourcekit-lsp not found. Please install Swift toolchain from swift.org" >&2
    exit 1
fi

echo "Error: sourcekit-lsp not found. Please install Swift toolchain." >&2
exit 1
