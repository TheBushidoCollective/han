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
# Intent-level state is stored on the intent branch
# If we're on a unit branch (ai-dlc/intent/unit), we need to check the parent intent branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
INTENT_BRANCH=""
ITERATION_JSON=""

# Try current branch first
ITERATION_JSON=$(han keep load iteration.json --quiet 2>/dev/null || echo "")

# If not found and we're on a unit branch, try the parent intent branch
if [ -z "$ITERATION_JSON" ] && [[ "$CURRENT_BRANCH" == ai-dlc/*/* ]]; then
  # Extract intent branch: ai-dlc/intent-slug/unit-slug -> ai-dlc/intent-slug
  INTENT_BRANCH=$(echo "$CURRENT_BRANCH" | sed 's|^\(ai-dlc/[^/]*\)/.*|\1|')
  ITERATION_JSON=$(han keep load --branch "$INTENT_BRANCH" iteration.json --quiet 2>/dev/null || echo "")
fi

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
  # Intent-level state saved to intent branch (or current branch if on intent branch)
  if [ -n "$INTENT_BRANCH" ]; then
    han keep save --branch "$INTENT_BRANCH" iteration.json "$UPDATED_JSON" 2>/dev/null || true
  else
    han keep save iteration.json "$UPDATED_JSON" 2>/dev/null || true
  fi
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
