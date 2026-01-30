#!/bin/bash
# dag.sh - DAG resolution functions for unit dependencies
#
# Units are stored as unit-NN-slug.md files with YAML frontmatter:
# ---
# status: pending  # pending | in_progress | completed | blocked
# depends_on: [unit-01-setup, unit-03-session]
# branch: ai-dlc/intent/04-auth
# ---

# Source directory for this script
DAG_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse unit status from frontmatter
# Usage: parse_unit_status <unit_file>
parse_unit_status() {
  local unit_file="$1"
  if [ ! -f "$unit_file" ]; then
    echo "pending"
    return
  fi
  han parse yaml status -r --default pending < "$unit_file" 2>/dev/null || echo "pending"
}

# Parse unit dependencies from frontmatter
# Returns JSON array like ["unit-01-setup", "unit-03-session"]
# Usage: parse_unit_deps <unit_file>
parse_unit_deps() {
  local unit_file="$1"
  if [ ! -f "$unit_file" ]; then
    echo "[]"
    return
  fi
  han parse yaml depends_on --json < "$unit_file" 2>/dev/null || echo "[]"
}

# Parse unit branch name from frontmatter
# Usage: parse_unit_branch <unit_file>
parse_unit_branch() {
  local unit_file="$1"
  if [ ! -f "$unit_file" ]; then
    echo ""
    return
  fi
  # Use -e to exit with error if not found, then default to empty string on failure
  han parse yaml branch -r -e < "$unit_file" 2>/dev/null || echo ""
}

# Check if all dependencies of a unit are completed
# Returns 0 (true) if all deps completed, 1 (false) otherwise
# Usage: are_deps_completed <intent_dir> <unit_file>
are_deps_completed() {
  local intent_dir="$1"
  local unit_file="$2"

  local deps
  deps=$(parse_unit_deps "$unit_file")

  # Empty deps array means no dependencies
  if [ "$deps" = "[]" ] || [ -z "$deps" ] || [ "$deps" = "null" ]; then
    return 0
  fi

  # Parse JSON array and check each dependency
  # deps looks like: ["unit-01-setup", "unit-03-session"]
  local dep_list
  dep_list=$(echo "$deps" | tr -d '[]"' | tr ',' '\n' | tr -d ' ')

  for dep in $dep_list; do
    [ -z "$dep" ] && continue
    local dep_file="$intent_dir/$dep.md"
    local dep_status
    dep_status=$(parse_unit_status "$dep_file")

    if [ "$dep_status" != "completed" ]; then
      return 1
    fi
  done

  return 0
}

# Find ready units (pending + all deps completed)
# Returns unit names (without .md) one per line
# Usage: find_ready_units <intent_dir>
find_ready_units() {
  local intent_dir="$1"

  if [ ! -d "$intent_dir" ]; then
    return
  fi

  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] || continue

    local unit_status
    unit_status=$(parse_unit_status "$unit_file")

    # Only consider pending units
    [ "$unit_status" != "pending" ] && continue

    # Check if all deps are completed
    if are_deps_completed "$intent_dir" "$unit_file"; then
      basename "$unit_file" .md
    fi
  done
}

# Find in-progress units
# Returns unit names (without .md) one per line
# Usage: find_in_progress_units <intent_dir>
find_in_progress_units() {
  local intent_dir="$1"

  if [ ! -d "$intent_dir" ]; then
    return
  fi

  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] || continue

    local unit_status
    unit_status=$(parse_unit_status "$unit_file")

    if [ "$unit_status" = "in_progress" ]; then
      basename "$unit_file" .md
    fi
  done
}

# Find blocked units (pending but has incomplete deps)
# Returns "unit-name:dep1,dep2" format one per line
# Usage: find_blocked_units <intent_dir>
find_blocked_units() {
  local intent_dir="$1"

  if [ ! -d "$intent_dir" ]; then
    return
  fi

  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] || continue

    local unit_status
    unit_status=$(parse_unit_status "$unit_file")

    # Only consider pending units
    [ "$unit_status" != "pending" ] && continue

    local deps
    deps=$(parse_unit_deps "$unit_file")

    # Skip units with no deps
    [ "$deps" = "[]" ] || [ -z "$deps" ] || [ "$deps" = "null" ] && continue

    # Find incomplete deps
    local incomplete_deps=""
    local dep_list
    dep_list=$(echo "$deps" | tr -d '[]"' | tr ',' '\n' | tr -d ' ')

    for dep in $dep_list; do
      [ -z "$dep" ] && continue
      local dep_file="$intent_dir/$dep.md"
      local dep_status
      dep_status=$(parse_unit_status "$dep_file")

      if [ "$dep_status" != "completed" ]; then
        if [ -n "$incomplete_deps" ]; then
          incomplete_deps="$incomplete_deps,$dep"
        else
          incomplete_deps="$dep"
        fi
      fi
    done

    if [ -n "$incomplete_deps" ]; then
      echo "$(basename "$unit_file" .md):$incomplete_deps"
    fi
  done
}

# Find completed units
# Returns unit names (without .md) one per line
# Usage: find_completed_units <intent_dir>
find_completed_units() {
  local intent_dir="$1"

  if [ ! -d "$intent_dir" ]; then
    return
  fi

  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] || continue

    local unit_status
    unit_status=$(parse_unit_status "$unit_file")

    if [ "$unit_status" = "completed" ]; then
      basename "$unit_file" .md
    fi
  done
}

