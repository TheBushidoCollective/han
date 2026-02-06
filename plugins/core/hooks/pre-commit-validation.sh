#!/bin/bash
# pre-commit-validation.sh - PreToolUse hook for git commit validation
#
# Previously intercepted git commit commands and ran validation hooks
# before the commit. Now a no-op since orchestrate has been removed.
# Validation hooks run directly via Claude Code's Stop event.
#
# Stdin: PreToolUse JSON payload
# Exit: 0 always (pass through)

exit 0
