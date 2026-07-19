#!/usr/bin/env bash
# worktree-merge-prompt.sh - SubagentStop hook for discipline agents
# Detects if running in a worktree with changes and prompts user with merge options.
#
# Registered globally by the core plugin as a SubagentStop hook in
# hooks/hooks.json. Plugin-shipped agents cannot define their own `hooks:`
# frontmatter (Claude Code ignores it for security reasons), so the core
# plugin fires this for every subagent; it no-ops instantly unless the
# subagent's cwd is inside .claude/worktrees/.
#
# Exit 0 = no action needed (not in worktree, or no changes)
# JSON output with decision: "block" = changes exist, ask user what to do
set -euo pipefail

# Read stdin JSON payload
PAYLOAD=""
if [ ! -t 0 ]; then
  PAYLOAD=$(cat)
fi

# Extract cwd from payload, fall back to current directory
CWD=$(echo "$PAYLOAD" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cwd',''))" 2>/dev/null || echo "")
if [ -z "$CWD" ]; then
  CWD="$(pwd)"
fi

# Check if we're in a worktree (look for .claude/worktrees/ in the path)
if [[ "$CWD" != *"/.claude/worktrees/"* ]]; then
  # Not in a worktree - nothing to do
  exit 0
fi

cd "$CWD"

# Check for uncommitted changes
UNCOMMITTED=$(git status --porcelain 2>/dev/null || echo "")

# Check for new commits vs main branch
# Try main first, then master, then the default branch
MAIN_BRANCH=""
for branch in main master; do
  if git rev-parse --verify "$branch" &>/dev/null; then
    MAIN_BRANCH="$branch"
    break
  fi
done

NEW_COMMITS=""
if [ -n "$MAIN_BRANCH" ]; then
  NEW_COMMITS=$(git log --oneline "HEAD...$MAIN_BRANCH" 2>/dev/null | head -20 || echo "")
fi

# If no changes and no new commits, exit cleanly
if [ -z "$UNCOMMITTED" ] && [ -z "$NEW_COMMITS" ]; then
  exit 0
fi

# Build summary of changes
CHANGE_SUMMARY=""
if [ -n "$UNCOMMITTED" ]; then
  FILE_COUNT=$(echo "$UNCOMMITTED" | wc -l | tr -d ' ')
  CHANGE_SUMMARY="$FILE_COUNT uncommitted file(s)"
fi
if [ -n "$NEW_COMMITS" ]; then
  COMMIT_COUNT=$(echo "$NEW_COMMITS" | wc -l | tr -d ' ')
  if [ -n "$CHANGE_SUMMARY" ]; then
    CHANGE_SUMMARY="$CHANGE_SUMMARY and $COMMIT_COUNT new commit(s)"
  else
    CHANGE_SUMMARY="$COMMIT_COUNT new commit(s)"
  fi
fi

# Extract branch name
BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "unknown")

# Return block decision with instructions for Claude
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStop",
    "decision": "block",
    "reason": "This agent worked in a worktree and has $CHANGE_SUMMARY on branch '$BRANCH_NAME'. Before cleaning up, use AskUserQuestion to ask what to do with these changes:\n\n1. **Create a draft PR** - Commit any uncommitted changes, push the branch, and create a draft PR\n2. **Merge to original branch** - Merge the worktree branch into the branch that was active before isolation\n3. **Keep worktree** - Leave the worktree intact at $CWD for manual review later\n4. **Discard all changes** - Remove the worktree and all changes"
  }
}
EOF
