#!/bin/bash
# announcements.sh - AI-DLC Announcement Generation System (Shell Version)
#
# Generates various announcement formats when an intent is completed:
# - CHANGELOG: Conventional changelog entry (Keep a Changelog format)
# - Release notes: User-facing summary of changes
# - Social posts: Short-form posts for Twitter/LinkedIn
# - Blog draft: Long-form announcement for company blog
#
# Usage:
#   source announcements.sh
#   generate_announcements "$intent_dir"
#   # Or specify formats:
#   generate_announcements "$intent_dir" "changelog release-notes"

# Source configuration system
# shellcheck disable=SC2034  # Variables are used when sourced
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load intent metadata from intent.md
# Usage: load_intent_metadata <intent_dir>
# Sets global variables: INTENT_TITLE, INTENT_PROBLEM, INTENT_SOLUTION, INTENT_CRITERIA, INTENT_ANNOUNCEMENTS
load_intent_metadata() {
  local intent_dir="$1"
  local intent_file="$intent_dir/intent.md"

  if [ ! -f "$intent_file" ]; then
    echo "Error: intent.md not found in $intent_dir" >&2
    return 1
  fi

  # Extract title from first # heading
  INTENT_TITLE=$(grep -m1 "^# " "$intent_file" | sed 's/^# //')

  # Extract frontmatter values
  # shellcheck disable=SC2034  # Variables are used by other functions
  INTENT_WORKFLOW=$(han parse yaml workflow -r --default default < "$intent_file" 2>/dev/null || echo "default")
  # shellcheck disable=SC2034  # Variables are used by other functions
  INTENT_CREATED=$(han parse yaml created -r --default "" < "$intent_file" 2>/dev/null || date -u +"%Y-%m-%d")
  INTENT_COMPLETED=$(han parse yaml completed -r --default "" < "$intent_file" 2>/dev/null || date -u +"%Y-%m-%d")

  # Extract announcements array
  # shellcheck disable=SC2034  # Variables are used by other functions
  INTENT_ANNOUNCEMENTS=$(han parse yaml announcements --json < "$intent_file" 2>/dev/null || echo "[]")

  # Extract sections (using awk for better multiline handling)
  INTENT_PROBLEM=$(awk '/^## Problem$/,/^## /' "$intent_file" | grep -v "^## " | tr '\n' ' ' | sed 's/  */ /g' | xargs)
  INTENT_SOLUTION=$(awk '/^## Solution$/,/^## /' "$intent_file" | grep -v "^## " | tr '\n' ' ' | sed 's/  */ /g' | xargs)

  # Extract criteria as array
  INTENT_CRITERIA=$(awk '/^## Success Criteria$/,/^## /' "$intent_file" | grep "^\- \[" | sed 's/^- \[.\] //')

  return 0
}

# Get configured announcement formats as space-separated list
# Usage: get_announcement_formats <intent_dir>
get_announcement_formats() {
  local intent_dir="$1"
  local intent_file="$intent_dir/intent.md"

  if [ ! -f "$intent_file" ]; then
    echo ""
    return
  fi

  local formats
  formats=$(han parse yaml announcements --json < "$intent_file" 2>/dev/null || echo "[]")

  # Convert JSON array to space-separated list
  echo "$formats" | tr -d '[]"' | tr ',' ' ' | tr -s ' '
}

# Check if announcements are configured
# Usage: has_announcements <intent_dir>
# Returns 0 if configured, 1 if not
has_announcements() {
  local intent_dir="$1"
  local formats
  formats=$(get_announcement_formats "$intent_dir")

  [ -n "$formats" ] && [ "$formats" != "null" ] && [ "$formats" != " " ]
}

# Categorize a criterion for changelog (returns: added, changed, fixed, removed)
# Usage: categorize_criterion "criterion text" "problem text"
categorize_criterion() {
  local criterion="$1"
  local problem="$2"
  local lower
  lower=$(echo "$criterion" | tr '[:upper:]' '[:lower:]')
  local problem_lower
  problem_lower=$(echo "$problem" | tr '[:upper:]' '[:lower:]')

  # Check for bug fix indicators
  local is_bugfix=false
  if echo "$problem_lower" | grep -qE "(bug|fix|error|broken)"; then
    is_bugfix=true
  fi

  if echo "$lower" | grep -qE "(remove|delete)"; then
    echo "removed"
  elif echo "$lower" | grep -qE "(fix|resolve|correct)" || [ "$is_bugfix" = true ]; then
    echo "fixed"
  elif echo "$lower" | grep -qE "(update|improve|enhance|refactor)"; then
    echo "changed"
  else
    echo "added"
  fi
}

