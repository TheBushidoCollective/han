#!/bin/bash
# inject-context.sh - SessionStart hook for AI-DLC
#
# Injects iteration context from han keep storage:
# - Current hat and instructions (from hats/ directory)
# - Intent and completion criteria
# - Previous scratchpad/blockers
# - Iteration number and workflow

set -e

# Read stdin to get SessionStart payload
HOOK_INPUT=$(cat)

# Extract source field (startup, clear, compact)
SOURCE=$(echo "$HOOK_INPUT" | han parse json source -r 2>/dev/null || echo "startup")

# Check for han CLI (only dependency needed)
if ! command -v han &> /dev/null; then
  echo "Warning: han CLI is required for AI-DLC but not installed. Skipping context injection." >&2
  exit 0
fi

# Source DAG library if available
DAG_LIB="${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"
if [ -f "$DAG_LIB" ]; then
  # shellcheck source=/dev/null
  source "$DAG_LIB"
fi

# Check for AI-DLC state
ITERATION_JSON=$(han keep load --branch iteration.json --quiet 2>/dev/null || echo "")

if [ -z "$ITERATION_JSON" ]; then
  # No AI-DLC state - not using the methodology
  exit 0
fi

# Validate JSON and schema using han parse
if ! echo "$ITERATION_JSON" | han parse json-validate \
  --schema '{"iteration":"number","hat":"string","status":"string"}' \
  --quiet 2>/dev/null; then
  echo "Warning: Invalid iteration.json format. Run /reset to clear state." >&2
  exit 0
fi

# Check for needsAdvance flag (set by Stop hook to signal iteration should increment)
# Only advance on 'clear' or 'startup' sources - NOT on 'compact' events
NEEDS_ADVANCE=$(echo "$ITERATION_JSON" | han parse json needsAdvance -r --default false 2>/dev/null || echo "false")
if [ "$NEEDS_ADVANCE" = "true" ] && [ "$SOURCE" != "compact" ]; then
  # Increment iteration and clear the flag
  CURRENT_ITER=$(echo "$ITERATION_JSON" | han parse json iteration -r --default 1)
  NEW_ITER=$((CURRENT_ITER + 1))
  ITERATION_JSON=$(echo "$ITERATION_JSON" | han parse json-set iteration "$NEW_ITER" 2>/dev/null)
  ITERATION_JSON=$(echo "$ITERATION_JSON" | han parse json-set needsAdvance false 2>/dev/null)
  han keep save --branch iteration.json "$ITERATION_JSON" 2>/dev/null || true
fi

# Parse iteration state using han parse (no jq needed)
ITERATION=$(echo "$ITERATION_JSON" | han parse json iteration -r --default 1)
HAT=$(echo "$ITERATION_JSON" | han parse json hat -r --default elaborator)
STATUS=$(echo "$ITERATION_JSON" | han parse json status -r --default active)
WORKFLOW_NAME=$(echo "$ITERATION_JSON" | han parse json workflowName -r --default default)

# Validate workflow name against known workflows
KNOWN_WORKFLOWS="default tdd adversarial hypothesis"
if ! echo "$KNOWN_WORKFLOWS" | grep -qw "$WORKFLOW_NAME"; then
  echo "Warning: Unknown workflow '$WORKFLOW_NAME'. Using 'default'." >&2
  WORKFLOW_NAME="default"
fi

# Get workflow hats array as string
WORKFLOW_HATS=$(echo "$ITERATION_JSON" | han parse json workflow 2>/dev/null || echo '["elaborator","planner","builder","reviewer"]')
# Format as arrow-separated list
WORKFLOW_HATS_STR=$(echo "$WORKFLOW_HATS" | tr -d '[]"' | sed 's/,/ → /g')
[ -z "$WORKFLOW_HATS_STR" ] && WORKFLOW_HATS_STR="elaborator → planner → builder → reviewer"