# Get unit status summary as markdown table
# Usage: get_dag_status_table <intent_dir>
get_dag_status_table() {
  local intent_dir="$1"

  if [ ! -d "$intent_dir" ]; then
    echo "No units found."
    return
  fi

  # Check if any unit files exist
  local has_units=false
  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] && has_units=true && break
  done

  if [ "$has_units" = "false" ]; then
    echo "No units found."
    return
  fi

  echo "| Unit | Status | Blocked By |"
  echo "|------|--------|------------|"

  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] || continue

    local name
    name=$(basename "$unit_file" .md)
    local unit_status
    unit_status=$(parse_unit_status "$unit_file")

    # Find blockers
    local blockers=""
    local deps
    deps=$(parse_unit_deps "$unit_file")

    if [ "$deps" != "[]" ] && [ -n "$deps" ] && [ "$deps" != "null" ]; then
      local dep_list
      dep_list=$(echo "$deps" | tr -d '[]"' | tr ',' '\n' | tr -d ' ')

      for dep in $dep_list; do
        [ -z "$dep" ] && continue
        local dep_file="$intent_dir/$dep.md"
        local dep_status
        dep_status=$(parse_unit_status "$dep_file")

        if [ "$dep_status" != "completed" ]; then
          if [ -n "$blockers" ]; then
            blockers="$blockers, $dep"
          else
            blockers="$dep"
          fi
        fi
      done
    fi

    echo "| $name | $unit_status | $blockers |"
  done
}

# Update unit status in file
# Usage: update_unit_status <unit_file> <new_status>
update_unit_status() {
  local unit_file="$1"
  local new_status="$2"

  if [ ! -f "$unit_file" ]; then
    echo "Error: Unit file not found: $unit_file" >&2
    return 1
  fi

  # Validate status value
  case "$new_status" in
    pending|in_progress|completed|blocked)
      ;;
    *)
      echo "Error: Invalid status '$new_status'. Must be: pending, in_progress, completed, or blocked" >&2
      return 1
      ;;
  esac

  # Update status in frontmatter using han parse yaml-set
  han parse yaml-set status "$new_status" < "$unit_file" > "$unit_file.tmp" && mv "$unit_file.tmp" "$unit_file"
}

# Get DAG summary counts
# Usage: get_dag_summary <intent_dir>
# Returns: pending:N in_progress:N completed:N blocked:N ready:N
get_dag_summary() {
  local intent_dir="$1"

  local pending=0
  local in_progress=0
  local completed=0
  local blocked=0
  local ready=0

  if [ ! -d "$intent_dir" ]; then
    echo "pending:0 in_progress:0 completed:0 blocked:0 ready:0"
    return
  fi

  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] || continue

    local unit_status
    unit_status=$(parse_unit_status "$unit_file")

    case "$unit_status" in
      pending)
        pending=$((pending + 1))
        if are_deps_completed "$intent_dir" "$unit_file"; then
          ready=$((ready + 1))
        else
          blocked=$((blocked + 1))
        fi
        ;;
      in_progress)
        in_progress=$((in_progress + 1))
        ;;
      completed)
        completed=$((completed + 1))
        ;;
      blocked)
        blocked=$((blocked + 1))
        ;;
    esac
  done

  echo "pending:$pending in_progress:$in_progress completed:$completed blocked:$blocked ready:$ready"
}

# Check if DAG is complete (all units completed)
# Returns 0 if complete, 1 if not
# Usage: is_dag_complete <intent_dir>
is_dag_complete() {
  local intent_dir="$1"

  if [ ! -d "$intent_dir" ]; then
    return 1
  fi

  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] || continue

    local unit_status
    unit_status=$(parse_unit_status "$unit_file")

    if [ "$unit_status" != "completed" ]; then
      return 1
    fi
  done

  return 0
}

# Validate DAG structure (check for cycles and missing deps)
# Usage: validate_dag <intent_dir>
# Returns error messages if invalid, empty if valid
validate_dag() {
  local intent_dir="$1"
  local errors=""

  if [ ! -d "$intent_dir" ]; then
    echo "Error: Intent directory not found: $intent_dir"
    return 1
  fi

  # Collect all unit names
  local all_units=""
  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] || continue
    local name
    name=$(basename "$unit_file" .md)
    all_units="$all_units $name"
  done

  # Check each unit's dependencies
  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] || continue

    local name
    name=$(basename "$unit_file" .md)
    local deps
    deps=$(parse_unit_deps "$unit_file")

    if [ "$deps" = "[]" ] || [ -z "$deps" ] || [ "$deps" = "null" ]; then
      continue
    fi

    local dep_list
    dep_list=$(echo "$deps" | tr -d '[]"' | tr ',' '\n' | tr -d ' ')

    for dep in $dep_list; do
      [ -z "$dep" ] && continue

      # Check if dependency exists
      if ! echo "$all_units" | grep -q "\b$dep\b"; then
        errors="${errors}Error: $name depends on non-existent unit: $dep\n"
      fi

      # Check for self-dependency
      if [ "$dep" = "$name" ]; then
        errors="${errors}Error: $name has self-dependency\n"
      fi
    done
  done

  if [ -n "$errors" ]; then
    printf "%b" "$errors"
    return 1
  fi

  return 0
}
