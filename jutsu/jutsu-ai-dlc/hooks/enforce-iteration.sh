#!/bin/bash
# enforce-iteration.sh - Stop hook for AI-DLC
#
# At the end of each session, prompts user to /clear for next iteration.
# The iteration count is incremented automatically.

set -e

# Check for jq dependency
if ! command -v jq &> /dev/null; then
  # jq not installed - skip silently
  exit 0
fi

# Check for AI-DLC state
ITERATION_JSON=$(han keep load --branch iteration.json --quiet 2>/dev/null || echo "")

if [ -z "$ITERATION_JSON" ]; then
  # No AI-DLC state - not using the methodology, skip
  exit 0
fi

# Validate JSON before parsing
if ! echo "$ITERATION_JSON" | jq empty 2>/dev/null; then
  # Invalid JSON - skip silently
  exit 0
fi

STATUS=$(echo "$ITERATION_JSON" | jq -r '.status // "active"' 2>/dev/null || echo "active")

# If task is already complete, don't enforce iteration
if [ "$STATUS" = "complete" ]; then
  exit 0
fi

# Increment iteration count
CURRENT_ITERATION=$(echo "$ITERATION_JSON" | jq -r '.iteration // 1' 2>/dev/null || echo "1")
NEW_ITERATION=$((CURRENT_ITERATION + 1))

# Update iteration.json with new count
UPDATED_JSON=$(echo "$ITERATION_JSON" | jq ".iteration = $NEW_ITERATION" 2>/dev/null)
if [ -n "$UPDATED_JSON" ]; then
  han keep save --branch iteration.json "$UPDATED_JSON" 2>/dev/null || true
fi

HAT=$(echo "$ITERATION_JSON" | jq -r '.hat // "builder"' 2>/dev/null || echo "builder")

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
