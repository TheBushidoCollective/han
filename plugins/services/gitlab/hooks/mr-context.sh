#!/usr/bin/env bash
# GitLab MR context detection for SessionStart
# Detects current branch and instructs agent to ask user about loading MR context
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

# Guard: remote must contain gitlab
REMOTE_URL=$(git remote get-url origin 2>/dev/null) || exit 0
if [[ "$REMOTE_URL" != *"gitlab"* ]]; then
  exit 0
fi

# Extract project path from remote URL
# Handles: git@gitlab.com:group/project.git, https://gitlab.com/group/project.git
# Also handles self-hosted: git@gitlab.example.com:group/subgroup/project.git
PROJECT_PATH=$(echo "$REMOTE_URL" | sed -E 's#(git@[^:]+:|https?://[^/]+/)##' | sed -E 's/\.git$//')

cat <<EOF
<mr-context-prompt branch="${BRANCH}" project="${PROJECT_PATH}">
You are on branch \`${BRANCH}\` in GitLab project \`${PROJECT_PATH}\`.

Use the AskUserQuestion tool to ask:
- question: "You're on branch \`${BRANCH}\`. Want me to load the MR context for this branch?"
- header: "MR Context"
- options:
  - label: "Yes (Recommended)", description: "Load MR description, changes, pipeline status, and review comments"
  - label: "No", description: "Skip MR context loading"

If the user selects "Yes", invoke the skill \`gitlab:load-mr-context\` with args "${PROJECT_PATH} ${BRANCH}".
If the user selects "No", continue without loading MR context.
</mr-context-prompt>
EOF
