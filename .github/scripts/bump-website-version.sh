#!/usr/bin/env bash
set -euo pipefail

: "${BUMP_TYPE:?missing bump type}"
: "${SOURCE_SHA:?missing source SHA}"
if [[ ! "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid source SHA" >&2
  exit 1
fi

git config user.name 'github-actions[bot]'
git config user.email 'github-actions[bot]@users.noreply.github.com'
marker="Website-Version-Source: $SOURCE_SHA"

# Regenerate from the latest remote tree after a competing push. Never rebase a
# generated changelog or overwrite the competing commit.
for attempt in 1 2 3 4 5; do
  git fetch origin main
  git reset --hard origin/main
  if git log --format=%B --fixed-strings --grep="$marker" origin/main | grep -Fxq "$marker"; then
    echo "Website version already bumped for $SOURCE_SHA"
    exit 0
  fi

  current=$(node -p "require('./website/package.json').version")
  IFS=. read -r major minor patch <<< "$current"
  case "$BUMP_TYPE" in
    major) next="$((major + 1)).0.0" ;;
    minor) next="$major.$((minor + 1)).0" ;;
    patch) next="$major.$minor.$((patch + 1))" ;;
    *) echo "Invalid bump type: $BUMP_TYPE" >&2; exit 1 ;;
  esac
  node .github/scripts/update-package-version.cjs website/package.json "$next"
  bash .github/scripts/generate-changelog.sh website "$next" "$current"
  git add website/package.json website/CHANGELOG.md
  git commit -m "chore(website): bump version to $next [skip ci]" -m "$marker"
  if git push origin HEAD:main; then
    exit 0
  fi
  echo "Push failed on attempt $attempt; fetching and regenerating" >&2
done

echo 'Unable to publish website version after five attempts' >&2
exit 1
