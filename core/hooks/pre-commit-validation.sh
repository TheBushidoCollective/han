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

# Parse tool_name, command, and session_id from JSON
TOOL_NAME=$(echo "$INPUT" | han parse json tool_name -r 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | han parse json tool_input.command -r 2>/dev/null || echo "")
SESSION_ID=$(echo "$INPUT" | han parse json session_id -r 2>/dev/null || echo "")

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
# Construct a minimal Stop payload for the hooks, including session_id
STOP_PAYLOAD=$(cat <<EOF
{
  "stopReason": "pre_commit_validation",
  "hook_event": "Stop",
  "session_id": "$SESSION_ID"
}
EOF
)

# Run validation hooks via orchestrate
# Pass session ID via env var for hooks that need it
# Capture both stdout and exit code
export HAN_SESSION_ID="$SESSION_ID"
VALIDATION_OUTPUT=$(echo "$STOP_PAYLOAD" | han hook orchestrate Stop 2>&1) || VALIDATION_EXIT=$?
VALIDATION_EXIT=${VALIDATION_EXIT:-0}

# If validation failed, block the commit
if [ "$VALIDATION_EXIT" -ne 0 ]; then
  # Output deny JSON
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Pre-commit validation failed. Fix the issues before committing:\n\n$VALIDATION_OUTPUT"
  }
}
EOF
  exit 0
fi

# Validation passed - allow commit to proceed
exit 0
