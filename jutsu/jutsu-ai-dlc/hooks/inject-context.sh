#!/bin/bash
# inject-context.sh - SessionStart hook for AI-DLC
#
# Injects iteration context from han keep storage:
# - Current hat and instructions (from hats/ directory)
# - Intent and completion criteria
# - Previous scratchpad/blockers
# - Iteration number and workflow

set -e

# Check for AI-DLC state
ITERATION_JSON=$(han keep load --branch iteration.json --quiet 2>/dev/null || echo "")

if [ -z "$ITERATION_JSON" ]; then
  # No AI-DLC state - not using the methodology
  exit 0
fi

# Parse iteration state
ITERATION=$(echo "$ITERATION_JSON" | jq -r '.iteration // 1')
HAT=$(echo "$ITERATION_JSON" | jq -r '.hat // "elaborator"')
STATUS=$(echo "$ITERATION_JSON" | jq -r '.status // "active"')
WORKFLOW_NAME=$(echo "$ITERATION_JSON" | jq -r '.workflowName // "default"')
WORKFLOW_HATS=$(echo "$ITERATION_JSON" | jq -r '.workflow // ["elaborator","planner","builder","reviewer"] | join(" → ")')

# If task is complete, just show completion message
if [ "$STATUS" = "complete" ]; then
  echo "## AI-DLC: Task Complete"
  echo ""
  echo "Previous task was completed. Run \`/reset\` to start a new task."
  exit 0
fi

echo "## AI-DLC Context"
echo ""
echo "**Iteration:** $ITERATION | **Hat:** $HAT | **Workflow:** $WORKFLOW_NAME ($WORKFLOW_HATS)"
echo ""

# Load and display intent
INTENT=$(han keep load --branch intent.md --quiet 2>/dev/null || echo "")
if [ -n "$INTENT" ]; then
  echo "### Intent"
  echo ""
  echo "$INTENT"
  echo ""
fi

# Load and display completion criteria
CRITERIA=$(han keep load --branch completion-criteria.md --quiet 2>/dev/null || echo "")
if [ -n "$CRITERIA" ]; then
  echo "### Completion Criteria"
  echo ""
  echo "$CRITERIA"
  echo ""
fi

# Load and display current plan
PLAN=$(han keep load --branch current-plan.md --quiet 2>/dev/null || echo "")
if [ -n "$PLAN" ]; then
  echo "### Current Plan"
  echo ""
  echo "$PLAN"
  echo ""
fi

# Load and display blockers (if any)
BLOCKERS=$(han keep load --branch blockers.md --quiet 2>/dev/null || echo "")
if [ -n "$BLOCKERS" ]; then
  echo "### Previous Blockers"
  echo ""
  echo "$BLOCKERS"
  echo ""
fi

# Load and display scratchpad
SCRATCHPAD=$(han keep load --branch scratchpad.md --quiet 2>/dev/null || echo "")
if [ -n "$SCRATCHPAD" ]; then
  echo "### Learnings from Previous Iteration"
  echo ""
  echo "$SCRATCHPAD"
  echo ""
fi

# Load hat instructions from markdown files
# Resolution order: 1) User override (.ai-dlc/hats/), 2) Plugin built-in (hats/)
HAT_FILE=""
HAT_CONTENT=""

# Check for user override first
if [ -f ".ai-dlc/hats/${HAT}.md" ]; then
  HAT_FILE=".ai-dlc/hats/${HAT}.md"
# Then check plugin directory
elif [ -n "$CLAUDE_PLUGIN_ROOT" ] && [ -f "${CLAUDE_PLUGIN_ROOT}/hats/${HAT}.md" ]; then
  HAT_FILE="${CLAUDE_PLUGIN_ROOT}/hats/${HAT}.md"
fi

echo "### Current Hat Instructions"
echo ""

if [ -n "$HAT_FILE" ] && [ -f "$HAT_FILE" ]; then
  # Read the file content
  HAT_CONTENT=$(cat "$HAT_FILE")

  # Parse frontmatter (between --- lines)
  NAME=$(echo "$HAT_CONTENT" | sed -n '/^---$/,/^---$/p' | grep '^name:' | sed 's/^name:[[:space:]]*//' | tr -d '"')
  MODE=$(echo "$HAT_CONTENT" | sed -n '/^---$/,/^---$/p' | grep '^mode:' | sed 's/^mode:[[:space:]]*//' | tr -d '"')

  # Get content after frontmatter (skip until second ---)
  INSTRUCTIONS=$(echo "$HAT_CONTENT" | sed '1,/^---$/d' | sed '1,/^---$/d')

  echo "**${NAME:-$HAT}** (Mode: ${MODE:-HITL})"
  echo ""
  if [ -n "$INSTRUCTIONS" ]; then
    echo "$INSTRUCTIONS"
  fi
else
  # No hat file found - show generic message
  echo "**$HAT** (Custom hat - no instructions found)"
  echo ""
  echo "Create a hat definition at \`.ai-dlc/hats/${HAT}.md\` with:"
  echo ""
  echo "\`\`\`markdown"
  echo "---"
  echo "name: \"Your Hat Name\""
  echo "mode: HITL  # or OHOTL, AHOTL"
  echo "---"
  echo ""
  echo "# Hat Name"
  echo ""
  echo "Instructions for this hat..."
  echo "\`\`\`"
fi

echo ""
echo "---"
echo ""
echo "**User commands:** \`/construct\` (continue loop) | \`/reset\` (abandon task)"
