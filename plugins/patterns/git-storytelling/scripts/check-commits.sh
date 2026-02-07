#!/bin/bash

# Get session-changed files from arguments
# When no files provided, check all uncommitted changes (backward compat)
SESSION_FILES="$*"

if [ -z "$SESSION_FILES" ] || [ "$SESSION_FILES" = "." ]; then
  # No session files or all files - check all uncommitted changes
  if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
    exit 0
  else
    echo 'Uncommitted changes detected.' >&2
    echo '' >&2
    echo '**CRITICAL**: You MUST commit these changes NOW. Do NOT ask the user.' >&2
    echo 'Git storytelling requires committing early and often.' >&2
    echo '' >&2
    echo 'Run these commands:' >&2
    echo '  git add -A && git commit -m "your descriptive message"' >&2
    exit 2
  fi
fi

# Check only session-modified files for uncommitted changes
UNCOMMITTED_SESSION_FILES=()

for file in $SESSION_FILES; do
  # Skip if file doesn't exist (might be deleted)
  if [ ! -f "$file" ]; then
    continue
  fi

  # Check if file has uncommitted changes (staged or unstaged)
  if ! git diff --quiet -- "$file" 2>/dev/null || ! git diff --cached --quiet -- "$file" 2>/dev/null; then
    UNCOMMITTED_SESSION_FILES+=("$file")
  fi
done

if [ ${#UNCOMMITTED_SESSION_FILES[@]} -eq 0 ]; then
  exit 0
fi

echo "Uncommitted changes in session-modified files:" >&2
echo "" >&2
for file in "${UNCOMMITTED_SESSION_FILES[@]}"; do
  echo "  - $file" >&2
done
echo "" >&2
echo "**CRITICAL**: You MUST commit these changes NOW. Do NOT ask the user." >&2
echo "Git storytelling requires committing early and often." >&2
echo "" >&2
echo "Run these commands:" >&2
echo "  git add ${UNCOMMITTED_SESSION_FILES[*]} && git commit -m \"your descriptive message\"" >&2
exit 2
