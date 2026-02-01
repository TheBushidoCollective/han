#!/bin/bash
# jj.sh - Jujutsu (jj) VCS Utilities for Shell Scripts
#
# Provides jj-specific functionality for AI-DLC workflows:
# - Workspace management (jj's equivalent to git worktrees)
# - Bookmark management (jj's equivalent to branches)
# - Git interop for PR creation
#
# Usage:
#   source jj.sh
#   workspaces=$(jj_list_workspaces)

# =============================================================================
# Detection and Verification
# =============================================================================

# Check if jj is installed and available
# Usage: is_jj_installed
# Returns: 0 if installed, 1 if not
is_jj_installed() {
  command -v jj >/dev/null 2>&1
}

# Check if directory is a jj repository
# Prefers jj over git for colocated repos (checks .jj first)
# Usage: is_jj_repo [directory]
# Returns: 0 if jj repo, 1 if not
is_jj_repo() {
  local dir="${1:-.}"

  # Check for .jj directory (faster than running jj root)
  if [ -d "$dir/.jj" ]; then
    return 0
  fi

  # Also try jj root for nested directories
  jj root --ignore-working-copy -R "$dir" >/dev/null 2>&1
}

# Get the jj repository root
# Usage: get_jj_root [directory]
# Returns: Absolute path to repo root (empty if not a jj repo)
get_jj_root() {
  local dir="${1:-.}"
  jj root --ignore-working-copy -R "$dir" 2>/dev/null
}

# Check if repo is colocated with git
# Usage: is_colocated_repo [directory]
# Returns: 0 if colocated, 1 if not
is_colocated_repo() {
  local dir="${1:-.}"
  local root
  root=$(get_jj_root "$dir")

  [ -n "$root" ] && [ -d "$root/.jj" ] && [ -d "$root/.git" ]
}

# =============================================================================
# Workspace Management
# =============================================================================

# List all jj workspaces as JSON
# Usage: jj_list_workspaces [directory]
# Returns: JSON array of workspace objects
jj_list_workspaces() {
  local dir="${1:-.}"
  local root
  root=$(get_jj_root "$dir")

  if [ -z "$root" ]; then
    echo "[]"
    return
  fi

  # Get workspace list with template output
  local output
  output=$(jj workspace list --template 'concat(name, "\t", working_copy_commit.commit_id().shortest(12), "\n")' -R "$root" 2>/dev/null) || {
    echo "[]"
    return
  }

  # Get current workspace
  local current
  current=$(jj_get_current_workspace "$dir")

  # Build JSON array
  local json="["
  local first=true

  while IFS=$'\t' read -r name commit; do
    [ -z "$name" ] && continue

    # Determine path
    local path
    if [ "$name" = "default" ]; then
      path="$root"
    else
      path="$root/.jj/workspaces/$name"
    fi

    # Determine if current
    local is_current="false"
    [ "$name" = "$current" ] && is_current="true"

    if [ "$first" = "true" ]; then
      first=false
    else
      json="$json,"
    fi

    json="$json{\"name\":\"$name\",\"path\":\"$path\",\"workingCopyCommit\":\"$commit\",\"isCurrent\":$is_current}"
  done <<< "$output"

  echo "${json}]"
}

# Get the current workspace name
# Usage: jj_get_current_workspace [directory]
# Returns: Workspace name (default if main workspace)
jj_get_current_workspace() {
  local dir="${1:-.}"
  local root
  root=$(get_jj_root "$dir")

  [ -z "$root" ] && echo "default" && return

  local workspace_root
  workspace_root=$(jj workspace root -R "$dir" 2>/dev/null) || {
    echo "default"
    return
  }

  if [ "$workspace_root" = "$root" ]; then
    echo "default"
  else
    # Extract workspace name from path
    basename "$workspace_root" 2>/dev/null || echo "default"
  fi
}

# Create a new jj workspace
# Usage: jj_create_workspace <name> <path> [directory]
# Returns: 0 on success, 1 on failure
jj_create_workspace() {
  local name="$1"
  local path="$2"
  local dir="${3:-.}"

  if [ -z "$name" ] || [ -z "$path" ]; then
    echo "Error: workspace name and path are required" >&2
    return 1
  fi

  jj workspace add --name "$name" "$path" -R "$dir" 2>&1
}

