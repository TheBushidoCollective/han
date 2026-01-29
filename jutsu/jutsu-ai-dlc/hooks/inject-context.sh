#!/bin/bash
# inject-context.sh - SessionStart hook for AI-DLC
#
# Injects iteration context from han keep storage:
# - Current hat and instructions (from hats/ directory)
# - Intent and completion criteria
# - Previous scratchpad/blockers
# - Iteration number and workflow

set -e

# Check for required dependencies
if ! command -v han &> /dev/null; then
  echo "Warning: han CLI is required for AI-DLC but not installed. Skipping context injection." >&2
  exit 0
fi

if ! command -v jq &> /dev/null; then
  echo "Warning: jq is required for AI-DLC but not installed. Skipping context injection." >&2
  exit 0
fi

# Check for AI-DLC state
ITERATION_JSON=$(han keep load --branch iteration.json --quiet 2>/dev/null || echo "")

if [ -z "$ITERATION_JSON" ]; then
  # No AI-DLC state - not using the methodology
  exit 0
fi

# Validate JSON structure before parsing
if ! echo "$ITERATION_JSON" | jq empty 2>/dev/null; then
  echo "Warning: Invalid iteration.json format. Run /reset to clear state." >&2
  exit 0
fi

# Schema validation: check required fields and types
VALID=$(echo "$ITERATION_JSON" | jq '
  (has("iteration") and (.iteration | type) == "number") and
  (has("hat") and (.hat | type) == "string") and
  (has("status") and (.status | type) == "string") and
  (.status | IN("active", "blocked", "complete"))
' 2>/dev/null || echo "false")

if [ "$VALID" != "true" ]; then
  echo "Warning: iteration.json has invalid schema. Run /reset to clear state." >&2
  exit 0
fi

# Parse iteration state with defaults for missing fields
ITERATION=$(echo "$ITERATION_JSON" | jq -r '.iteration // 1' 2>/dev/null || echo "1")
HAT=$(echo "$ITERATION_JSON" | jq -r '.hat // "elaborator"' 2>/dev/null || echo "elaborator")
STATUS=$(echo "$ITERATION_JSON" | jq -r '.status // "active"' 2>/dev/null || echo "active")
WORKFLOW_NAME=$(echo "$ITERATION_JSON" | jq -r '.workflowName // "default"' 2>/dev/null || echo "default")

# Validate workflow name against known workflows
KNOWN_WORKFLOWS="default tdd adversarial hypothesis"
if ! echo "$KNOWN_WORKFLOWS" | grep -qw "$WORKFLOW_NAME"; then
  echo "Warning: Unknown workflow '$WORKFLOW_NAME'. Using 'default'." >&2
  WORKFLOW_NAME="default"
fi

WORKFLOW_HATS=$(echo "$ITERATION_JSON" | jq -r '.workflow // ["elaborator","planner","builder","reviewer"] | join(" → ")' 2>/dev/null || echo "elaborator → planner → builder → reviewer")

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

  # Extract frontmatter block (between --- lines)
  FRONTMATTER=$(echo "$HAT_CONTENT" | sed -n '/^---$/,/^---$/p' | sed '1d;$d')

  # Parse frontmatter - prefer yq for safety, fallback to grep
  if command -v yq &> /dev/null && [ -n "$FRONTMATTER" ]; then
    # Use yq for proper YAML parsing (safer)
    NAME=$(echo "$FRONTMATTER" | yq -r '.name // empty' 2>/dev/null || echo "")
    MODE=$(echo "$FRONTMATTER" | yq -r '.mode // empty' 2>/dev/null || echo "")
  else
    # Fallback: simple grep extraction (only alphanumeric + spaces allowed)
    NAME=$(echo "$FRONTMATTER" | grep -E '^name:' | sed 's/^name:[[:space:]]*//' | tr -d '"' | tr -cd '[:alnum:] _-')
    MODE=$(echo "$FRONTMATTER" | grep -E '^mode:' | sed 's/^mode:[[:space:]]*//' | tr -d '"' | tr -cd '[:alnum:]')
  fi

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

# Check branch naming convention (informational only)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [ -n "$CURRENT_BRANCH" ] && [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  if ! echo "$CURRENT_BRANCH" | grep -qE '^ai-dlc/[a-z0-9-]+/[0-9]+-[a-z0-9-]+$'; then
    echo ""
    echo "> **Note:** Branch \`$CURRENT_BRANCH\` doesn't follow AI-DLC convention:"
    echo "> \`ai-dlc/{intent-slug}/{unit-number}-{unit-slug}\`"
  fi
fi

echo ""
echo "---"
echo ""
echo "**User commands:** \`/construct\` (continue loop) | \`/reset\` (abandon task)"
