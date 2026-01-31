#!/bin/bash
# config.sh - AI-DLC Configuration System (Shell Version)
#
# Provides configuration loading with precedence:
# 1. Intent frontmatter (highest priority)
# 2. Repo settings (.ai-dlc/settings.yml)
# 3. Built-in defaults (lowest priority)
#
# Usage:
#   source config.sh
#   config=$(get_ai_dlc_config "$intent_dir")
#   change_strategy=$(echo "$config" | jq -r '.change_strategy')

# Default configuration values
AI_DLC_DEFAULT_CHANGE_STRATEGY="unit"
AI_DLC_DEFAULT_ELABORATION_REVIEW="true"
AI_DLC_DEFAULT_BRANCH="auto"

# Detect which VCS is being used
# Usage: detect_vcs [directory]
# Returns: 'git' | 'jj' | ''
detect_vcs() {
  local dir="${1:-.}"

  # Check for jj first (it can coexist with git)
  if jj root --ignore-working-copy -R "$dir" >/dev/null 2>&1; then
    echo "jj"
    return
  fi

  # Check for git
  if git -C "$dir" rev-parse --git-dir >/dev/null 2>&1; then
    echo "git"
    return
  fi

  # No VCS found
  echo ""
}

# Find repository root directory
# Usage: find_repo_root [directory]
# Returns: repo root path or empty string
find_repo_root() {
  local dir="${1:-.}"
  local vcs
  vcs=$(detect_vcs "$dir")

  case "$vcs" in
    jj)
      jj root --ignore-working-copy -R "$dir" 2>/dev/null
      ;;
    git)
      git -C "$dir" rev-parse --show-toplevel 2>/dev/null
      ;;
    *)
      echo ""
      ;;
  esac
}

# Resolve 'auto' default branch to actual branch name
# Usage: resolve_default_branch <config_value> [directory]
# Returns: resolved branch name
resolve_default_branch() {
  local config_value="$1"
  local dir="${2:-.}"

  if [ "$config_value" != "auto" ]; then
    echo "$config_value"
    return
  fi

  # Try to get from origin/HEAD
  local head_ref
  head_ref=$(git -C "$dir" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null)
  if [ -n "$head_ref" ]; then
    # Extract branch name from refs/remotes/origin/main
    basename "$head_ref"
    return
  fi

  # Fallback: check if main exists
  if git -C "$dir" rev-parse --verify main >/dev/null 2>&1; then
    echo "main"
    return
  fi

  # Fallback: check if master exists
  if git -C "$dir" rev-parse --verify master >/dev/null 2>&1; then
    echo "master"
    return
  fi

  # Ultimate fallback
  echo "main"
}

# Load repo settings from .ai-dlc/settings.yml
# Usage: load_repo_settings [repo_root]
# Returns: JSON object with git/jj config or '{}'
load_repo_settings() {
  local repo_root="${1:-$(find_repo_root)}"
  local settings_file="$repo_root/.ai-dlc/settings.yml"

  if [ ! -f "$settings_file" ]; then
    echo "{}"
    return
  fi

  # Parse YAML to JSON
  han parse yaml --json < "$settings_file" 2>/dev/null || echo "{}"
}

# Load intent overrides from intent.md frontmatter
# Usage: load_intent_overrides <intent_dir>
# Returns: JSON object with git/jj config or '{}'
load_intent_overrides() {
  local intent_dir="$1"
  local intent_file="$intent_dir/intent.md"

  if [ ! -f "$intent_file" ]; then
    echo "{}"
    return
  fi

  # Extract git/jj keys from frontmatter
  local git_config jj_config
  git_config=$(han parse yaml git --json < "$intent_file" 2>/dev/null || echo "null")
  jj_config=$(han parse yaml jj --json < "$intent_file" 2>/dev/null || echo "null")

  # Build result object
  local result="{}"
  if [ "$git_config" != "null" ] && [ -n "$git_config" ]; then
    result=$(echo "$result" | jq --argjson git "$git_config" '. + {git: $git}')
  fi
  if [ "$jj_config" != "null" ] && [ -n "$jj_config" ]; then
    result=$(echo "$result" | jq --argjson jj "$jj_config" '. + {jj: $jj}')
  fi

  echo "$result"
}

