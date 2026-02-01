#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Running claudelint..."
uvx claudelint . --strict

echo "Running markdownlint..."
npx -y markdownlint-cli --config "$SCRIPT_DIR/.markdownlint.json" --ignore node_modules .

echo "All lints passed!"
