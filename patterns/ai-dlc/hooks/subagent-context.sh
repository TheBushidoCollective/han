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

# Helper function to load intent-level state
load_intent_state() {
  local key="$1"
  if [ -n "$INTENT_BRANCH" ]; then
    han keep load --branch "$INTENT_BRANCH" "$key" --quiet 2>/dev/null || echo ""
  else
    han keep load "$key" --quiet 2>/dev/null || echo ""
  fi
}

echo "## AI-DLC Subagent Context"
echo ""
echo "**Iteration:** $ITERATION | **Role:** $HAT | **Workflow:** $WORKFLOW_NAME ($WORKFLOW_HATS_STR)"
echo ""

# Load intent (intent-level state from intent branch)
INTENT=$(load_intent_state intent.md)
if [ -n "$INTENT" ]; then
  echo "### Intent"
  echo ""
  echo "$INTENT"
  echo ""
fi

# Load completion criteria (intent-level state from intent branch)
CRITERIA=$(load_intent_state completion-criteria.md)
if [ -n "$CRITERIA" ]; then
  echo "### Completion Criteria"
  echo ""
  echo "$CRITERIA"
  echo ""
fi

# Load current plan (intent-level state from intent branch)
PLAN=$(load_intent_state current-plan.md)
if [ -n "$PLAN" ]; then
  echo "### Current Plan"
  echo ""
  echo "$PLAN"
  echo ""
fi

# Load Unit/Bolt context (intent slug is intent-level state from intent branch)
INTENT_SLUG=$(load_intent_state intent-slug)
if [ -n "$INTENT_SLUG" ]; then
  INTENT_DIR=".ai-dlc/${INTENT_SLUG}"

  # Display testing requirements if configured
  if [ -f "$INTENT_DIR/intent.yaml" ]; then
    TESTING_JSON=$(han parse yaml testing --json < "$INTENT_DIR/intent.yaml" 2>/dev/null || echo "")
    if [ -n "$TESTING_JSON" ] && [ "$TESTING_JSON" != "null" ] && [ "$TESTING_JSON" != "{}" ]; then
      echo "### Testing Requirements"
      echo ""

      # Parse individual fields
      UNIT_TESTS=$(echo "$TESTING_JSON" | han parse json unit_tests -r --default "" 2>/dev/null || echo "")
      INTEGRATION_TESTS=$(echo "$TESTING_JSON" | han parse json integration_tests -r --default "" 2>/dev/null || echo "")
      COVERAGE=$(echo "$TESTING_JSON" | han parse json coverage_threshold -r --default "" 2>/dev/null || echo "")
      E2E_TESTS=$(echo "$TESTING_JSON" | han parse json e2e_tests -r --default "" 2>/dev/null || echo "")

      echo "| Requirement | Status |"
      echo "|-------------|--------|"
      [ "$UNIT_TESTS" = "true" ] && echo "| Unit Tests | Required |"
      [ "$UNIT_TESTS" = "false" ] && echo "| Unit Tests | Optional |"
      [ "$INTEGRATION_TESTS" = "true" ] && echo "| Integration Tests | Required |"
      [ "$INTEGRATION_TESTS" = "false" ] && echo "| Integration Tests | Optional |"
      if [ -n "$COVERAGE" ] && [ "$COVERAGE" != "null" ]; then
        echo "| Coverage Threshold | ${COVERAGE}% |"
      else
        echo "| Coverage Threshold | None |"
      fi
      [ "$E2E_TESTS" = "true" ] && echo "| E2E Tests | Required |"
      [ "$E2E_TESTS" = "false" ] && echo "| E2E Tests | Optional |"
      echo ""
    fi
  fi

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
      # Fallback: simple unit list with discipline
      echo "| Unit | Status | Discipline |"
      echo "|------|--------|------------|"
      for unit_file in "$INTENT_DIR"/unit-*.md; do
        [ -f "$unit_file" ] || continue
        NAME=$(basename "$unit_file" .md)
        UNIT_STATUS=$(han parse yaml status -r --default pending < "$unit_file" 2>/dev/null || echo "pending")
        DISCIPLINE=$(han parse yaml discipline -r --default "-" < "$unit_file" 2>/dev/null || echo "-")
        echo "| $NAME | $UNIT_STATUS | $DISCIPLINE |"
      done
      echo ""
    fi
  fi
fi

