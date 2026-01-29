#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="pyright-langserver"

# Graceful degradation: Check if Python project files exist
has_python_files() {
    # Check for project files first (fastest check)
    [[ -f "pyproject.toml" ]] && return 0
    [[ -f "requirements.txt" ]] && return 0
    [[ -f "setup.py" ]] && return 0

    # Search for .py files with monorepo-friendly depth, excluding common dirs
    local found
    found=$(find . -maxdepth 5 \
        -path "*/node_modules" -prune -o \
        -path "*/.git" -prune -o \
        -path "*/__pycache__" -prune -o \
        -path "*/.venv" -prune -o \
        -path "*/venv" -prune -o \
        -path "*/.tox" -prune -o \
        -name "*.py" -type f -print 2>/dev/null | head -1)
    [[ -n "$found" ]]
}

if ! has_python_files; then
    echo "No .py files or Python project files found. Python LSP disabled." >&2
    exit 0
fi

if ! command -v "$LSP_CMD" &> /dev/null; then
    echo "Installing pyright..." >&2

    # Try npm first (more reliable for the language server binary)
    if command -v npm &> /dev/null; then
        npm install -g pyright
    # Fall back to pip
    elif command -v pip &> /dev/null; then
        pip install pyright
    elif command -v pip3 &> /dev/null; then
        pip3 install pyright
    else
        echo "Error: Neither npm nor pip is available. Please install one of them first." >&2
        exit 1
    fi
fi

exec "$LSP_CMD" "$@"
