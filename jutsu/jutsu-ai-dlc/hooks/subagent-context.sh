#!/bin/bash
# subagent-context.sh - SubagentPrompt hook for AI-DLC
#
# Injects full AI-DLC context into subagent prompts:
# - Hat instructions (from hat file)
# - AI-DLC workflow rules (iteration management)
# - Unit/Bolt context (current unit, status, dependencies)
# - Intent and completion criteria

set -e

# Check for han CLI
if ! command -v han &> /dev/null; then
  exit 0
fi

# Check for AI-DLC state
ITERATION_JSON=$(han keep load --branch iteration.json --quiet 2>/dev/null || echo "")

if [ -z "$ITERATION_JSON" ]; then
  # No AI-DLC state - nothing to inject
  exit 0
fi

# Parse iteration state
ITERATION=$(echo "$ITERATION_JSON" | han parse json iteration -r --default 1 2>/dev/null || echo "1")
HAT=$(echo "$ITERATION_JSON" | han parse json hat -r --default "" 2>/dev/null || echo "")
STATUS=$(echo "$ITERATION_JSON" | han parse json status -r --default active 2>/dev/null || echo "active")
WORKFLOW_NAME=$(echo "$ITERATION_JSON" | han parse json workflowName -r --default default 2>/dev/null || echo "default")

# Skip if no active task
if [ "$STATUS" = "complete" ] || [ -z "$HAT" ]; then
  exit 0
fi

# Get workflow hats array as string
WORKFLOW_HATS=$(echo "$ITERATION_JSON" | han parse json workflow 2>/dev/null || echo '["elaborator","planner","builder","reviewer"]')
WORKFLOW_HATS_STR=$(echo "$WORKFLOW_HATS" | tr -d '[]"' | sed 's/,/ → /g')
[ -z "$WORKFLOW_HATS_STR" ] && WORKFLOW_HATS_STR="elaborator → planner → builder → reviewer"

echo "## AI-DLC Subagent Context"
echo ""
echo "**Iteration:** $ITERATION | **Hat:** $HAT | **Workflow:** $WORKFLOW_NAME ($WORKFLOW_HATS_STR)"
echo ""

# Load intent
INTENT=$(han keep load --branch intent.md --quiet 2>/dev/null || echo "")
if [ -n "$INTENT" ]; then
  echo "### Intent"
  echo ""
  echo "$INTENT"
  echo ""
fi

# Load completion criteria
CRITERIA=$(han keep load --branch completion-criteria.md --quiet 2>/dev/null || echo "")
if [ -n "$CRITERIA" ]; then
  echo "### Completion Criteria"
  echo ""
  echo "$CRITERIA"
  echo ""
fi

# Load current plan
PLAN=$(han keep load --branch current-plan.md --quiet 2>/dev/null || echo "")
if [ -n "$PLAN" ]; then
  echo "### Current Plan"
  echo ""
  echo "$PLAN"
  echo ""
fi

# Load Unit/Bolt context
INTENT_SLUG=$(han keep load --branch intent-slug --quiet 2>/dev/null || echo "")
if [ -n "$INTENT_SLUG" ]; then
  INTENT_DIR=".ai-dlc/${INTENT_SLUG}"

  # Source DAG library if available
  DAG_LIB="${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"
  if [ -f "$DAG_LIB" ]; then
    # shellcheck source=/dev/null
    source "$DAG_LIB"
  fi

  if [ -d "$INTENT_DIR" ] && ls "$INTENT_DIR"/unit-*.md 1>/dev/null 2>&1; then
    echo "### Unit Status"
    echo ""

    # Use DAG functions if available
    if type get_dag_status_table &>/dev/null; then
      get_dag_status_table "$INTENT_DIR"
      echo ""

      # Show ready and in-progress units
      if type find_ready_units &>/dev/null; then
        READY_UNITS=$(find_ready_units "$INTENT_DIR" | tr '\n' ' ' | sed 's/ $//')
        [ -n "$READY_UNITS" ] && echo "**Ready:** $READY_UNITS"
      fi

      if type find_in_progress_units &>/dev/null; then
        IN_PROGRESS=$(find_in_progress_units "$INTENT_DIR" | tr '\n' ' ' | sed 's/ $//')
        [ -n "$IN_PROGRESS" ] && echo "**In Progress:** $IN_PROGRESS"
      fi
      echo ""
    else
      # Fallback: simple unit list
      echo "| Unit | Status |"
      echo "|------|--------|"
      for unit_file in "$INTENT_DIR"/unit-*.md; do
        [ -f "$unit_file" ] || continue
        NAME=$(basename "$unit_file" .md)
        UNIT_STATUS=$(han parse yaml status -r --default pending < "$unit_file" 2>/dev/null || echo "pending")
        echo "| $NAME | $UNIT_STATUS |"
      done
      echo ""
    fi
  fi
fi

# Load hat instructions
HAT_FILE=""
if [ -f ".ai-dlc/hats/${HAT}.md" ]; then
  HAT_FILE=".ai-dlc/hats/${HAT}.md"
elif [ -n "$CLAUDE_PLUGIN_ROOT" ] && [ -f "${CLAUDE_PLUGIN_ROOT}/hats/${HAT}.md" ]; then
  HAT_FILE="${CLAUDE_PLUGIN_ROOT}/hats/${HAT}.md"
fi

echo "### Current Hat: $HAT"
echo ""

if [ -n "$HAT_FILE" ] && [ -f "$HAT_FILE" ]; then
  # Parse frontmatter
  NAME=$(han parse yaml name -r --default "" < "$HAT_FILE" 2>/dev/null || echo "")
  MODE=$(han parse yaml mode -r --default "" < "$HAT_FILE" 2>/dev/null || echo "")

  # Get content after frontmatter
  INSTRUCTIONS=$(cat "$HAT_FILE" | sed '1,/^---$/d' | sed '1,/^---$/d')

  echo "**${NAME:-$HAT}** (Mode: ${MODE:-HITL})"
  echo ""
  if [ -n "$INSTRUCTIONS" ]; then
    echo "$INSTRUCTIONS"
    echo ""
  fi
fi

# AI-DLC Workflow Rules (mandatory for all subagents)
echo "---"
echo ""
echo "## AI-DLC Workflow Rules"
echo ""
echo "### Branch Per Unit (MANDATORY)"
echo ""
echo "Work MUST happen on a dedicated branch: \`ai-dlc/{intent-slug}/{unit-number}-{unit-slug}\`"
echo ""
echo "### Before Stopping"
echo ""
echo "1. **Commit changes**: \`git add -A && git commit\`"
echo "2. **Save scratchpad**: \`han keep save --branch scratchpad.md \"...\"\`"
echo "3. **Write next prompt**: \`han keep save --branch next-prompt.md \"...\"\`"
echo ""
echo "### Communication"
echo ""
echo "- Use \`AskUserQuestion\` tool for user input (don't stop arbitrarily)"
echo "- Document blockers in \`han keep save --branch blockers.md\`"
echo ""