# Remove a jj workspace
# Usage: jj_remove_workspace <name> [directory]
# Returns: 0 on success, 1 on failure
jj_remove_workspace() {
  local name="$1"
  local dir="${2:-.}"

  if [ -z "$name" ]; then
    echo "Error: workspace name is required" >&2
    return 1
  fi

  if [ "$name" = "default" ]; then
    echo "Error: cannot remove the default workspace" >&2
    return 1
  fi

  jj workspace forget "$name" -R "$dir" 2>&1
}

# =============================================================================
# Bookmark Management (Branch Equivalent)
# =============================================================================

# List all bookmarks as JSON
# Usage: jj_list_bookmarks [directory]
# Returns: JSON array of bookmark objects
jj_list_bookmarks() {
  local dir="${1:-.}"

  local output
  output=$(jj bookmark list --template 'concat(name, "\t", commit_id.shortest(12), "\t", if(remote, remote, "local"), "\n")' -R "$dir" 2>/dev/null) || {
    echo "[]"
    return
  }

  local json="["
  local first=true

  while IFS=$'\t' read -r name commit remote_or_local; do
    [ -z "$name" ] && continue

    local is_remote="false"
    local remote="null"
    if [ "$remote_or_local" != "local" ]; then
      is_remote="true"
      remote="\"$remote_or_local\""
    fi

    if [ "$first" = "true" ]; then
      first=false
    else
      json="$json,"
    fi

    json="$json{\"name\":\"$name\",\"commit\":\"$commit\",\"isRemote\":$is_remote,\"remote\":$remote}"
  done <<< "$output"

  echo "${json}]"
}

# Create a new bookmark
# Usage: jj_create_bookmark <name> [revision] [directory]
jj_create_bookmark() {
  local name="$1"
  local revision="${2:-@}"
  local dir="${3:-.}"

  if [ -z "$name" ]; then
    echo "Error: bookmark name is required" >&2
    return 1
  fi

  jj bookmark create "$name" -r "$revision" -R "$dir" 2>&1
}

# Move a bookmark to a new revision
# Usage: jj_move_bookmark <name> <revision> [directory]
jj_move_bookmark() {
  local name="$1"
  local revision="$2"
  local dir="${3:-.}"

  if [ -z "$name" ] || [ -z "$revision" ]; then
    echo "Error: bookmark name and revision are required" >&2
    return 1
  fi

  jj bookmark set "$name" -r "$revision" -R "$dir" 2>&1
}

# Delete a bookmark
# Usage: jj_delete_bookmark <name> [directory]
jj_delete_bookmark() {
  local name="$1"
  local dir="${2:-.}"

  if [ -z "$name" ]; then
    echo "Error: bookmark name is required" >&2
    return 1
  fi

  jj bookmark delete "$name" -R "$dir" 2>&1
}

# =============================================================================
# Default Branch Detection
# =============================================================================

# Get the default branch (trunk) for the repo
# Uses trunk() revset which respects repo config
# Usage: jj_get_default_branch [directory]
# Returns: Default branch name or "main" as fallback
jj_get_default_branch() {
  local dir="${1:-.}"

  # Try to get trunk bookmark name from jj
  local output
  output=$(jj log -r "trunk()" --no-graph --template 'if(bookmarks, bookmarks)' -R "$dir" 2>/dev/null)

  if [ -n "$output" ]; then
    # May have multiple bookmarks, take the first one
    echo "$output" | awk '{print $1}'
    return
  fi

  # Fallback: check common branch names
  local bookmarks
  bookmarks=$(jj_list_bookmarks "$dir")

  for name in main master trunk develop; do
    if echo "$bookmarks" | grep -q "\"name\":\"$name\""; then
      echo "$name"
      return
    fi
  done

  echo "main"
}

# =============================================================================
# Git Interop (for PR creation in colocated repos)
# =============================================================================

