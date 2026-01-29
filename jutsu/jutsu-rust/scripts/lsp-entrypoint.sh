#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="rust-analyzer"

# Graceful degradation: Check if Rust project files exist
has_rust_files() {
    # Check for Cargo.toml first (fastest check)
    [[ -f "Cargo.toml" ]] && return 0

    # Search for .rs files with monorepo-friendly depth, excluding common dirs
    local found
    found=$(find . -maxdepth 5 \
        -path "*/node_modules" -prune -o \
        -path "*/.git" -prune -o \
        -path "*/target" -prune -o \
        -name "*.rs" -type f -print 2>/dev/null | head -1)
    [[ -n "$found" ]]
}

if ! has_rust_files; then
    echo "No Cargo.toml or .rs files found. Rust LSP disabled." >&2
    exit 0
fi

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing $LSP_CMD..." >&2

    # Try rustup first (preferred method)
    if command -v rustup &> /dev/null; then
        rustup component add rust-analyzer
    else
        # Fallback: download from GitHub releases
        echo "rustup not found, downloading from GitHub releases..." >&2

        # Detect platform
        case "$(uname -s)" in
            Linux)  PLATFORM="unknown-linux-gnu" ;;
            Darwin) PLATFORM="apple-darwin" ;;
            *)      echo "Unsupported platform: $(uname -s)" >&2; exit 1 ;;
        esac

        # Detect architecture
        case "$(uname -m)" in
            x86_64)  ARCH="x86_64" ;;
            aarch64|arm64) ARCH="aarch64" ;;
            *)       echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
        esac

        RELEASE_URL="https://github.com/rust-lang/rust-analyzer/releases/latest/download/rust-analyzer-${ARCH}-${PLATFORM}.gz"
        INSTALL_DIR="${HOME}/.local/bin"
        mkdir -p "$INSTALL_DIR"

        curl -fsSL "$RELEASE_URL" | gunzip > "${INSTALL_DIR}/rust-analyzer"
        chmod +x "${INSTALL_DIR}/rust-analyzer"

        export PATH="${INSTALL_DIR}:${PATH}"
    fi
fi

exec "$LSP_CMD" "$@"
