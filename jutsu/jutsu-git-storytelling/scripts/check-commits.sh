#!/bin/bash

if git diff --stat --quiet 2>/dev/null && git diff --cached --stat --quiet 2>/dev/null; then
  echo 'No uncommitted changes'
  exit 0
else
  echo '⚠️ Uncommitted changes detected.'
  echo ''
  echo 'Git storytelling requires committing early and often to tell the story of your development.'
  echo ''
  echo 'Please commit your changes with a meaningful message, then push:'
  echo '  git add -A'
  echo '  git commit -m "Your descriptive commit message"'
  echo '  git push'
  exit 1
fi
