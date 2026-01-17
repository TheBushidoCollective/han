#!/usr/bin/env bash
#
# Coverage Ratcheting for Elixir Projects
#
# Only runs if the project has coverage ratcheting configured:
# 1. excoveralls must be a dependency in mix.exs
# 2. coveralls.json must exist with minimum_coverage set
#
# If these conditions aren't met, the script exits successfully (no-op).

set -euo pipefail

# Check if excoveralls is a dependency
if ! grep -q "excoveralls" mix.exs 2>/dev/null; then
    echo "Coverage ratcheting: excoveralls not configured, skipping"
    exit 0
fi

# Check if coveralls.json exists
if [[ ! -f "coveralls.json" ]]; then
    echo "Coverage ratcheting: No coveralls.json found, skipping"
    exit 0
fi

# Check if minimum_coverage is set in coveralls.json
# Using grep since jq may not be available
if ! grep -q '"minimum_coverage"' coveralls.json 2>/dev/null; then
    echo "Coverage ratcheting: No minimum_coverage threshold in coveralls.json, skipping"
    exit 0
fi

# Extract minimum coverage threshold
# Try jq first, fall back to grep/sed
if command -v jq &>/dev/null; then
    THRESHOLD=$(jq -r '.minimum_coverage // empty' coveralls.json)
else
    # Fallback: extract with grep/sed (handles basic cases)
    THRESHOLD=$(grep -o '"minimum_coverage"[[:space:]]*:[[:space:]]*[0-9.]*' coveralls.json | grep -o '[0-9.]*$' || echo "")
fi

if [[ -z "$THRESHOLD" ]]; then
    echo "Coverage ratcheting: Could not parse minimum_coverage from coveralls.json, skipping"
    exit 0
fi

echo "Coverage ratcheting: Enforcing minimum coverage of ${THRESHOLD}%"

# Run coverage check
# MIX_ENV=test is implied by mix coveralls
if ! mix coveralls --threshold "$THRESHOLD"; then
    echo ""
    echo "❌ Coverage dropped below ${THRESHOLD}%"
    echo ""
    echo "To fix this:"
    echo "  1. Add tests to improve coverage"
    echo "  2. Or lower the threshold in coveralls.json (not recommended)"
    exit 1
fi

echo "✅ Coverage meets or exceeds ${THRESHOLD}%"