# If task is complete, just show completion message
if [ "$STATUS" = "complete" ]; then
  echo "## AI-DLC: Task Complete"
  echo ""
  echo "Previous task was completed. Run \`/reset\` to start a new task."
  exit 0
fi

echo "## AI-DLC Context"
echo ""
echo "**Iteration:** $ITERATION | **Hat:** $HAT | **Workflow:** $WORKFLOW_NAME ($WORKFLOW_HATS_STR)"
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

# Load and display DAG status (if units exist)
INTENT_SLUG=$(han keep load --branch intent-slug --quiet 2>/dev/null || echo "")
if [ -n "$INTENT_SLUG" ]; then
  INTENT_DIR=".ai-dlc/${INTENT_SLUG}"

  if [ -d "$INTENT_DIR" ] && ls "$INTENT_DIR"/unit-*.md 1>/dev/null 2>&1; then
    echo "### Unit Status"
    echo ""

    # Use DAG functions if available
    if type get_dag_status_table &>/dev/null; then
      get_dag_status_table "$INTENT_DIR"
      echo ""

      # Show summary
      if type get_dag_summary &>/dev/null; then
        SUMMARY=$(get_dag_summary "$INTENT_DIR")
        # Parse summary into human-readable format
        # Format: "pending:N in_progress:N completed:N blocked:N ready:N"
        PENDING=$(echo "$SUMMARY" | sed -n 's/.*pending:\([0-9]*\).*/\1/p')
        IN_PROG=$(echo "$SUMMARY" | sed -n 's/.*in_progress:\([0-9]*\).*/\1/p')
        COMPLETED=$(echo "$SUMMARY" | sed -n 's/.*completed:\([0-9]*\).*/\1/p')
        BLOCKED=$(echo "$SUMMARY" | sed -n 's/.*blocked:\([0-9]*\).*/\1/p')
        READY=$(echo "$SUMMARY" | sed -n 's/.*ready:\([0-9]*\).*/\1/p')
        echo "**Summary:** $COMPLETED completed, $IN_PROG in_progress, $PENDING pending ($BLOCKED blocked), $READY ready"
        echo ""
      fi

      # Show ready units
      if type find_ready_units &>/dev/null; then
        READY_UNITS=$(find_ready_units "$INTENT_DIR" | tr '\n' ' ' | sed 's/ $//')
        if [ -n "$READY_UNITS" ]; then
          echo "**Ready for execution:** $READY_UNITS"
          echo ""
        fi
      fi

      # Show in-progress units
      if type find_in_progress_units &>/dev/null; then
        IN_PROGRESS=$(find_in_progress_units "$INTENT_DIR" | tr '\n' ' ' | sed 's/ $//')
        if [ -n "$IN_PROGRESS" ]; then
          echo "**Currently in progress:** $IN_PROGRESS"
          echo ""
        fi
      fi
    else
      # Fallback: simple unit list without DAG analysis
      echo "| Unit | Status |"
      echo "|------|--------|"
      for unit_file in "$INTENT_DIR"/unit-*.md; do
        [ -f "$unit_file" ] || continue
        NAME=$(basename "$unit_file" .md)
        STATUS=$(han parse yaml status -r --default pending < "$unit_file" 2>/dev/null || echo "pending")
        echo "| $NAME | $STATUS |"
      done
      echo ""
    fi
  fi
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
  # Parse frontmatter directly (han parse yaml auto-extracts it)
  NAME=$(han parse yaml name -r --default "" < "$HAT_FILE" 2>/dev/null || echo "")
  MODE=$(han parse yaml mode -r --default "" < "$HAT_FILE" 2>/dev/null || echo "")

  # Get content after frontmatter (skip until second ---)
  HAT_CONTENT=$(cat "$HAT_FILE")
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
echo "**Commands:** \`/construct\` (continue loop) | \`/reset\` (abandon task)"
echo ""
echo "> **No file changes?** If this hat's work is complete but no files were modified,"
echo "> save findings to scratchpad and run \`/advance\` then \`/clear\`."
