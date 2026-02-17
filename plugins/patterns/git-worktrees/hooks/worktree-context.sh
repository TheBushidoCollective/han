#!/usr/bin/env bash
# Generates worktree isolation context for subagent injection.
# Called by han hook wrap-subagent-context as a context command.
# Outputs markdown instructions that tell the subagent to work in an isolated worktree.

set -euo pipefail

# Verify we're in a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
WORKTREE_BASE="${REPO_ROOT}/.worktrees"

cat <<EOF
## Git Worktree Isolation

You are running as a subagent. To avoid interfering with other agents or the main session,
you MUST work in an isolated git worktree.

**Before starting any file modifications:**

1. Create a worktree from the current HEAD:
   \`\`\`bash
   mkdir -p "${WORKTREE_BASE}"
   WORKTREE_NAME="agent-\$(date +%s)-\$RANDOM"
   git worktree add "${WORKTREE_BASE}/\${WORKTREE_NAME}" --detach HEAD
   \`\`\`
2. Use \`${WORKTREE_BASE}/\${WORKTREE_NAME}\` as your working directory for ALL file operations (Read, Write, Edit, Bash, Glob, Grep)
3. Commit your changes within the worktree before completing your task:
   \`\`\`bash
   cd "${WORKTREE_BASE}/\${WORKTREE_NAME}"
   git add -A
   git commit -m "feat: <describe your changes>"
   \`\`\`
4. Do NOT delete the worktree - the orchestrator or user will handle cleanup

**Current repo:** ${REPO_ROOT}
**Current branch:** ${CURRENT_BRANCH}
**Worktree base path:** ${WORKTREE_BASE}/
EOF