# Get merged AI-DLC configuration
# Usage: get_ai_dlc_config [intent_dir] [repo_root]
# Returns: JSON object with complete VcsConfig
get_ai_dlc_config() {
  local intent_dir="${1:-}"
  local repo_root="${2:-$(find_repo_root)}"
  local vcs
  vcs=$(detect_vcs "$repo_root")
  [ -z "$vcs" ] && vcs="git"

  # Start with defaults as JSON
  local config
  config=$(cat <<EOF
{
  "change_strategy": "$AI_DLC_DEFAULT_CHANGE_STRATEGY",
  "elaboration_review": $AI_DLC_DEFAULT_ELABORATION_REVIEW,
  "default_branch": "$AI_DLC_DEFAULT_BRANCH"
}
EOF
)

  # Layer 1: Repo settings
  if [ -n "$repo_root" ]; then
    local repo_settings
    repo_settings=$(load_repo_settings "$repo_root")
    local vcs_settings
    vcs_settings=$(echo "$repo_settings" | jq -c ".$vcs // {}")
    if [ "$vcs_settings" != "{}" ] && [ "$vcs_settings" != "null" ]; then
      config=$(echo "$config" "$vcs_settings" | jq -s '.[0] * .[1]')
    fi
  fi

  # Layer 2: Intent overrides (highest priority)
  if [ -n "$intent_dir" ] && [ -d "$intent_dir" ]; then
    local intent_overrides
    intent_overrides=$(load_intent_overrides "$intent_dir")
    local intent_vcs_settings
    intent_vcs_settings=$(echo "$intent_overrides" | jq -c ".$vcs // {}")
    if [ "$intent_vcs_settings" != "{}" ] && [ "$intent_vcs_settings" != "null" ]; then
      config=$(echo "$config" "$intent_vcs_settings" | jq -s '.[0] * .[1]')
    fi
  fi

  # Resolve 'auto' default_branch
  local default_branch
  default_branch=$(echo "$config" | jq -r '.default_branch')
  if [ "$default_branch" = "auto" ]; then
    local resolved_branch
    resolved_branch=$(resolve_default_branch "auto" "$repo_root")
    config=$(echo "$config" | jq --arg branch "$resolved_branch" '.default_branch = $branch')
  fi

  echo "$config"
}

# Export config as environment variables
# Usage: export_ai_dlc_config [intent_dir] [repo_root]
# Sets: AI_DLC_CHANGE_STRATEGY, AI_DLC_ELABORATION_REVIEW, AI_DLC_DEFAULT_BRANCH, etc.
export_ai_dlc_config() {
  local intent_dir="${1:-}"
  local repo_root="${2:-}"
  local config
  config=$(get_ai_dlc_config "$intent_dir" "$repo_root")

  export AI_DLC_CHANGE_STRATEGY
  AI_DLC_CHANGE_STRATEGY=$(echo "$config" | jq -r '.change_strategy')

  export AI_DLC_ELABORATION_REVIEW
  AI_DLC_ELABORATION_REVIEW=$(echo "$config" | jq -r '.elaboration_review')

  export AI_DLC_DEFAULT_BRANCH
  AI_DLC_DEFAULT_BRANCH=$(echo "$config" | jq -r '.default_branch')

  export AI_DLC_AUTO_MERGE
  AI_DLC_AUTO_MERGE=$(echo "$config" | jq -r '.auto_merge // "false"')

  export AI_DLC_AUTO_SQUASH
  AI_DLC_AUTO_SQUASH=$(echo "$config" | jq -r '.auto_squash // "false"')

  export AI_DLC_VCS
  AI_DLC_VCS=$(detect_vcs "$repo_root")
}

# Get a specific config value
# Usage: get_config_value <key> [intent_dir] [repo_root]
# Example: get_config_value change_strategy "$intent_dir"
get_config_value() {
  local key="$1"
  local intent_dir="${2:-}"
  local repo_root="${3:-}"
  local config
  config=$(get_ai_dlc_config "$intent_dir" "$repo_root")

  echo "$config" | jq -r ".$key // empty"
}
