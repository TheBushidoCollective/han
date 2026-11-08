#!/usr/bin/env bash
set -euo pipefail

TARGET_VERSION="${1:-}"
DRY_RUN="${2:-true}"

if [[ -z "$TARGET_VERSION" ]]; then
  echo "Usage: release-rollback.sh <target_version> [dry_run: true|false]" >&2
  exit 1
fi

# 1. Enforce rollback floor: refuse target below 3.23.0
TARGET_CLEAN="${TARGET_VERSION#v}"
MAJOR=$(echo "$TARGET_CLEAN" | cut -d. -f1)
MINOR=$(echo "$TARGET_CLEAN" | cut -d. -f2)

if (( MAJOR < 3 || (MAJOR == 3 && MINOR < 23) )); then
  echo "Error: Rollback target version $TARGET_VERSION is below the required security floor of 3.23.0." >&2
  echo "Demotion below 3.23.0 is refused to prevent restoring disclosed keys." >&2
  exit 1
fi

echo "=== Rollback Plan ==="
echo "Target Version: $TARGET_VERSION"
echo "Dry Run: $DRY_RUN"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run simulation complete. No remote state modified."
  exit 0
fi

echo "Executing release rollback to $TARGET_CLEAN..."

# 1. Move GitHub latest tag and verify readback
echo "--> Moving GitHub latest release to v$TARGET_CLEAN..."
gh release edit "v$TARGET_CLEAN" --latest
IS_LATEST=$(gh release view "v$TARGET_CLEAN" --json isLatest --jq .isLatest)
if [[ "$IS_LATEST" != "true" ]]; then
  echo "Error: GitHub release v$TARGET_CLEAN readback failed: isLatest is not true" >&2
  exit 1
fi
echo "GitHub release v$TARGET_CLEAN verified as latest."

# 2. Move npm dist-tags and verify readback
PACKAGES=(
  "@thebushidocollective/han"
  "@thebushidocollective/han-linux-x64"
  "@thebushidocollective/han-linux-arm64"
  "@thebushidocollective/han-darwin-x64"
  "@thebushidocollective/han-darwin-arm64"
  "@thebushidocollective/han-win32-x64"
)

for pkg in "${PACKAGES[@]}"; do
  echo "--> Setting npm dist-tag latest for $pkg@$TARGET_CLEAN..."
  npm dist-tag add "${pkg}@${TARGET_CLEAN}" latest
  CURRENT_TAG=$(npm view "$pkg" dist-tags.latest)
  if [[ "$CURRENT_TAG" != "$TARGET_CLEAN" ]]; then
    echo "Error: npm dist-tag readback failed for $pkg: expected $TARGET_CLEAN, got $CURRENT_TAG" >&2
    exit 1
  fi
  echo "Verified $pkg latest tag is $TARGET_CLEAN."
done

echo "Release rollback to v$TARGET_CLEAN completed and verified."
exit 0
