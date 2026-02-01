#!/bin/bash
# pretooluse-inject.sh - PreToolUse hook for AI-DLC
#
# Injects AI-DLC context into Task and Skill tool prompts BEFORE execution.
# This allows AI-DLC to modify subagent prompts and skill invocations.
#
# Uses updatedInput to rewrite the prompt with AI-DLC context prepended.
# IMPORTANT: Do NOT set permissionDecision - it breaks updatedInput for Task tool.

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract tool name
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')

# Only process Task and Skill tools
if [ "$TOOL_NAME" != "Task" ] && [ "$TOOL_NAME" != "Skill" ]; then
  exit 0
fi

# Check for han CLI
if ! command -v han &> /dev/null; then
  exit 0
fi

# Check for AI-DLC state
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
INTENT_BRANCH=""
ITERATION_JSON=""

# Try current branch first
ITERATION_JSON=$(han keep load iteration.json --quiet 2>/dev/null || echo "")

# If not found and we're on a unit branch, try the parent intent branch
if [ -z "$ITERATION_JSON" ] && [[ "$CURRENT_BRANCH" == ai-dlc/*/* ]]; then
  INTENT_BRANCH=$(echo "$CURRENT_BRANCH" | sed 's|^\(ai-dlc/[^/]*\)/.*|\1|')
  ITERATION_JSON=$(han keep load --branch "$INTENT_BRANCH" iteration.json --quiet 2>/dev/null || echo "")
fi

if [ -z "$ITERATION_JSON" ]; then
  # No AI-DLC state - don't modify
  exit 0
fi

# Parse iteration state
ITERATION=$(echo "$ITERATION_JSON" | jq -r '.iteration // 1')
HAT=$(echo "$ITERATION_JSON" | jq -r '.hat // ""')
STATUS=$(echo "$ITERATION_JSON" | jq -r '.status // "active"')
WORKFLOW_NAME=$(echo "$ITERATION_JSON" | jq -r '.workflowName // "default"')

# Skip if no active task or completed
if [ "$STATUS" = "complete" ] || [ -z "$HAT" ]; then
  exit 0
fi

# Get workflow hats
WORKFLOW_HATS=$(echo "$ITERATION_JSON" | jq -r '.workflow // ["elaborator","planner","builder","reviewer"] | join(" → ")')

# Build AI-DLC context prefix
AI_DLC_CONTEXT="## AI-DLC Context

**Iteration:** $ITERATION | **Role:** $HAT | **Workflow:** $WORKFLOW_NAME ($WORKFLOW_HATS)
"

# Helper to load intent-level state
load_intent_state() {
  local key="$1"
  if [ -n "$INTENT_BRANCH" ]; then
    han keep load --branch "$INTENT_BRANCH" "$key" --quiet 2>/dev/null || echo ""
  else
    han keep load "$key" --quiet 2>/dev/null || echo ""
  fi
}

# Add intent if available
INTENT_SLUG=$(load_intent_state intent-slug)
if [ -n "$INTENT_SLUG" ]; then
  AI_DLC_CONTEXT+="
**Intent:** $INTENT_SLUG
"

  # Add completion criteria summary
  INTENT_DIR=".ai-dlc/${INTENT_SLUG}"
  if [ -f "$INTENT_DIR/intent.md" ]; then
    # Extract just the criteria section (first 10 lines after "## Success Criteria")
    CRITERIA=$(sed -n '/## Success Criteria/,/^##/p' "$INTENT_DIR/intent.md" 2>/dev/null | head -12 || echo "")
    if [ -n "$CRITERIA" ]; then
      AI_DLC_CONTEXT+="
$CRITERIA
"
    fi
  fi
fi

# Add current hat instructions (brief)
AI_DLC_CONTEXT+="
**Current Role:** You are acting as **$HAT** in the AI-DLC workflow.
"

# Add worktree reminder
CURRENT_DIR=$(pwd)
if [[ "$CURRENT_DIR" != /tmp/ai-dlc-* ]] && [[ "$CURRENT_BRANCH" != ai-dlc/* ]]; then
  AI_DLC_CONTEXT+="
⚠️ **Worktree Warning:** Work should happen in an isolated worktree at /tmp/ai-dlc-{intent-slug}/
"
fi

AI_DLC_CONTEXT+="
---

"

# Now modify the tool input based on tool type
if [ "$TOOL_NAME" = "Task" ]; then
  # For Task tool, modify the prompt parameter
  ORIGINAL_PROMPT=$(echo "$INPUT" | jq -r '.tool_input.prompt // ""')

  if [ -n "$ORIGINAL_PROMPT" ]; then
    # Prepend AI-DLC context to the prompt
    NEW_PROMPT="${AI_DLC_CONTEXT}${ORIGINAL_PROMPT}"

    # Output updatedInput (no permissionDecision!)
    jq -n --arg prompt "$NEW_PROMPT" '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "updatedInput": {
          "prompt": $prompt
        }
      }
    }'
  fi

elif [ "$TOOL_NAME" = "Skill" ]; then
  # For Skill tool, we can add context as additional arguments or modify behavior
  # The Skill tool takes: name, arguments (optional)
  SKILL_NAME=$(echo "$INPUT" | jq -r '.tool_input.name // ""')
  ORIGINAL_ARGS=$(echo "$INPUT" | jq -r '.tool_input.arguments // ""')

  # Prepend AI-DLC context to the arguments
  if [ -n "$ORIGINAL_ARGS" ]; then
    NEW_ARGS="${AI_DLC_CONTEXT}${ORIGINAL_ARGS}"
  else
    NEW_ARGS="$AI_DLC_CONTEXT"
  fi

  # Output updatedInput for Skill tool
  jq -n --arg args "$NEW_ARGS" '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "updatedInput": {
        "arguments": $args
      }
    }
  }'
fi
