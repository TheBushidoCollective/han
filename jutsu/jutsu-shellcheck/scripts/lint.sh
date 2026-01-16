#!/bin/bash
set -e

# Find all shell scripts tracked by git and run shellcheck on them
# Filter to only files that actually exist (handles deleted files in git status)
git ls-files | grep '\.sh$' | while read -r file; do
  if [ -f "$file" ]; then
    echo "$file"
  fi
done | xargs -r shellcheck
