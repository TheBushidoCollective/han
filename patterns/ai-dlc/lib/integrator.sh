#!/bin/bash
# integrator.sh - AI-DLC Integrator Logic (Shell Version)
#
# Handles strategy-aware intent completion:
# - trunk: Validates auto-merged state on main
# - intent: Creates single PR and merges on approval
# - unit/bolt: Verifies all individual PRs were merged (no-op)
#
# Usage:
#   source integrator.sh
#   result=$(integrate "my-intent" ".ai-dlc/my-intent")

# Source dependencies
# Determine script directory reliably for both direct execution and sourcing
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  INTEGRATOR_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  INTEGRATOR_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi
# shellcheck source=config.sh
source "$INTEGRATOR_SCRIPT_DIR/config.sh"
# shellcheck source=strategies.sh
source "$INTEGRATOR_SCRIPT_DIR/strategies.sh"
# shellcheck source=dag.sh
source "$INTEGRATOR_SCRIPT_DIR/dag.sh"

# Check if integrator should run for a given strategy
# Usage: should_run_integrator <strategy>
# Returns: 0 if should run, 1 if skip
# Outputs: reason to stdout
should_run_integrator() {
  local strategy="$1"

  case "$strategy" in
    trunk)
      echo "Trunk strategy needs validation of auto-merged state"
      return 0
      ;;
    intent)
      echo "Intent strategy needs single PR creation"
      return 0
      ;;
    unit|bolt)
      echo "Verifying all unit PRs were merged (lightweight check)"
      return 0
      ;;
    *)
      echo "Unknown strategy: $strategy"
      return 1
      ;;
  esac
}

# Run validation hooks (tests, lint, types)
# Usage: run_validation_hooks [repo_root]
# Returns: 0 if all pass, 1 if any fail
# Sets: VALIDATION_ERRORS array with failure messages
run_validation_hooks() {
  local repo_root="${1:-$(find_repo_root)}"
  [ -z "$repo_root" ] && repo_root="."

  VALIDATION_ERRORS=()
  local failed=0

  # Check for package.json and run npm scripts if available
  if [ -f "$repo_root/package.json" ]; then
    # Run test if available
    if npm run --if-present test --prefix "$repo_root" >/dev/null 2>&1; then
      : # Test passed
    else
      VALIDATION_ERRORS+=("npm test failed")
      failed=1
    fi

    # Run lint if available
    if npm run --if-present lint --prefix "$repo_root" >/dev/null 2>&1; then
      : # Lint passed
    else
      VALIDATION_ERRORS+=("npm run lint failed")
      failed=1
    fi

    # Run typecheck if available
    if npm run --if-present typecheck --prefix "$repo_root" >/dev/null 2>&1; then
      : # Typecheck passed
    else
      VALIDATION_ERRORS+=("npm run typecheck failed")
      failed=1
    fi
  fi

  # Check for Cargo.toml and run cargo checks if available
  if [ -f "$repo_root/Cargo.toml" ]; then
    if cargo test --manifest-path "$repo_root/Cargo.toml" >/dev/null 2>&1; then
      : # Test passed
    else
      VALIDATION_ERRORS+=("cargo test failed")
      failed=1
    fi

    if cargo clippy --manifest-path "$repo_root/Cargo.toml" >/dev/null 2>&1; then
      : # Clippy passed
    else
      VALIDATION_ERRORS+=("cargo clippy failed")
      failed=1
    fi
  fi

  return $failed
}

