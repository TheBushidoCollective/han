#!/bin/bash
# enforce-iteration.sh - Stop hook for AI-DLC
#
# PURPOSE: Rescue mechanism when the construction loop exits unexpectedly.
#
# This hook fires when a session ends. It determines the appropriate action:
# 1. **Work remains** (units ready or in progress):
#    - Instruct agent to call `/construct` to continue
#    - Subagents have CLEAN CONTEXT - no need for /clear
# 2. **All complete** (no pending units):
#    - Intent is done, no action needed
# 3. **Truly blocked** (no ready units, human MUST intervene):
#    - This is the only "real stop" - alert the user

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

# Get current iteration and hat
CURRENT_ITERATION=$(echo "$ITERATION_JSON" | han parse json iteration -r --default 1)
HAT=$(echo "$ITERATION_JSON" | han parse json hat -r --default builder)

# Get iteration limit (0 or null = unlimited)
MAX_ITERATIONS=$(echo "$ITERATION_JSON" | han parse json maxIterations -r --default 0 2>/dev/null || echo "0")

# Check if iteration limit exceeded
if [ "$MAX_ITERATIONS" -gt 0 ] && [ "$CURRENT_ITERATION" -ge "$MAX_ITERATIONS" ]; then
  echo ""
  echo "---"
  echo ""
  echo "## AI-DLC: ITERATION LIMIT REACHED"
  echo ""
  echo "**Iteration:** $CURRENT_ITERATION / $MAX_ITERATIONS (max)"
  echo "**Hat:** $HAT"
  echo ""
  echo "The maximum iteration limit has been reached. This is a safety mechanism"
  echo "to prevent infinite loops."
  echo ""
  echo "**Options:**"
  echo "1. Review progress and decide if work is complete"
  echo "2. Increase limit: \`han keep save iteration.json '{...\"maxIterations\": 100}'\`"
  echo "3. Reset iteration count: \`/reset\` and start fresh"
  echo ""
  echo "Progress preserved in han keep storage."
  exit 0
fi

# Get intent slug and check DAG status
INTENT_SLUG=$(han keep load intent-slug --quiet 2>/dev/null || echo "")
INTENT_DIR=""
READY_COUNT=0
IN_PROGRESS_COUNT=0
ALL_COMPLETE="false"

if [ -n "$INTENT_SLUG" ]; then
  INTENT_DIR=".ai-dlc/${INTENT_SLUG}"

  # Check if DAG library is available and intent dir exists
  DAG_LIB="${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"
  if [ -f "$DAG_LIB" ] && [ -d "$INTENT_DIR" ]; then
    # shellcheck source=/dev/null
    source "$DAG_LIB"

    # Get DAG status
    if type get_dag_summary &>/dev/null; then
      DAG_SUMMARY=$(get_dag_summary "$INTENT_DIR" 2>/dev/null || echo "{}")
      READY_COUNT=$(echo "$DAG_SUMMARY" | han parse json readyCount -r --default 0 2>/dev/null || echo "0")
      IN_PROGRESS_COUNT=$(echo "$DAG_SUMMARY" | han parse json inProgressCount -r --default 0 2>/dev/null || echo "0")
      ALL_COMPLETE=$(echo "$DAG_SUMMARY" | han parse json allComplete -r --default false 2>/dev/null || echo "false")
    fi
  fi
fi

echo ""
echo "---"
echo ""

# Determine action based on DAG state
if [ "$ALL_COMPLETE" = "true" ]; then
  # All done - intent should be marked complete
  echo "## AI-DLC: All Units Complete"
  echo ""
  echo "All units have been completed. If the intent isn't marked complete,"
  echo "call \`/advance\` to finalize."
  echo ""
elif [ "$READY_COUNT" -gt 0 ] || [ "$IN_PROGRESS_COUNT" -gt 0 ]; then
  # Work remains - instruct agent to continue
  echo "## AI-DLC: Session Exhausted - Continue Construction"
  echo ""
  echo "**Iteration:** $CURRENT_ITERATION | **Hat:** $HAT"
  echo "**Ready units:** $READY_COUNT | **In progress:** $IN_PROGRESS_COUNT"
  echo ""
  echo "### ACTION REQUIRED"
  echo ""
  echo "Call \`/construct\` to continue the autonomous loop."
  echo ""
  echo "**Note:** Subagents have clean context. No \`/clear\` needed."
  echo ""
else
  # Truly blocked - human must intervene
  echo "## AI-DLC: BLOCKED - Human Intervention Required"
  echo ""
  echo "**Iteration:** $CURRENT_ITERATION | **Hat:** $HAT"
  echo ""
  echo "No units are ready to work on. All remaining units are blocked."
  echo ""
  echo "**User action required:**"
  echo "1. Review blockers: \`han keep load blockers.md\`"
  echo "2. Unblock units or resolve dependencies"
  echo "3. Run \`/construct\` to resume"
  echo ""
fi

echo "Progress preserved in han keep storage."
