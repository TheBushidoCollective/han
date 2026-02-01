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

# Load workflows from plugin (defaults) and project (overrides)
# Project workflows merge with plugin workflows (project takes precedence)
PLUGIN_WORKFLOWS="${CLAUDE_PLUGIN_ROOT}/workflows.yml"
PROJECT_WORKFLOWS=".ai-dlc/workflows.yml"

# Function to extract workflow names from YAML file
get_workflow_names() {
  local file="$1"
  if [ -f "$file" ]; then
    # Extract top-level keys (workflow names) - lines without leading spaces that end with :
    grep -E '^[a-z][a-z0-9_-]*:' "$file" 2>/dev/null | sed 's/:.*//' || true
  fi
}

# Function to get workflow details (description and hats)
get_workflow_details() {
  local file="$1"
  local name="$2"
  if [ -f "$file" ]; then
    local desc hats
    desc=$(han parse yaml "${name}.description" -r < "$file" 2>/dev/null || echo "")
    # han parse yaml outputs arrays as "- item\n- item", convert to arrow-separated
    hats=$(han parse yaml "${name}.hats" < "$file" 2>/dev/null | sed 's/^- //' | tr '\n' '|' | sed 's/|$//; s/|/ → /g' || echo "")
    if [ -n "$desc" ] && [ -n "$hats" ]; then
      echo "$desc|$hats"
    fi
  fi
}

# Build merged workflow list (project overrides plugin)
declare -A WORKFLOWS
KNOWN_WORKFLOWS=""

# Load plugin workflows first
for name in $(get_workflow_names "$PLUGIN_WORKFLOWS"); do
  details=$(get_workflow_details "$PLUGIN_WORKFLOWS" "$name")
  if [ -n "$details" ]; then
    WORKFLOWS[$name]="$details"
    KNOWN_WORKFLOWS="$KNOWN_WORKFLOWS $name"
  fi
done

# Load project workflows (override or add)
for name in $(get_workflow_names "$PROJECT_WORKFLOWS"); do
  details=$(get_workflow_details "$PROJECT_WORKFLOWS" "$name")
  if [ -n "$details" ]; then
    WORKFLOWS[$name]="$details"
    # Add to known if not already there
    if ! echo "$KNOWN_WORKFLOWS" | grep -qw "$name"; then
      KNOWN_WORKFLOWS="$KNOWN_WORKFLOWS $name"
    fi
  fi
done

# Build formatted workflow list for display
AVAILABLE_WORKFLOWS=""
for name in $KNOWN_WORKFLOWS; do
  details="${WORKFLOWS[$name]}"
  if [ -n "$details" ]; then
    desc="${details%%|*}"
    hats="${details##*|}"
    AVAILABLE_WORKFLOWS="${AVAILABLE_WORKFLOWS}
- **$name**: $desc ($hats)"
  fi
done
AVAILABLE_WORKFLOWS="${AVAILABLE_WORKFLOWS#
}"  # Remove leading newline