# Verify that branches were merged to base branch
# Usage: verify_branches_merged <base_branch> <branch1> [branch2...]
# Returns: 0 if all merged, 1 if any not merged
# Sets: UNMERGED_BRANCHES array with unmerged branch names
verify_branches_merged() {
  local base_branch="$1"
  shift
  local branches=("$@")

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  UNMERGED_BRANCHES=()

  for branch in "${branches[@]}"; do
    if ! git -C "$repo_root" merge-base --is-ancestor "$branch" "$base_branch" 2>/dev/null; then
      UNMERGED_BRANCHES+=("$branch")
    fi
  done

  [ ${#UNMERGED_BRANCHES[@]} -eq 0 ]
}

# Clean up worktrees for completed intent
# Usage: cleanup_worktrees <intent_slug> [unit1 unit2...]
# Sets: CLEANED_WORKTREES and CLEANED_BRANCHES arrays
cleanup_worktrees() {
  local intent_slug="$1"
  shift
  local units=("$@")

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  CLEANED_WORKTREES=()
  CLEANED_BRANCHES=()

  # Intent worktree
  local intent_worktree="/tmp/ai-dlc-${intent_slug}"
  if [ -d "$intent_worktree" ]; then
    git -C "$repo_root" worktree remove "$intent_worktree" --force 2>/dev/null && \
      CLEANED_WORKTREES+=("$intent_worktree")
  fi

  # Unit worktrees
  for unit in "${units[@]}"; do
    local unit_slug="${unit#unit-}"
    local unit_worktree="/tmp/ai-dlc-${intent_slug}-${unit_slug}"

    if [ -d "$unit_worktree" ]; then
      git -C "$repo_root" worktree remove "$unit_worktree" --force 2>/dev/null && \
        CLEANED_WORKTREES+=("$unit_worktree")
    fi

    # Delete unit branch
    local unit_branch="ai-dlc/${intent_slug}/${unit_slug}"
    git -C "$repo_root" branch -d "$unit_branch" 2>/dev/null && \
      CLEANED_BRANCHES+=("$unit_branch")
  done
}

# Mark intent as complete in intent.md frontmatter
# Usage: mark_intent_complete <intent_dir>
mark_intent_complete() {
  local intent_dir="$1"
  local intent_file="$intent_dir/intent.md"

  [ ! -f "$intent_file" ] && return 1

  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Update status and add completed_at timestamp
  # Using han parse yaml-set if available, otherwise sed
  if command -v han &>/dev/null; then
    local content
    content=$(cat "$intent_file")
    echo "$content" | han parse yaml-set status completed > "$intent_file.tmp" && \
      mv "$intent_file.tmp" "$intent_file"
    content=$(cat "$intent_file")
    echo "$content" | han parse yaml-set completed_at "$timestamp" > "$intent_file.tmp" && \
      mv "$intent_file.tmp" "$intent_file"
  else
    # Fallback to sed
    sed -i.bak "s/^status:.*/status: completed/" "$intent_file"
    rm -f "$intent_file.bak"
  fi
}

# Build PR description from completed units
# Usage: build_pr_description <intent_dir> <unit1> [unit2...]
# Outputs: PR description markdown to stdout
build_pr_description() {
  local intent_dir="$1"
  shift
  local units=("$@")

  echo "## Summary"
  echo ""

  # Try to read intent description
  local intent_file="$intent_dir/intent.md"
  if [ -f "$intent_file" ]; then
    # Extract first few lines after frontmatter
    awk '/^---$/{if(++c==2){f=1;next}} f{print; if(NR>10)exit}' "$intent_file" | head -5
    echo ""
  fi

  echo "## Units Completed"
  echo ""
  for unit in "${units[@]}"; do
    echo "- [x] $unit"
  done

  echo ""
  echo "---"
  echo ""
  echo "Generated by AI-DLC Integrator"
}

# Execute trunk strategy integration
# Usage: integrate_trunk <intent_slug> <intent_dir>
# Returns: JSON result object
integrate_trunk() {
  local intent_slug="$1"
  local intent_dir="$2"

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  local config
  config=$(get_ai_dlc_config "$intent_dir" "$repo_root")
  local default_branch
  default_branch=$(echo "$config" | jq -r '.default_branch')

  # Get completed units
  local completed_units
  mapfile -t completed_units < <(find_completed_units "$intent_dir")

  # Build list of unit branches
  local unit_branches=()
  for unit in "${completed_units[@]}"; do
    local unit_slug="${unit#unit-}"
    unit_branches+=("ai-dlc/${intent_slug}/${unit_slug}")
  done

  # Verify all branches were merged
  if ! verify_branches_merged "$default_branch" "${unit_branches[@]}"; then
    local errors
    errors=$(printf '"%s",' "${UNMERGED_BRANCHES[@]}" | sed 's/,$//')
    cat <<EOF
{
  "status": "blocked",
  "strategy": "trunk",
  "message": "Some unit branches were not merged to main",
  "errors": [$errors]
}
EOF
    return 1
  fi

  # Run validation
  if ! run_validation_hooks "$repo_root"; then
    local errors
    errors=$(printf '"%s",' "${VALIDATION_ERRORS[@]}" | sed 's/,$//')
    cat <<EOF
{
  "status": "blocked",
  "strategy": "trunk",
  "message": "Validation failed on integrated main branch",
  "errors": [$errors]
}
EOF
    return 1
  fi

  # Clean up
  cleanup_worktrees "$intent_slug" "${completed_units[@]}"

  # Mark complete
  mark_intent_complete "$intent_dir"

  cat <<EOF
{
  "status": "completed",
  "strategy": "trunk",
  "message": "Intent '${intent_slug}' completed. All ${#completed_units[@]} units merged and validated."
}
EOF
}

# Execute intent strategy integration
# Usage: integrate_intent <intent_slug> <intent_dir>
# Returns: JSON result object
integrate_intent() {
  local intent_slug="$1"
  local intent_dir="$2"

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  local config
  config=$(get_ai_dlc_config "$intent_dir" "$repo_root")
  local default_branch
  default_branch=$(echo "$config" | jq -r '.default_branch')

  local intent_branch="ai-dlc/${intent_slug}"

  # Checkout intent branch
  if ! git -C "$repo_root" checkout "$intent_branch" 2>/dev/null; then
    cat <<EOF
{
  "status": "blocked",
  "strategy": "intent",
  "message": "Failed to checkout intent branch: ${intent_branch}",
  "errors": ["Could not checkout branch"]
}
EOF
    return 1
  fi

  # Push the intent branch
  if ! git -C "$repo_root" push -u origin "$intent_branch" 2>/dev/null; then
    cat <<EOF
{
  "status": "blocked",
  "strategy": "intent",
  "message": "Failed to push intent branch",
  "errors": ["Push failed"]
}
EOF
    return 1
  fi

  # Get completed units
  local completed_units
  mapfile -t completed_units < <(find_completed_units "$intent_dir")

  # Build PR description
  local pr_body
  pr_body=$(build_pr_description "$intent_dir" "${completed_units[@]}")

  # Create PR
  local pr_url
  pr_url=$(create_pr "[AI-DLC] ${intent_slug}" "$pr_body" "$default_branch")

  if [ -z "$pr_url" ] || [ "$pr_url" = "null" ]; then
    cat <<EOF
{
  "status": "blocked",
  "strategy": "intent",
  "message": "Failed to create PR for intent",
  "errors": ["PR creation failed - check gh CLI authentication"]
}
EOF
    return 1
  fi

  cat <<EOF
{
  "status": "pr_created",
  "strategy": "intent",
  "message": "PR created for intent '${intent_slug}'. Awaiting approval.",
  "prUrl": "${pr_url}"
}
EOF
}

# Execute unit/bolt strategy integration (verification only)
# Usage: integrate_unit_or_bolt <intent_slug> <intent_dir>
# Returns: JSON result object
integrate_unit_or_bolt() {
  local intent_slug="$1"
  local intent_dir="$2"

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  local config
  config=$(get_ai_dlc_config "$intent_dir" "$repo_root")
  local strategy
  strategy=$(echo "$config" | jq -r '.change_strategy')
  local default_branch
  default_branch=$(echo "$config" | jq -r '.default_branch')

  # Get completed units
  local completed_units
  mapfile -t completed_units < <(find_completed_units "$intent_dir")

  # Build list of unit branches
  local unit_branches=()
  for unit in "${completed_units[@]}"; do
    local unit_slug="${unit#unit-}"
    unit_branches+=("ai-dlc/${intent_slug}/${unit_slug}")
  done

  # Verify all branches were merged
  if ! verify_branches_merged "$default_branch" "${unit_branches[@]}"; then
    local errors
    errors=$(printf '"%s",' "${UNMERGED_BRANCHES[@]}" | sed 's/,$//')
    cat <<EOF
{
  "status": "blocked",
  "strategy": "${strategy}",
  "message": "Some unit PRs may not have been merged",
  "errors": [$errors]
}
EOF
    return 1
  fi

  # Clean up
  cleanup_worktrees "$intent_slug" "${completed_units[@]}"

  # Mark complete
  mark_intent_complete "$intent_dir"

  cat <<EOF
{
  "status": "completed",
  "strategy": "${strategy}",
  "message": "Intent '${intent_slug}' completed. All ${#completed_units[@]} unit PRs were merged."
}
EOF
}

# Main integration function
# Usage: integrate <intent_slug> <intent_dir>
# Returns: JSON result object
integrate() {
  local intent_slug="$1"
  local intent_dir="$2"

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  # Verify DAG is complete
  if ! is_dag_complete "$intent_dir"; then
    cat <<EOF
{
  "status": "blocked",
  "strategy": "unknown",
  "message": "Cannot integrate: not all units are complete",
  "errors": ["DAG is not complete - some units still pending or blocked"]
}
EOF
    return 1
  fi

  # Get configuration
  local config
  config=$(get_ai_dlc_config "$intent_dir" "$repo_root")
  local strategy
  strategy=$(echo "$config" | jq -r '.change_strategy')

  # Execute strategy-specific integration
  case "$strategy" in
    trunk)
      integrate_trunk "$intent_slug" "$intent_dir"
      ;;
    intent)
      integrate_intent "$intent_slug" "$intent_dir"
      ;;
    unit|bolt)
      integrate_unit_or_bolt "$intent_slug" "$intent_dir"
      ;;
    *)
      cat <<EOF
{
  "status": "blocked",
  "strategy": "${strategy}",
  "message": "Unknown change strategy: ${strategy}",
  "errors": ["Invalid strategy: ${strategy}"]
}
EOF
      return 1
      ;;
  esac
}