# Generate CHANGELOG entry
# Usage: generate_changelog <intent_dir>
generate_changelog() {
  local intent_dir="$1"

  load_intent_metadata "$intent_dir" || return 1

  local date="${INTENT_COMPLETED:-$(date -u +"%Y-%m-%d")}"

  # Categorize criteria
  local added="" changed="" fixed="" removed=""

  while IFS= read -r criterion; do
    [ -z "$criterion" ] && continue
    local category
    category=$(categorize_criterion "$criterion" "$INTENT_PROBLEM")
    case "$category" in
      added) added="${added}- ${criterion}\n" ;;
      changed) changed="${changed}- ${criterion}\n" ;;
      fixed) fixed="${fixed}- ${criterion}\n" ;;
      removed) removed="${removed}- ${criterion}\n" ;;
    esac
  done <<< "$INTENT_CRITERIA"

  # Build changelog
  local content="## [Unreleased] - ${date}\n\n"

  if [ -n "$added" ]; then
    content="${content}### Added\n\n${added}\n"
  fi

  if [ -n "$changed" ]; then
    content="${content}### Changed\n\n${changed}\n"
  fi

  if [ -n "$fixed" ]; then
    content="${content}### Fixed\n\n${fixed}\n"
  fi

  if [ -n "$removed" ]; then
    content="${content}### Removed\n\n${removed}\n"
  fi

  printf "%b" "$content"
}

# Generate release notes
# Usage: generate_release_notes <intent_dir>
generate_release_notes() {
  local intent_dir="$1"

  load_intent_metadata "$intent_dir" || return 1

  local content="# Release Notes: ${INTENT_TITLE}\n\n"
  content="${content}## Overview\n\n${INTENT_SOLUTION}\n\n"
  content="${content}## What's New\n\n"

  while IFS= read -r criterion; do
    [ -z "$criterion" ] && continue
    content="${content}- ${criterion}\n"
  done <<< "$INTENT_CRITERIA"

  content="${content}\n"

  # Add units if they exist
  local has_units=false
  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] || continue
    has_units=true
    break
  done

  if [ "$has_units" = true ]; then
    content="${content}## Components\n\n"
    for unit_file in "$intent_dir"/unit-*.md; do
      [ -f "$unit_file" ] || continue
      local unit_name
      unit_name=$(grep -m1 "^# " "$unit_file" | sed 's/^# //')
      local unit_desc
      unit_desc=$(awk '/^## Description$/,/^## /' "$unit_file" | grep -v "^## " | tr '\n' ' ' | xargs)
      content="${content}### ${unit_name}\n\n${unit_desc}\n\n"
    done
  fi

  content="${content}## Background\n\n${INTENT_PROBLEM}\n"

  printf "%b" "$content"
}

