#!/bin/bash
set -e

# Script to generate CHANGELOG.md based on git commit history
# Usage: ./generate-changelog.sh <path> <new_version> <old_version>
#
# Arguments:
#   path: Path to the directory (e.g., "packages/bushido-han", "jutsu/jutsu-react", "website")
#   new_version: The new version being released (e.g., "1.2.3")
#   old_version: The previous version (e.g., "1.2.2") - optional, will auto-detect from git tags

PATH_DIR="$1"
NEW_VERSION="$2"
OLD_VERSION="$3"

if [ -z "$PATH_DIR" ] || [ -z "$NEW_VERSION" ]; then
  echo "Usage: $0 <path> <new_version> [old_version]"
  echo "Example: $0 packages/bushido-han 1.2.3"
  exit 1
fi

CHANGELOG_FILE="$PATH_DIR/CHANGELOG.md"
TEMP_FILE=$(mktemp)

# Determine the previous version if not provided
if [ -z "$OLD_VERSION" ]; then
  # For CLI (packages/bushido-han), look for v-prefixed tags
  if [[ "$PATH_DIR" == "packages/bushido-han" ]]; then
    OLD_VERSION=$(git tag -l "v*" --sort=-v:refname | grep -E "^v[0-9]+\.[0-9]+\.[0-9]+$" | head -1 | sed 's/^v//')
    TAG_PREFIX="v"
  else
    # For plugins and website, use the version from package.json or plugin.json
    if [ -f "$PATH_DIR/package.json" ]; then
      OLD_VERSION=$(node -p "require('./$PATH_DIR/package.json').version" 2>/dev/null || echo "")
    elif [ -f "$PATH_DIR/.claude-plugin/plugin.json" ]; then
      OLD_VERSION=$(jq -r '.version' "$PATH_DIR/.claude-plugin/plugin.json" 2>/dev/null || echo "")
    fi
  fi
fi

# Determine git range for commits
# For all paths, get the last 50 commits and filter later
# This ensures we capture all changes since the last real version bump
GIT_RANGE="HEAD~50..HEAD"

# Get commits for this path, excluding version bump commits
COMMITS=$(git log $GIT_RANGE --pretty=format:"%h|%s|%an|%ad" --date=short -- "$PATH_DIR" 2>/dev/null | grep -v "\[skip ci\]" | grep -v "chore(release):" | grep -v "chore(plugins): bump" | grep -v "chore(website): bump" || true)

# If we still don't have commits, try without range limit
if [ -z "$COMMITS" ]; then
  COMMITS=$(git log --all --pretty=format:"%h|%s|%an|%ad" --date=short -- "$PATH_DIR" 2>/dev/null | grep -v "\[skip ci\]" | grep -v "chore(release):" | grep -v "chore(plugins): bump" | grep -v "chore(website): bump" | head -20 || true)
fi

if [ -z "$COMMITS" ]; then
  echo "No commits found for $PATH_DIR in range $GIT_RANGE"
  exit 0
fi

# Parse commits into categories
FEATURES=""
FIXES=""
REFACTORS=""
CHORES=""
BREAKING=""
OTHER=""

while IFS='|' read -r hash subject author date; do
  # Skip empty lines
  [ -z "$hash" ] && continue

  # Remove scope from subject for cleaner display
  CLEAN_SUBJECT=$(echo "$subject" | sed -E 's/^[a-z]+(\([^)]+\))?!?: //')

  # Format entry
  ENTRY="- $CLEAN_SUBJECT ([$hash](../../commit/$hash))"

  # Categorize commit (use newline only between entries, not before first)
  if echo "$subject" | grep -qE '^[a-z]+(\([^)]+\))?!:' || echo "$subject" | grep -q 'BREAKING CHANGE'; then
    [ -n "$BREAKING" ] && BREAKING="$BREAKING\n$ENTRY" || BREAKING="$ENTRY"
  elif echo "$subject" | grep -qE '^feat(\([^)]+\))?:'; then
    [ -n "$FEATURES" ] && FEATURES="$FEATURES\n$ENTRY" || FEATURES="$ENTRY"
  elif echo "$subject" | grep -qE '^fix(\([^)]+\))?:'; then
    [ -n "$FIXES" ] && FIXES="$FIXES\n$ENTRY" || FIXES="$ENTRY"
  elif echo "$subject" | grep -qE '^refactor(\([^)]+\))?:'; then
    [ -n "$REFACTORS" ] && REFACTORS="$REFACTORS\n$ENTRY" || REFACTORS="$ENTRY"
  elif echo "$subject" | grep -qE '^chore(\([^)]+\))?:'; then
    [ -n "$CHORES" ] && CHORES="$CHORES\n$ENTRY" || CHORES="$ENTRY"
  else
    [ -n "$OTHER" ] && OTHER="$OTHER\n$ENTRY" || OTHER="$ENTRY"
  fi
done <<< "$COMMITS"

# Generate changelog header
echo "# Changelog" > "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "All notable changes to this project will be documented in this file." >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)," >> "$TEMP_FILE"
echo "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)." >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

# Add new version entry
echo "## [$NEW_VERSION] - $(date +%Y-%m-%d)" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

# Add breaking changes section if any
if [ -n "$BREAKING" ]; then
  echo "### BREAKING CHANGES" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  echo -e "$BREAKING" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
fi

# Add features section if any
if [ -n "$FEATURES" ]; then
  echo "### Added" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  echo -e "$FEATURES" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
fi

# Add fixes section if any
if [ -n "$FIXES" ]; then
  echo "### Fixed" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  echo -e "$FIXES" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
fi

# Add refactors section if any
if [ -n "$REFACTORS" ]; then
  echo "### Changed" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  echo -e "$REFACTORS" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
fi

# Add other changes if any
if [ -n "$OTHER" ]; then
  echo "### Other" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
  echo -e "$OTHER" >> "$TEMP_FILE"
  echo "" >> "$TEMP_FILE"
fi

# If existing changelog exists, append old entries (excluding the header)
if [ -f "$CHANGELOG_FILE" ]; then
  # Skip the first 6 lines (header) and append the rest
  tail -n +7 "$CHANGELOG_FILE" >> "$TEMP_FILE" 2>/dev/null || true
fi

# Move temp file to final location
mv "$TEMP_FILE" "$CHANGELOG_FILE"

echo "Changelog generated at $CHANGELOG_FILE"
