#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="clangd"

# Check if already installed
if command -v "$LSP_CMD" &> /dev/null; then
    exec "$LSP_CMD" "$@"
fi

echo "Installing $LSP_CMD..." >&2

# Try brew first on macOS
if [[ "$(uname -s)" == "Darwin" ]]; then
    if command -v brew &> /dev/null; then
        brew install llvm
        # LLVM binaries are in a non-standard location
        LLVM_PATH="$(brew --prefix llvm)/bin"
        if [[ -x "${LLVM_PATH}/clangd" ]]; then
            exec "${LLVM_PATH}/clangd" "$@"
        fi
    fi

    # Check Xcode Command Line Tools
    if command -v xcrun &> /dev/null; then
        CLANGD_PATH=$(xcrun --find clangd 2>/dev/null || true)
        if [[ -n "$CLANGD_PATH" ]] && [[ -x "$CLANGD_PATH" ]]; then
            exec "$CLANGD_PATH" "$@"
        fi
    fi
fi

# Try apt on Debian/Ubuntu
if command -v apt-get &> /dev/null; then
    echo "Please install clangd with: sudo apt-get install clangd" >&2
    exit 1
fi

# Try dnf on Fedora
if command -v dnf &> /dev/null; then
    echo "Please install clangd with: sudo dnf install clang-tools-extra" >&2
    exit 1
fi

# Try pacman on Arch
if command -v pacman &> /dev/null; then
    echo "Please install clangd with: sudo pacman -S clang" >&2
    exit 1
fi

echo "Error: clangd not found. Please install LLVM/Clang for your platform." >&2
exit 1
