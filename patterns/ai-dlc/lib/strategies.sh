#!/bin/bash
# strategies.sh - AI-DLC Change Strategies (Shell Version)
#
# Implements the four change strategies for version control:
# - trunk: Creates ephemeral branch per unit, auto-merges after validation
# - bolt: Creates branch per bolt, MR per bolt
# - unit: Creates branch per unit, MR per unit (default)
# - intent: Single branch for entire intent, one MR at completion
#
# Usage:
#   source strategies.sh
#   branch=$(get_branch_name "unit" "my-intent" "01-setup")
#   should_create_pr "unit" "true" "" "false" && gh pr create ...

# Source configuration system
# Determine script directory reliably for both direct execution and sourcing
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  STRATEGIES_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  STRATEGIES_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi
# shellcheck source=config.sh
source "$STRATEGIES_SCRIPT_DIR/config.sh"

# Strategy descriptions (for help/info output)
describe_strategy() {
  local strategy="$1"
  case "$strategy" in
    trunk)
      echo "Ephemeral branches with auto-merge to trunk after each unit passes validation"
      ;;
    bolt)
      echo "Fine-grained PRs per bolt, requiring manual review for each"
      ;;
    unit)
      echo "Standard PRs per unit, balanced granularity for code review"
      ;;
    intent)
      echo "Single PR for entire intent, best for cohesive feature work"
      ;;
    *)
      echo "Unknown strategy: $strategy" >&2
      return 1
      ;;
  esac
}

# Get the branch name for a given strategy and context
# Usage: get_branch_name <strategy> <intent> <unit> [bolt]
# Returns: branch name string
get_branch_name() {
  local strategy="$1"
  local intent="$2"
  local unit="$3"
  local bolt="${4:-}"

  case "$strategy" in
    trunk|unit)
      # Branch per unit: ai-dlc/{intent}/{unit}
      echo "ai-dlc/${intent}/${unit}"
      ;;
    bolt)
      # Branch per bolt: ai-dlc/{intent}/{unit}/{bolt}
      if [ -n "$bolt" ]; then
        echo "ai-dlc/${intent}/${unit}/${bolt}"
      else
        # Fallback if bolt not provided
        echo "ai-dlc/${intent}/${unit}"
      fi
      ;;
    intent)
      # Single branch for intent: ai-dlc/{intent}
      echo "ai-dlc/${intent}"
      ;;
    *)
      echo "Error: Unknown strategy '$strategy'" >&2
      return 1
      ;;
  esac
}

# Determine if a PR should be created at this point
# Usage: should_create_pr <strategy> <unit_complete> <bolt_complete> <intent_complete>
# Returns: 0 (true) if PR should be created, 1 (false) otherwise
should_create_pr() {
  local strategy="$1"
  local unit_complete="${2:-false}"
  local bolt_complete="${3:-false}"
  local intent_complete="${4:-false}"

  case "$strategy" in
    trunk)
      # Trunk strategy never creates PRs - uses auto-merge
      return 1
      ;;
    bolt)
      # Create PR when bolt is complete
      [ "$bolt_complete" = "true" ]
      ;;
    unit)
      # Create PR when unit is complete
      [ "$unit_complete" = "true" ]
      ;;
    intent)
      # Only create PR when entire intent is complete
      [ "$intent_complete" = "true" ]
      ;;
    *)
      echo "Error: Unknown strategy '$strategy'" >&2
      return 1
      ;;
  esac
}

# Determine if auto-merge should happen
# Usage: should_auto_merge <strategy> <validation_passed> <unit_complete> [config_auto_merge]
# Returns: 0 (true) if should auto-merge, 1 (false) otherwise
should_auto_merge() {
  local strategy="$1"
  local validation_passed="${2:-false}"
  local unit_complete="${3:-false}"
  local config_auto_merge="${4:-}"

  # Check for explicit override in config
  if [ -n "$config_auto_merge" ]; then
    if [ "$config_auto_merge" = "true" ] && [ "$validation_passed" = "true" ]; then
      return 0
    elif [ "$config_auto_merge" = "false" ]; then
      return 1
    fi
  fi

  case "$strategy" in
    trunk)
      # Auto-merge when validation passes and unit is complete
      [ "$validation_passed" = "true" ] && [ "$unit_complete" = "true" ]
      ;;
    bolt|unit|intent)
      # These strategies require manual merge review
      return 1
      ;;
    *)
      echo "Error: Unknown strategy '$strategy'" >&2
      return 1
      ;;
  esac
}