# Complete integration after PR approval (for intent strategy)
# Usage: complete_after_approval <intent_slug> <intent_dir> [pr_number]
# Returns: JSON result object
complete_after_approval() {
  local intent_slug="$1"
  local intent_dir="$2"
  local pr_number="${3:-}"

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  local config
  config=$(get_ai_dlc_config "$intent_dir" "$repo_root")
  local strategy
  strategy=$(echo "$config" | jq -r '.change_strategy')

  if [ "$strategy" != "intent" ]; then
    cat <<EOF
{
  "status": "skipped",
  "strategy": "${strategy}",
  "message": "complete_after_approval only applies to intent strategy"
}
EOF
    return 0
  fi

  # Merge the PR if number provided
  if [ -n "$pr_number" ]; then
    if ! gh pr merge "$pr_number" --merge 2>/dev/null; then
      cat <<EOF
{
  "status": "blocked",
  "strategy": "intent",
  "message": "Failed to merge PR",
  "errors": ["Merge failed"]
}
EOF
      return 1
    fi
  fi

  # Run final validation
  if ! run_validation_hooks "$repo_root"; then
    local errors
    errors=$(printf '"%s",' "${VALIDATION_ERRORS[@]}" | sed 's/,$//')
    cat <<EOF
{
  "status": "blocked",
  "strategy": "intent",
  "message": "Post-merge validation failed",
  "errors": [$errors]
}
EOF
    return 1
  fi

  # Get completed units for cleanup
  local completed_units
  mapfile -t completed_units < <(find_completed_units "$intent_dir")

  # Clean up
  cleanup_worktrees "$intent_slug" "${completed_units[@]}"

  # Mark complete
  mark_intent_complete "$intent_dir"

  cat <<EOF
{
  "status": "completed",
  "strategy": "intent",
  "message": "Intent '${intent_slug}' completed and merged."
}
EOF
}

# Print integration status for an intent
# Usage: print_integration_status <intent_slug> <intent_dir>
print_integration_status() {
  local intent_slug="$1"
  local intent_dir="$2"

  local repo_root
  repo_root=$(find_repo_root)
  [ -z "$repo_root" ] && repo_root="."

  local config
  config=$(get_ai_dlc_config "$intent_dir" "$repo_root")
  local strategy
  strategy=$(echo "$config" | jq -r '.change_strategy')

  echo "## Integration Status"
  echo ""
  echo "**Intent:** $intent_slug"
  echo "**Strategy:** $strategy"
  echo ""

  # DAG status
  echo "### Unit Status"
  get_dag_status_table "$intent_dir"
  echo ""

  # Summary
  local summary
  summary=$(get_dag_summary "$intent_dir")
  echo "**Summary:** $summary"
  echo ""

  # Strategy-specific info
  echo "### Strategy Behavior"
  should_run_integrator "$strategy"
}
