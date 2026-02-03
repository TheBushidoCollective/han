#!/bin/bash
set -e

# Get session-changed files from arguments
# When no files provided, check all git-tracked shell scripts (backward compat)
SESSION_FILES="$*"

if [ -z "$SESSION_FILES" ] || [ "$SESSION_FILES" = "." ]; then
  # No session files or all files - check all git-tracked shell scripts
  git ls-files | grep '\.sh$' | while read -r file; do
    if [ -f "$file" ]; then
      echo "$file"
    fi
  done | xargs -r shellcheck
else
  # Check only session-modified shell scripts
  # shellcheck disable=SC2068
  for file in $@; do
    if [ -f "$file" ] && [[ "$file" == *.sh ]]; then
      echo "$file"
    fi
  done | xargs -r shellcheck
fi
