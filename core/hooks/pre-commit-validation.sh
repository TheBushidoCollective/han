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
# Construct Stop payload with context from parent hook
STOP_PAYLOAD=$(cat <<EOF
{
  "session_id": "$SESSION_ID",
  "transcript_path": "$TRANSCRIPT_PATH",
  "cwd": "$CWD",
  "permission_mode": "$PERMISSION_MODE",
  "hook_event_name": "Stop",
  "stop_hook_active": true
}
EOF
)

# Run validation hooks via orchestrate
# Pass session ID via env var for hooks that need it
# Capture both stdout and exit code
export HAN_SESSION_ID="$SESSION_ID"
VALIDATION_OUTPUT=$(echo "$STOP_PAYLOAD" | han hook orchestrate Stop 2>&1) || VALIDATION_EXIT=$?
VALIDATION_EXIT=${VALIDATION_EXIT:-0}

# If validation failed, replace command with no-op that shows the error
if [ "$VALIDATION_EXIT" -ne 0 ]; then
  # Escape the output for JSON (replace newlines and quotes)
  ESCAPED_OUTPUT=$(echo "$VALIDATION_OUTPUT" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

  # Output JSON to replace command with echo that shows validation errors
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": {
      "command": "echo 'Pre-commit validation failed. Fix the issues before committing:\\n\\n$ESCAPED_OUTPUT' >&2 && exit 1"
    },
    "additionalContext": "Pre-commit validation failed. The commit was skipped. Fix the issues and try again."
  }
}
EOF
  exit 0
fi

# Validation passed - allow commit to proceed
exit 0