# Push changes to git remote
# Usage: jj_git_push <bookmark> [remote] [directory]
jj_git_push() {
  local bookmark="$1"
  local remote="${2:-origin}"
  local dir="${3:-.}"

  if [ -z "$bookmark" ]; then
    echo "Error: bookmark name is required" >&2
    return 1
  fi

  jj git push --bookmark "$bookmark" --remote "$remote" -R "$dir" 2>&1
}

# Fetch from git remote
# Usage: jj_git_fetch [remote] [directory]
jj_git_fetch() {
  local remote="${1:-origin}"
  local dir="${2:-.}"

  jj git fetch --remote "$remote" -R "$dir" 2>&1
}

# =============================================================================
# Commit Operations
# =============================================================================

# Squash (combine) commits
# Useful for auto_squash option when merging
# Usage: jj_squash [revision] [directory]
jj_squash() {
  local revision="$1"
  local dir="${2:-.}"

  local rev_arg=""
  [ -n "$revision" ] && rev_arg="-r $revision"

  jj squash $rev_arg -R "$dir" 2>&1
}

# Create a new change (commit) with description
# Usage: jj_commit <description> [directory]
jj_commit() {
  local description="$1"
  local dir="${2:-.}"

  if [ -z "$description" ]; then
    echo "Error: description is required" >&2
    return 1
  fi

  jj commit -m "$description" -R "$dir" 2>&1
}

# Describe (update message of) the current change
# Usage: jj_describe <description> [revision] [directory]
jj_describe() {
  local description="$1"
  local revision="${2:-@}"
  local dir="${3:-.}"

  if [ -z "$description" ]; then
    echo "Error: description is required" >&2
    return 1
  fi

  jj describe -r "$revision" -m "$description" -R "$dir" 2>&1
}

# Rebase current change onto another revision
# Usage: jj_rebase <destination> [source] [directory]
jj_rebase() {
  local destination="$1"
  local source="${2:-@}"
  local dir="${3:-.}"

  if [ -z "$destination" ]; then
    echo "Error: destination revision is required" >&2
    return 1
  fi

  jj rebase -r "$source" -d "$destination" -R "$dir" 2>&1
}

# Check if there are conflicts in the working copy
# Usage: jj_has_conflicts [directory]
# Returns: 0 if conflicts exist, 1 if not
jj_has_conflicts() {
  local dir="${1:-.}"

  local output
  output=$(jj log -r @ --no-graph --template 'conflict' -R "$dir" 2>/dev/null)

  [ "$output" = "true" ]
}

# =============================================================================
# AI-DLC Integration
# =============================================================================

# Get AI-DLC workspace name for a unit
# Usage: jj_get_ai_dlc_workspace_name <intent_slug> <unit_slug>
# Returns: Workspace name like "ai-dlc-vcs-strategy-config-06-jj-support"
jj_get_ai_dlc_workspace_name() {
  local intent_slug="$1"
  local unit_slug="$2"
  echo "ai-dlc-${intent_slug}-${unit_slug}"
}

# Find AI-DLC workspaces for a given intent
# Usage: jj_find_ai_dlc_workspaces <intent_slug> [directory]
# Returns: JSON array of matching workspaces
jj_find_ai_dlc_workspaces() {
  local intent_slug="$1"
  local dir="${2:-.}"
  local prefix="ai-dlc-${intent_slug}-"

  local workspaces
  workspaces=$(jj_list_workspaces "$dir")

  # Filter workspaces by prefix
  echo "$workspaces" | jq -c "[.[] | select(.name | startswith(\"$prefix\"))]"
}

# Warning message for colocated repo workspace creation
COLOCATION_WARNING="
Note: Creating a workspace in a colocated git+jj repo.
The new workspace will be a pure jj workspace without git colocaton.
Use 'jj git push' from the new workspace to sync changes to git.
"

# Print colocation warning if applicable
# Usage: jj_warn_if_colocated [directory]
jj_warn_if_colocated() {
  local dir="${1:-.}"

  if is_colocated_repo "$dir"; then
    echo "$COLOCATION_WARNING" >&2
  fi
}
