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

# Run validation hooks via orchestrate
# Pass session ID via env var for hooks that need it
# Capture both stdout and exit code
export HAN_SESSION_ID="$SESSION_ID"
VALIDATION_OUTPUT=$(echo "$STOP_PAYLOAD" | han hook orchestrate Stop 2>&1) || VALIDATION_EXIT=$?
VALIDATION_EXIT=${VALIDATION_EXIT:-0}

# If validation failed, replace command with no-op that shows the error
if [ "$VALIDATION_EXIT" -ne 0 ]; then
  # Build the error command - use printf with %s to safely handle any characters
  # The validation output is passed as a separate argument, avoiding shell escaping issues
  ERROR_MESSAGE="Pre-commit validation failed. Fix the issues before committing:

$VALIDATION_OUTPUT"

  # Use jq to safely construct JSON with proper escaping
  # This handles newlines, quotes, backslashes, and any special characters
  ERROR_COMMAND=$(printf '%s' "$ERROR_MESSAGE" | jq -Rs '"printf '\''%s\\n'\'' " + (. | @json) + " >&2 && exit 1"')

  jq -n \
    --argjson cmd "$ERROR_COMMAND" \
    '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "allow",
        "updatedInput": {
          "command": $cmd
        },
        "additionalContext": "Pre-commit validation failed. The commit was skipped. Fix the issues and try again."
      }
    }'
  exit 0
fi

# Validation passed - allow commit to proceed
exit 0