# Generate Twitter post (280 char max)
# Usage: generate_twitter_post
generate_twitter_post() {
  # Use first criterion or solution as benefit
  local benefit
  benefit=$(echo "$INTENT_CRITERIA" | head -1)
  [ -z "$benefit" ] && benefit=$(echo "$INTENT_SOLUTION" | cut -d'.' -f1)

  local post="${INTENT_TITLE}: ${benefit}"

  # Truncate if too long
  if [ ${#post} -gt 277 ]; then
    post="${post:0:274}..."
  fi

  echo "$post"
}

# Generate LinkedIn post
# Usage: generate_linkedin_post
generate_linkedin_post() {
  local content="**${INTENT_TITLE}**\n\n"
  content="${content}${INTENT_SOLUTION}\n\n"
  content="${content}Key improvements:\n"

  local count=0
  while IFS= read -r criterion; do
    [ -z "$criterion" ] && continue
    count=$((count + 1))
    if [ $count -le 3 ]; then
      content="${content}- ${criterion}\n"
    fi
  done <<< "$INTENT_CRITERIA"

  local total
  total=$(echo "$INTENT_CRITERIA" | grep -c "^" || echo "0")
  if [ "$total" -gt 3 ]; then
    local more=$((total - 3))
    content="${content}- ...and ${more} more improvements\n"
  fi

  printf "%b" "$content"
}

# Generate social posts
# Usage: generate_social_posts <intent_dir>
generate_social_posts() {
  local intent_dir="$1"

  load_intent_metadata "$intent_dir" || return 1

  local twitter
  twitter=$(generate_twitter_post)
  local linkedin
  linkedin=$(generate_linkedin_post)

  cat <<EOF
# Social Media Posts

## Twitter (280 char max)

${twitter}

---

## LinkedIn

${linkedin}
EOF
}

# Generate blog draft
# Usage: generate_blog_draft <intent_dir>
generate_blog_draft() {
  local intent_dir="$1"

  load_intent_metadata "$intent_dir" || return 1

  local content="# ${INTENT_TITLE}\n\n"
  content="${content}## The Challenge\n\n${INTENT_PROBLEM}\n\n"
  content="${content}## Our Solution\n\n${INTENT_SOLUTION}\n\n"
  content="${content}## Key Features\n\n"

  while IFS= read -r criterion; do
    [ -z "$criterion" ] && continue
    content="${content}### ${criterion}\n\n"
    content="${content}[Expand on this feature - explain the benefit to users]\n\n"
  done <<< "$INTENT_CRITERIA"

  # Add units if they exist
  local unit_count=0
  for unit_file in "$intent_dir"/unit-*.md; do
    [ -f "$unit_file" ] && unit_count=$((unit_count + 1))
  done

  if [ "$unit_count" -gt 0 ]; then
    content="${content}## Technical Details\n\n"
    content="${content}This release involved ${unit_count} key components:\n\n"
    for unit_file in "$intent_dir"/unit-*.md; do
      [ -f "$unit_file" ] || continue
      local unit_name
      unit_name=$(grep -m1 "^# " "$unit_file" | sed 's/^# //')
      local unit_discipline
      unit_discipline=$(han parse yaml discipline -r --default general < "$unit_file" 2>/dev/null || echo "general")
      local unit_desc
      unit_desc=$(awk '/^## Description$/,/^## /' "$unit_file" | grep -v "^## " | tr '\n' ' ' | xargs)
      content="${content}- **${unit_name}** (${unit_discipline}): ${unit_desc}\n"
    done
    content="${content}\n"
  fi

  content="${content}## What's Next\n\n"
  content="${content}[Describe upcoming features or improvements planned for the roadmap]\n\n"
  content="${content}## Get Started\n\n"
  content="${content}[Instructions for users to access or try the new features]\n"

  printf "%b" "$content"
}

# Generate announcements for specified or configured formats
# Usage: generate_announcements <intent_dir> [formats]
# formats: space-separated list like "changelog release-notes"
generate_announcements() {
  local intent_dir="$1"
  local formats="${2:-}"

  # If no formats specified, load from config
  if [ -z "$formats" ]; then
    formats=$(get_announcement_formats "$intent_dir")
  fi

  if [ -z "$formats" ] || [ "$formats" = "null" ] || [ "$formats" = " " ]; then
    echo "No announcement formats configured." >&2
    return 0
  fi

  # Create announcements directory
  local announcements_dir="$intent_dir/announcements"
  mkdir -p "$announcements_dir"

  local written_files=""

  for format in $formats; do
    local filename=""
    local content=""

    case "$format" in
      changelog)
        filename="CHANGELOG.md"
        content=$(generate_changelog "$intent_dir")
        ;;
      release-notes)
        filename="RELEASE-NOTES.md"
        content=$(generate_release_notes "$intent_dir")
        ;;
      social-posts)
        filename="SOCIAL-POSTS.md"
        content=$(generate_social_posts "$intent_dir")
        ;;
      blog-draft)
        filename="BLOG-DRAFT.md"
        content=$(generate_blog_draft "$intent_dir")
        ;;
      *)
        echo "Warning: Unknown announcement format: $format" >&2
        continue
        ;;
    esac

    if [ -n "$filename" ] && [ -n "$content" ]; then
      local filepath="$announcements_dir/$filename"
      printf "%b" "$content" > "$filepath"
      written_files="${written_files}${filepath}\n"
      echo "Generated: $filepath" >&2
    fi
  done

  # Return list of written files
  printf "%b" "$written_files"
}

# Main function for CLI usage
# Usage: ./announcements.sh <intent_dir> [formats...]
main() {
  local intent_dir="${1:-.}"
  shift
  local formats="$*"

  if [ ! -d "$intent_dir" ]; then
    echo "Error: Directory not found: $intent_dir" >&2
    exit 1
  fi

  generate_announcements "$intent_dir" "$formats"
}

# Run main if executed directly (not sourced)
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