# Load role/hat instructions (builder/reviewer are orchestration roles)
HAT_FILE=""
if [ -f ".ai-dlc/hats/${HAT}.md" ]; then
  HAT_FILE=".ai-dlc/hats/${HAT}.md"
elif [ -n "$CLAUDE_PLUGIN_ROOT" ] && [ -f "${CLAUDE_PLUGIN_ROOT}/hats/${HAT}.md" ]; then
  HAT_FILE="${CLAUDE_PLUGIN_ROOT}/hats/${HAT}.md"
fi

echo "### Current Role: $HAT"
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
else
  # No hat file - role is an orchestrator that spawns discipline-specific agents
  echo "**$HAT** orchestrates work by spawning discipline-specific agents based on unit requirements."
  echo ""
fi

# AI-DLC Workflow Rules (mandatory for all subagents)
echo "---"
echo ""
echo "## AI-DLC Workflow Rules"
echo ""

# Get current branch and working directory
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
CURRENT_DIR=$(pwd)
IS_WORKTREE=$(git rev-parse --is-inside-work-tree 2>/dev/null && [ -f "$(git rev-parse --git-dir)/commondir" ] && echo "yes" || echo "no")

echo "### Current Working Context"
echo ""
echo "- **Branch:** \`${CURRENT_BRANCH}\`"
echo "- **Directory:** \`${CURRENT_DIR}\`"
if [ "$IS_WORKTREE" = "yes" ]; then
  echo "- **Worktree:** ✅ Yes (isolated workspace)"
else
  echo "- **Worktree:** ⚠️ NO - You should be in a worktree!"
fi
echo ""

echo "### Worktree Isolation (MANDATORY)"
echo ""
echo "All bolt work MUST happen in an isolated worktree at:"
echo "\`/tmp/ai-dlc-{intent-slug}-{unit-slug}/\`"
echo ""
if [ "$IS_WORKTREE" = "yes" ] && [[ "$CURRENT_BRANCH" == ai-dlc/* ]]; then
  echo "✅ You are in the correct worktree on an AI-DLC branch. Continue working here."
elif [[ "$CURRENT_DIR" == /tmp/ai-dlc-* ]]; then
  echo "✅ You are in an AI-DLC worktree directory. Continue working here."
else
  echo "🛑 **STOP!** You are NOT in a worktree!"
  echo ""
  echo "Before doing ANY work, you must:"
  echo "1. Have the parent create the worktree"
  echo "2. cd to the worktree directory"
  echo "3. Verify you're on the unit branch"
  echo ""
  echo "Working outside a worktree will cause conflicts with the parent session."
fi
echo ""
echo "### Before Stopping"
echo ""
echo "1. **Commit changes**: \`git add -A && git commit\`"
echo "2. **Save scratchpad** (unit-scoped - your branch): \`han keep save scratchpad.md \"...\"\`"
echo "3. **Write next prompt** (unit-scoped - your branch): \`han keep save next-prompt.md \"...\"\`"
echo ""
echo "**Note:** Unit-level state (scratchpad.md, next-prompt.md, blockers.md) is saved to YOUR branch."
echo "Intent-level state (iteration.json, intent.md, etc.) is managed by the orchestrator on main."
echo ""
echo "### Resilience (CRITICAL)"
echo ""
echo "Bolts MUST attempt to rescue before declaring blocked:"
echo ""
echo "1. **Commit early, commit often** - Don't wait until the end"
echo "2. **If changes disappear** - Investigate, recreate, commit immediately"
echo "3. **If on wrong branch** - Switch to correct branch and continue"
echo "4. **If tests fail** - Fix and retry, don't give up"
echo "5. **Only declare blocked** after 3+ genuine rescue attempts"
echo ""
echo "### Communication (HITL)"
echo ""
echo "**Notify users of important events:**"
echo ""
echo "- \`🚀 Starting:\` When beginning significant work"
echo "- \`✅ Completed:\` When a milestone is reached"
echo "- \`⚠️ Issue:\` When something needs attention but isn't blocking"
echo "- \`🛑 Blocked:\` When genuinely stuck after rescue attempts"
echo "- \`❓ Decision needed:\` Use \`AskUserQuestion\` for user input"
echo ""
echo "Output status messages directly - users see them in real-time."
echo "Document blockers in \`han keep save blockers.md\` for persistence (unit-scoped)."
echo ""