# Create a branch for the current context
# Usage: create_branch <strategy> <intent> <unit> [bolt] [base_branch]
# Returns: created branch name, or exits with error
create_branch() {
  local strategy="$1"
  local intent="$2"
  local unit="$3"
  local bolt="${4:-}"
  local base_branch="${5:-}"

  local branch_name
  branch_name=$(get_branch_name "$strategy" "$intent" "$unit" "$bolt")

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  local vcs
  vcs=$(detect_vcs "$repo_root")

  # Get default branch if not specified
  if [ -z "$base_branch" ]; then
    local config
    config=$(get_ai_dlc_config "" "$repo_root")
    base_branch=$(echo "$config" | jq -r '.default_branch')
  fi

  if [ "$vcs" = "jj" ]; then
    # jj uses bookmarks
    jj bookmark create "$branch_name" --at @- 2>/dev/null || true
  else
    # git branch creation
    if git -C "$repo_root" rev-parse --verify "$branch_name" >/dev/null 2>&1; then
      # Branch exists, check it out
      git -C "$repo_root" checkout "$branch_name"
    else
      # Create new branch from base
      git -C "$repo_root" checkout -b "$branch_name" "$base_branch"
    fi
  fi

  echo "$branch_name"
}

# Create a PR/MR for the current branch
# Usage: create_pr <title> <body> [base_branch] [draft]
# Returns: PR URL or empty on failure
create_pr() {
  local title="$1"
  local body="$2"
  local base_branch="${3:-}"
  local draft="${4:-false}"

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  local vcs
  vcs=$(detect_vcs "$repo_root")

  # Get default branch if not specified
  if [ -z "$base_branch" ]; then
    local config
    config=$(get_ai_dlc_config "" "$repo_root")
    base_branch=$(echo "$config" | jq -r '.default_branch')
  fi

  if [ "$vcs" = "jj" ]; then
    echo "PR creation for jj not yet implemented" >&2
    return 1
  fi

  # Push current branch first
  git -C "$repo_root" push -u origin HEAD >/dev/null 2>&1 || {
    echo "Failed to push branch" >&2
    return 1
  }

  # Build gh pr create command
  local draft_flag=""
  [ "$draft" = "true" ] && draft_flag="--draft"

  # Create PR using gh CLI with heredoc for body
  gh pr create \
    --title "$title" \
    --body "$(cat <<EOF
$body
EOF
)" \
    --base "$base_branch" \
    $draft_flag \
    2>&1
}

# Auto-merge the current branch into the base branch
# Only used for trunk strategy
# Usage: auto_merge [squash] [base_branch]
# Returns: 0 on success, 1 on failure
auto_merge() {
  local squash="${1:-false}"
  local base_branch="${2:-}"

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  local config
  config=$(get_ai_dlc_config "" "$repo_root")

  # Get default branch and squash setting from config if not specified
  if [ -z "$base_branch" ]; then
    base_branch=$(echo "$config" | jq -r '.default_branch')
  fi
  if [ "$squash" = "false" ]; then
    squash=$(echo "$config" | jq -r '.auto_squash // "false"')
  fi

  # Get current branch
  local current_branch
  current_branch=$(git -C "$repo_root" branch --show-current)

  # Checkout base branch
  git -C "$repo_root" checkout "$base_branch" || {
    echo "Failed to checkout $base_branch" >&2
    return 1
  }

  # Pull latest
  git -C "$repo_root" pull origin "$base_branch" || {
    echo "Failed to pull latest $base_branch" >&2
    return 1
  }

  # Merge the feature branch
  local merge_flag="--no-ff"
  [ "$squash" = "true" ] && merge_flag="--squash"

  git -C "$repo_root" merge $merge_flag "$current_branch" || {
    echo "Failed to merge $current_branch" >&2
    return 1
  }

  # If squashing, need to commit
  if [ "$squash" = "true" ]; then
    git -C "$repo_root" commit -m "Merge $current_branch (squashed)" || {
      echo "Failed to commit squash merge" >&2
      return 1
    }
  fi

  # Push to remote
  git -C "$repo_root" push origin "$base_branch" || {
    echo "Failed to push $base_branch" >&2
    return 1
  }

  # Delete the merged branch locally
  git -C "$repo_root" branch -d "$current_branch" || true

  # Delete remote branch (ignore errors if doesn't exist)
  git -C "$repo_root" push origin --delete "$current_branch" 2>/dev/null || true

  return 0
}

