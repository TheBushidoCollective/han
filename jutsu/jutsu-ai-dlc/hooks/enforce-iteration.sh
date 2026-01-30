#!/bin/bash
# enforce-iteration.sh - Stop hook for AI-DLC
#
# At the end of each session, marks state for advancement and prompts for /clear.
# The actual iteration increment happens at SessionStart to ensure it always fires.

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

# Get current iteration
CURRENT_ITERATION=$(echo "$ITERATION_JSON" | han parse json iteration -r --default 1)
HAT=$(echo "$ITERATION_JSON" | han parse json hat -r --default builder)

# Mark for advancement (SessionStart will increment)
UPDATED_JSON=$(echo "$ITERATION_JSON" | han parse json-set needsAdvance true 2>/dev/null)
if [ -n "$UPDATED_JSON" ]; then
  han keep save --branch iteration.json "$UPDATED_JSON" 2>/dev/null || true
fi

echo ""
echo "---"
echo ""
echo "## AI-DLC: Iteration $CURRENT_ITERATION Complete"
echo ""
echo "**Current hat:** $HAT"
echo ""
echo "Run \`/clear\` to start iteration $((CURRENT_ITERATION + 1)) with fresh context."
echo ""
echo "Your progress has been preserved in han keep storage."
