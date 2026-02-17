---
name: git-worktrees-worktree-management
description: Manage git worktrees - list active worktrees, prune stale ones, and merge work back into the main branch.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Worktree Management

## Name

git-worktrees:worktree-management - Manage git worktrees created by subagents

## Synopsis

```
/worktree-management [list|prune|merge]
```

## Description

Manages git worktrees that were created by subagents for isolation. Provides commands to list active worktrees, prune stale ones, and merge completed work back into the current branch.

## Implementation

### List Worktrees

Show all active worktrees and their status:

```bash
git worktree list
```

For worktrees in the `.worktrees/` directory, also show their commit status:

```bash
for wt in .worktrees/*/; do
  if [ -d "$wt" ]; then
    echo "=== $(basename "$wt") ==="
    git -C "$wt" log --oneline -5
    echo ""
  fi
done
```

### Prune Stale Worktrees

Remove worktrees that are no longer needed:

```bash
# Remove all worktrees in .worktrees/
git worktree list --porcelain | grep "^worktree " | grep ".worktrees/" | while read -r line; do
  wt_path="${line#worktree }"
  git worktree remove "$wt_path"
done

# Clean up any stale entries
git worktree prune
```

### Merge Work Back

To merge a specific worktree's work into the current branch:

1. Identify the worktree and its commits
2. Cherry-pick or merge the commits into the main working tree
3. Remove the worktree after successful merge

```bash
# From the main working tree:
WORKTREE_NAME="agent-xxx"
WORKTREE_BRANCH=$(git -C ".worktrees/${WORKTREE_NAME}" rev-parse HEAD)

# Cherry-pick the commits
git cherry-pick "${WORKTREE_BRANCH}"

# Or create a merge
git merge "${WORKTREE_BRANCH}" --no-ff -m "merge: integrate work from ${WORKTREE_NAME}"

# Clean up
git worktree remove ".worktrees/${WORKTREE_NAME}"
```

## Example Interaction

**User:** List my active worktrees

**Agent:**
```
$ git worktree list
/path/to/repo                  abc1234 [main]
/path/to/repo/.worktrees/agent-1707123456-12345  def5678 (detached HEAD)
/path/to/repo/.worktrees/agent-1707123789-67890  ghi9012 (detached HEAD)

=== agent-1707123456-12345 ===
def5678 feat: implement user authentication
abc1234 Initial commit

=== agent-1707123789-67890 ===
ghi9012 fix: resolve database connection issue
abc1234 Initial commit
```

**User:** Merge the auth worktree and clean up

**Agent:** Cherry-picks the auth commit, removes the worktree, and prunes stale entries.