# Parse intent, unit, and bolt from a branch name
# Usage: parse_branch_name <branch_name>
# Returns: JSON object with intent, unit, bolt fields
parse_branch_name() {
  local branch_name="$1"

  # Match ai-dlc/{intent}[/{unit}][/{bolt}]
  if [[ ! "$branch_name" =~ ^ai-dlc/ ]]; then
    echo "{}"
    return 1
  fi

  # Remove ai-dlc/ prefix and split
  local path="${branch_name#ai-dlc/}"
  local intent unit bolt

  # Split by /
  IFS='/' read -r intent unit bolt <<< "$path"

  # Build JSON result
  local result="{\"intent\": \"$intent\""
  [ -n "$unit" ] && result="$result, \"unit\": \"$unit\""
  [ -n "$bolt" ] && result="$result, \"bolt\": \"$bolt\""
  result="$result}"

  echo "$result"
}

# Get the current branch name
# Usage: get_current_branch [repo_root]
# Returns: current branch name or empty
get_current_branch() {
  local repo_root="${1:-$(find_repo_root)}"
  [ -z "$repo_root" ] && repo_root="."

  local vcs
  vcs=$(detect_vcs "$repo_root")

  if [ "$vcs" = "jj" ]; then
    # jj uses bookmarks - get first tracked bookmark
    jj bookmark list --tracked -R "$repo_root" 2>/dev/null | head -1 | awk '{print $1}'
  else
    git -C "$repo_root" branch --show-current 2>/dev/null
  fi
}

# Check if we're on an AI-DLC branch
# Usage: is_on_ai_dlc_branch [repo_root]
# Returns: 0 if on AI-DLC branch, 1 otherwise
is_on_ai_dlc_branch() {
  local repo_root="${1:-}"
  local branch
  branch=$(get_current_branch "$repo_root")

  [[ "$branch" == ai-dlc/* ]]
}

# Get strategy recommendation based on project characteristics
# Usage: recommend_strategy [repo_root]
# Returns: strategy name and reason as JSON
recommend_strategy() {
  local repo_root="${1:-$(find_repo_root)}"
  [ -z "$repo_root" ] && repo_root="."

  # Check for CI configuration
  local has_ci=false
  [ -d "$repo_root/.github/workflows" ] && has_ci=true
  [ -f "$repo_root/.gitlab-ci.yml" ] && has_ci=true
  [ -f "$repo_root/Jenkinsfile" ] && has_ci=true

  # Check for test configuration
  local has_tests=false
  [ -f "$repo_root/jest.config.js" ] && has_tests=true
  [ -f "$repo_root/vitest.config.ts" ] && has_tests=true
  [ -f "$repo_root/pytest.ini" ] && has_tests=true
  [ -f "$repo_root/Cargo.toml" ] && has_tests=true

  # If CI and tests exist, trunk strategy is viable
  if [ "$has_ci" = "true" ] && [ "$has_tests" = "true" ]; then
    cat <<EOF
{
  "strategy": "trunk",
  "reason": "CI and tests detected - trunk strategy with auto-merge recommended for fast iteration"
}
EOF
    return
  fi

  # Default to unit strategy
  cat <<EOF
{
  "strategy": "unit",
  "reason": "Unit strategy provides good balance of review granularity and merge frequency"
}
EOF
}

# Validate strategy name
# Usage: validate_strategy <strategy>
# Returns: 0 if valid, 1 if invalid
validate_strategy() {
  local strategy="$1"
  case "$strategy" in
    trunk|bolt|unit|intent)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Get list of valid strategies
# Usage: list_strategies
# Returns: space-separated list of valid strategies
list_strategies() {
  echo "trunk bolt unit intent"
}

# Print strategy comparison table
# Usage: print_strategy_table
print_strategy_table() {
  cat <<'EOF'
| Strategy | Branch Pattern              | PR Timing            | Auto-merge |
|----------|----------------------------|----------------------|------------|
| trunk    | ai-dlc/{intent}/{unit}     | None                 | Yes        |
| bolt     | ai-dlc/{intent}/{unit}/{bolt} | Per bolt          | No         |
| unit     | ai-dlc/{intent}/{unit}     | Per unit             | No         |
| intent   | ai-dlc/{intent}            | At intent completion | No         |
EOF
}
