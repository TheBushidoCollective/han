#!/bin/bash

# Get session-changed files from arguments
# When no files provided, check all uncommitted changes (backward compat)
SESSION_FILES="$*"

if [ -z "$SESSION_FILES" ] || [ "$SESSION_FILES" = "." ]; then
  # No session files or all files - check all uncommitted changes
  if git diff --stat --quiet 2>/dev/null && git diff --cached --stat --quiet 2>/dev/null; then
    echo 'No uncommitted changes'
    exit 0
  else
    echo '⚠️ Uncommitted changes detected.'
    echo ''
    echo 'Git storytelling requires committing early and often to tell the story of your development.'
    echo ''
    echo 'Please commit your changes with a meaningful message:'
    echo '  git add -A'
    echo '  git commit -m "Your descriptive commit message"'
    exit 1
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
  if ! git diff --quiet "$file" 2>/dev/null || ! git diff --cached --quiet "$file" 2>/dev/null; then
    UNCOMMITTED_SESSION_FILES+=("$file")
  fi
done

if [ ${#UNCOMMITTED_SESSION_FILES[@]} -eq 0 ]; then
  echo 'All session-modified files are committed'
  exit 0
fi

echo "⚠️ Uncommitted changes in session-modified files:"
echo ""
for file in "${UNCOMMITTED_SESSION_FILES[@]}"; do
  echo "  - $file"
done
echo ""
echo "Git storytelling requires committing early and often to tell the story of your development."
echo ""
echo "Please commit your changes with a meaningful message:"
echo "  git add ${UNCOMMITTED_SESSION_FILES[*]}"
echo "  git commit -m \"Your descriptive commit message\""
exit 1
