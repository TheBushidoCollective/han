#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# claude plugin validate auto-detects marketplace vs plugin based on
# presence of marketplace.json or plugin.json in .claude-plugin/
echo "Validating plugin/marketplace..."
claude plugin validate .

echo "Running markdownlint..."
npx -y markdownlint-cli --config "$SCRIPT_DIR/.markdownlint.json" --ignore node_modules .

echo "All lints passed!"
