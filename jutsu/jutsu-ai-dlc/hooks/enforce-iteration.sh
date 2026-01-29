#!/bin/bash
# enforce-iteration.sh - Stop hook for AI-DLC
#
# At the end of each session, prompts user to /clear for next iteration.
# The iteration count is incremented automatically.

set -e

# Check for han CLI (only dependency needed)
if ! command -v han &> /dev/null; then
  # han not installed - skip silently
  exit 0
fi

# Check for AI-DLC state
ITERATION_JSON=$(han keep load --branch iteration.json --quiet 2>/dev/null || echo "")

if [ -z "$ITERATION_JSON" ]; then
  # No AI-DLC state - not using the methodology, skip
  exit 0
fi

# Validate JSON using han parse
if ! echo "$ITERATION_JSON" | han parse json-validate --quiet 2>/dev/null; then
  # Invalid JSON - skip silently
  exit 0
fi

# Parse state using han parse (no jq needed)
STATUS=$(echo "$ITERATION_JSON" | han parse json status -r --default active)

# If task is already complete, don't enforce iteration
if [ "$STATUS" = "complete" ]; then
  exit 0
fi

# Get current iteration and increment
CURRENT_ITERATION=$(echo "$ITERATION_JSON" | han parse json iteration -r --default 1)
NEW_ITERATION=$((CURRENT_ITERATION + 1))

# Update iteration.json with new count using han parse json-set
UPDATED_JSON=$(echo "$ITERATION_JSON" | han parse json-set iteration "$NEW_ITERATION" 2>/dev/null)
if [ -n "$UPDATED_JSON" ]; then
  han keep save --branch iteration.json "$UPDATED_JSON" 2>/dev/null || true
fi

HAT=$(echo "$ITERATION_JSON" | han parse json hat -r --default builder)

echo ""
echo "---"
echo ""
echo "## AI-DLC: Iteration $CURRENT_ITERATION Complete"
echo ""
echo "**Current hat:** $HAT"
echo ""
echo "Run \`/clear\` to start iteration $NEW_ITERATION with fresh context."
echo ""
echo "Your progress has been preserved in han keep storage."
