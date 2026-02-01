#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect what type of plugin structure we're validating
IS_MARKETPLACE=false
IS_PLUGIN=false

if [[ -f ".claude-plugin/marketplace.json" ]]; then
  IS_MARKETPLACE=true
fi

if [[ -f ".claude-plugin/plugin.json" ]]; then
  IS_PLUGIN=true
fi

# Validate based on what was detected
# claude plugin validate takes a path to the directory containing .claude-plugin/
if [[ "$IS_MARKETPLACE" == "true" ]]; then
  echo "Validating marketplace..."
  claude plugin validate "$(pwd)"
fi

if [[ "$IS_PLUGIN" == "true" ]]; then
  echo "Validating plugin..."
  claude plugin validate "$(pwd)"
fi

if [[ "$IS_MARKETPLACE" == "false" && "$IS_PLUGIN" == "false" ]]; then
  echo "Warning: No .claude-plugin/marketplace.json or .claude-plugin/plugin.json found"
  echo "Skipping claude plugin validate"
fi

echo "Running markdownlint..."
npx -y markdownlint-cli --config "$SCRIPT_DIR/.markdownlint.json" --ignore node_modules .

echo "All lints passed!"
