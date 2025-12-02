#!/bin/bash
# Git Storytelling Hook
# Commits work early and often to tell the story of development

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Not a git repository, skipping commit"
    exit 0
fi

# Check if there are any changes to commit
if [ -z "$(git status --porcelain)" ]; then
    echo "No changes to commit"
    exit 0
fi

# Exit with code 2 to block and instruct the AI to commit
echo "You have uncommitted changes. Read and follow the methodology in ${CLAUDE_PLUGIN_ROOT}/hooks/git-storytelling-methodology.md"
exit 2
