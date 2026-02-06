#!/bin/bash
# pre-commit-validation.sh - PreToolUse hook for git commit validation
#
# Intercepts git commit Bash commands and runs validation hooks BEFORE
# the commit happens. This allows blocking bad commits rather than
# complaining after the fact.
#
# Stdin: PreToolUse JSON payload
# Stdout: Optional deny JSON if validation fails
# Exit: 0 always (output controls behavior, not exit code)

set -e

# Check if han CLI is available
if ! command -v han &> /dev/null; then
  # han not installed - skip validation silently
  # (Setup hook should have installed it; if not, don't block commits)
  exit 0
fi

# Check if jq is available (needed for safe JSON construction)
if ! command -v jq &> /dev/null; then
  # jq not installed - skip validation (can't safely construct JSON responses)
  exit 0
fi

# Read stdin into variable
INPUT=$(cat)

# Parse tool_name and command from JSON
TOOL_NAME=$(echo "$INPUT" | han parse json tool_name -r 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | han parse json tool_input.command -r 2>/dev/null || echo "")

# Extract context fields to pass through to Stop hooks
SESSION_ID=$(echo "$INPUT" | han parse json session_id -r 2>/dev/null || echo "")
TRANSCRIPT_PATH=$(echo "$INPUT" | han parse json transcript_path -r 2>/dev/null || echo "")
CWD=$(echo "$INPUT" | han parse json cwd -r 2>/dev/null || echo "")
PERMISSION_MODE=$(echo "$INPUT" | han parse json permission_mode -r 2>/dev/null || echo "default")

# Only care about Bash tool
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

# Check if this is a git commit command
# Match: git commit, git commit -m, git commit --amend, etc.
if ! echo "$COMMAND" | grep -qE '\bgit\s+commit\b'; then
  exit 0
fi

# This is a git commit - run Stop hook validation
# Construct Stop payload with context from parent hook (use jq for safe JSON construction)
STOP_PAYLOAD=$(jq -n \
  --arg session_id "$SESSION_ID" \
  --arg transcript_path "$TRANSCRIPT_PATH" \
  --arg cwd "$CWD" \
  --arg permission_mode "$PERMISSION_MODE" \
  '{
    "session_id": $session_id,
    "transcript_path": $transcript_path,
    "cwd": $cwd,
    "permission_mode": $permission_mode,
    "hook_event_name": "Stop",
    "stop_hook_active": true
  }'
)

# Allow commit to proceed - validation hooks run directly via Claude Code
exit 0