# Check for AI-DLC state
# Intent-level state is stored on the current branch (intent branch for orchestrator, unit branch for subagents)
# If we're on a unit branch (ai-dlc/intent/unit), we need to check the parent intent branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
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
  # Discover resumable intents from filesystem and git branches
  declare -A FILESYSTEM_INTENTS
  declare -A BRANCH_INTENTS

  # 1. Check filesystem first (highest priority - source of truth)
  for intent_file in .ai-dlc/*/intent.md; do
    [ -f "$intent_file" ] || continue
    dir=$(dirname "$intent_file")
    slug=$(basename "$dir")
    status=$(han parse yaml status -r --default active < "$intent_file" 2>/dev/null || echo "active")
    [ "$status" = "active" ] || continue
    workflow=$(han parse yaml workflow -r --default default < "$intent_file" 2>/dev/null || echo "default")

    # Get unit summary if DAG functions are available
    summary=""
    if type get_dag_summary &>/dev/null && [ -d "$dir" ]; then
      summary=$(get_dag_summary "$dir")
    fi
    FILESYSTEM_INTENTS[$slug]="$workflow|$summary"
  done

  # 2. Discover intents on git branches (local only for performance)
  if type discover_branch_intents &>/dev/null; then
    while IFS='|' read -r slug workflow source branch; do
      [ -z "$slug" ] && continue
      # Skip if already found in filesystem
      [ -n "${FILESYSTEM_INTENTS[$slug]}" ] && continue
      BRANCH_INTENTS[$slug]="$workflow|$source|$branch"
    done < <(discover_branch_intents false)
  fi

  # Build output if any intents found
  if [ ${#FILESYSTEM_INTENTS[@]} -gt 0 ] || [ ${#BRANCH_INTENTS[@]} -gt 0 ]; then
    echo "## AI-DLC: Resumable Intents Found"
    echo ""

    # Show filesystem intents first
    if [ ${#FILESYSTEM_INTENTS[@]} -gt 0 ]; then
      echo "### In Current Directory"
      echo ""
      for slug in "${!FILESYSTEM_INTENTS[@]}"; do
        IFS='|' read -r workflow summary <<< "${FILESYSTEM_INTENTS[$slug]}"
        echo "- **$slug** (workflow: $workflow)"
        if [ -n "$summary" ]; then
          completed=$(echo "$summary" | sed -n 's/.*completed:\([0-9]*\).*/\1/p')
          pending=$(echo "$summary" | sed -n 's/.*pending:\([0-9]*\).*/\1/p')
          in_prog=$(echo "$summary" | sed -n 's/.*in_progress:\([0-9]*\).*/\1/p')
          total=$((completed + pending + in_prog))
          [ "$total" -gt 0 ] && echo "  - Units: $completed/$total completed"
        fi
      done
      echo ""
    fi

    # Show branch intents grouped by source
    declare -A LOCAL_BRANCH_INTENTS
    declare -A REMOTE_BRANCH_INTENTS
    for slug in "${!BRANCH_INTENTS[@]}"; do
      IFS='|' read -r workflow source branch <<< "${BRANCH_INTENTS[$slug]}"
      case "$source" in
        worktree|local)
          LOCAL_BRANCH_INTENTS[$slug]="$workflow|$branch"
          ;;
        remote)
          REMOTE_BRANCH_INTENTS[$slug]="$workflow|$branch"
          ;;
      esac
    done

    if [ ${#LOCAL_BRANCH_INTENTS[@]} -gt 0 ]; then
      echo "### On Local Branches (no worktree)"
      echo ""
      for slug in "${!LOCAL_BRANCH_INTENTS[@]}"; do
        IFS='|' read -r workflow branch <<< "${LOCAL_BRANCH_INTENTS[$slug]}"
        echo "- **$slug** (workflow: $workflow)"
        echo "  - *Branch: \`$branch\`*"
      done
      echo ""
    fi

    # Note: Remote intents not scanned by default for performance
    # Show hint instead
    if type discover_branch_intents &>/dev/null; then
      echo "*Run \`git fetch\` for remote intents (not scanned at startup for performance)*"
      echo ""
    fi

    echo "**To resume:** \`/resume <slug>\` or \`/resume\` if only one"
    echo ""
  else
    # No AI-DLC state and no resumable intents - show available workflows for /elaborate
    if [ -n "$AVAILABLE_WORKFLOWS" ]; then
      echo "## AI-DLC Available"
      echo ""
      echo "No active AI-DLC task. Run \`/elaborate\` to start a new task."
      echo ""
      echo "**Available workflows:**"
      echo "$AVAILABLE_WORKFLOWS"
      echo ""
    fi
  fi
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
# Only advance on 'clear' or 'startup' sources - NOT on 'compact' events.
#
# Source types:
#   - startup: New session starting (may advance iteration)
#   - clear: Context was manually cleared (may advance iteration)
#   - compact: Context window compaction by Claude (NEVER advance - this is just summarization)
#
# Note: This read-modify-write pattern is safe because Claude Code serializes
# hook execution within a session. Cross-session race conditions are possible
# but unlikely in practice since iterations are scoped to a branch/intent.
NEEDS_ADVANCE=$(echo "$ITERATION_JSON" | han parse json needsAdvance -r --default false 2>/dev/null || echo "false")
if [ "$NEEDS_ADVANCE" = "true" ] && [ "$SOURCE" != "compact" ]; then
  # Increment iteration and clear the flag
  CURRENT_ITER=$(echo "$ITERATION_JSON" | han parse json iteration -r --default 1)
  NEW_ITER=$((CURRENT_ITER + 1))
  ITERATION_JSON=$(echo "$ITERATION_JSON" | han parse json-set iteration "$NEW_ITER" 2>/dev/null)
  ITERATION_JSON=$(echo "$ITERATION_JSON" | han parse json-set needsAdvance false 2>/dev/null)
  # Intent-level state saved to current branch (or intent branch if on unit branch)
  if [ -n "$INTENT_BRANCH" ]; then
    han keep save --branch "$INTENT_BRANCH" iteration.json "$ITERATION_JSON" 2>/dev/null || true
  else
    han keep save iteration.json "$ITERATION_JSON" 2>/dev/null || true
  fi
fi

# Parse iteration state using han parse (no jq needed)
ITERATION=$(echo "$ITERATION_JSON" | han parse json iteration -r --default 1)
HAT=$(echo "$ITERATION_JSON" | han parse json hat -r --default elaborator)
STATUS=$(echo "$ITERATION_JSON" | han parse json status -r --default active)
WORKFLOW_NAME=$(echo "$ITERATION_JSON" | han parse json workflowName -r --default default)

# Validate workflow name against known workflows (loaded above from workflows.yml files)
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

# Helper function to load intent-level state
load_intent_state() {
  local key="$1"
  if [ -n "$INTENT_BRANCH" ]; then
    han keep load --branch "$INTENT_BRANCH" "$key" --quiet 2>/dev/null || echo ""
  else
    han keep load "$key" --quiet 2>/dev/null || echo ""
  fi
}

# Load and display intent (intent-level state from intent branch)
INTENT=$(load_intent_state intent.md)
if [ -n "$INTENT" ]; then
  echo "### Intent"
  echo ""
  echo "$INTENT"
  echo ""
fi

# Load and display completion criteria (intent-level state from intent branch)
CRITERIA=$(load_intent_state completion-criteria.md)
if [ -n "$CRITERIA" ]; then
  echo "### Completion Criteria"
  echo ""
  echo "$CRITERIA"
  echo ""
fi

# Load and display current plan (intent-level state from intent branch)
PLAN=$(load_intent_state current-plan.md)
if [ -n "$PLAN" ]; then
  echo "### Current Plan"
  echo ""
  echo "$PLAN"
  echo ""
fi

# Load and display blockers (unit-level state from current branch)
BLOCKERS=$(han keep load blockers.md --quiet 2>/dev/null || echo "")
if [ -n "$BLOCKERS" ]; then
  echo "### Previous Blockers"
  echo ""
  echo "$BLOCKERS"
  echo ""
fi

# Load and display scratchpad (unit-level state from current branch)
SCRATCHPAD=$(han keep load scratchpad.md --quiet 2>/dev/null || echo "")
if [ -n "$SCRATCHPAD" ]; then
  echo "### Learnings from Previous Iteration"
  echo ""
  echo "$SCRATCHPAD"
  echo ""
fi

# Load and display next prompt (unit-level state from current branch)
NEXT_PROMPT=$(han keep load next-prompt.md --quiet 2>/dev/null || echo "")
if [ -n "$NEXT_PROMPT" ]; then
  echo "### Continue With"
  echo ""
  echo "$NEXT_PROMPT"
  echo ""
fi

# Load and display DAG status (if units exist)
# Intent slug is intent-level state from intent branch
INTENT_SLUG=$(load_intent_state intent-slug)
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

# ============================================================================
# SHARED ITERATION MANAGEMENT INSTRUCTIONS
# These apply to ALL hats and are not customizable
# ============================================================================

echo ""
echo "---"
echo ""
echo "## Iteration Management (Required for ALL Hats)"
echo ""
echo "### Branch Per Unit (MANDATORY)"
echo ""
echo "You MUST work on a dedicated branch for this unit:"
echo ""
echo "\`\`\`bash"
echo "# Create if not exists:"
echo "git checkout -b ai-dlc/{intent-slug}/{unit-number}-{unit-slug}"
echo "# Or use worktrees for parallel work:"
echo "git worktree add ../{unit-slug} ai-dlc/{intent-slug}/{unit-number}-{unit-slug}"
echo "\`\`\`"
echo ""
echo "You MUST NOT work directly on main/master. This isolates work and prevents conflicts."
echo ""
echo "### Before Stopping (MANDATORY)"
echo ""
echo "Before every stop, you MUST:"
echo ""
echo "1. **Commit working changes**: \`git add -A && git commit\`"
echo "2. **Save scratchpad**: \`han keep save scratchpad.md \"...\"\`"
echo "3. **Write next prompt**: \`han keep save next-prompt.md \"...\"\`"
echo ""
echo "The next-prompt.md should contain what to continue with in the next iteration."
echo "Without this, progress may be lost if the session ends."
echo ""
echo "### Never Stop Arbitrarily"
echo ""
echo "- You MUST NOT stop mid-bolt without saving state"
echo "- If you need user input, use \`AskUserQuestion\` tool"
echo "- If blocked, document in \`han keep save --branch blockers.md\`"
echo ""

# Check branch naming convention (informational only)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [ -n "$CURRENT_BRANCH" ] && [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  if ! echo "$CURRENT_BRANCH" | grep -qE '^ai-dlc/[a-z0-9-]+/[0-9]+-[a-z0-9-]+$'; then
    echo "> **WARNING:** Current branch \`$CURRENT_BRANCH\` doesn't follow AI-DLC convention."
    echo "> Expected: \`ai-dlc/{intent-slug}/{unit-number}-{unit-slug}\`"
    echo "> Create correct branch before proceeding."
    echo ""
  fi
else
  echo "> **WARNING:** You are on \`${CURRENT_BRANCH:-main}\`. Create a unit branch before working."
  echo ""
fi

echo "---"
echo ""
echo "**Commands:** \`/construct\` (continue loop) | \`/reset\` (abandon task)"
echo ""
echo "> **No file changes?** If this hat's work is complete but no files were modified,"
echo "> save findings to scratchpad and run \`/advance\` to continue."
