#!/usr/bin/env bash
# Example validation hook script
#
# This hook runs on the Stop event and demonstrates:
# - Reading environment variables provided by Han
# - Outputting status messages
# - Exit codes (0 = success, non-zero = failure)
#
# Available environment variables:
# - CLAUDE_PLUGIN_ROOT: Path to the plugin directory
# - HAN_SESSION_ID: Current Claude Code session ID
# - HAN_PROJECT_DIR: Project directory being worked on
# - HAN_FILES: Space-separated list of changed files (for file-scoped hooks)

set -e

# Example: Log that the hook ran
echo "Example validation hook executed successfully"

# Example: Check for a condition (always passes in this example)
# In a real plugin, you might run linters, tests, or other validations here
if true; then
    echo "All example checks passed!"
    exit 0
else
    echo "ERROR: Example check failed" >&2
    exit 1
fi
