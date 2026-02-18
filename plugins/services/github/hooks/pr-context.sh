#!/usr/bin/env bash
# GitHub PR context detection for SessionStart
# Detects current branch and instructs agent to ask user about loading PR context
set -euo pipefail

# Guard: must be in a git repo
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  exit 0
fi

# Guard: skip detached HEAD
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null) || exit 0

# Guard: skip default/release branches
case "$BRANCH" in
  main|master|develop|development|staging|production|release|release/*) exit 0 ;;
esac

# Guard: remote must be github.com
REMOTE_URL=$(git remote get-url origin 2>/dev/null) || exit 0
if [[ "$REMOTE_URL" != *"github.com"* ]]; then
  exit 0
fi

# Extract owner/repo from remote URL
# Handles: git@github.com:owner/repo.git, https://github.com/owner/repo.git
OWNER_REPO=$(echo "$REMOTE_URL" | sed -E 's#(git@github\.com:|https://github\.com/)##' | sed -E 's/\.git$//')
OWNER=$(echo "$OWNER_REPO" | cut -d'/' -f1)
REPO=$(echo "$OWNER_REPO" | cut -d'/' -f2)

cat <<EOF
<pr-context-prompt branch="${BRANCH}" repo="${OWNER}/${REPO}">
You are on branch \`${BRANCH}\` in \`${OWNER}/${REPO}\`.

Use the AskUserQuestion tool to ask:
- question: "You're on branch \`${BRANCH}\`. Want me to load the PR context for this branch?"
- header: "PR Context"
- options:
  - label: "Yes (Recommended)", description: "Load PR description, changes, CI status, and review comments"
  - label: "No", description: "Skip PR context loading"

If the user selects "Yes", invoke the skill \`github:load-pr-context\` with args "${OWNER}/${REPO} ${BRANCH}".
If the user selects "No", continue without loading PR context.
</pr-context-prompt>
EOF
