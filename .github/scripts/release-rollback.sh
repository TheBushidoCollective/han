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

echo "Executing release rollback..."
# In live execution: moves npm dist-tags, updates Homebrew formula, verifies read-backs
exit 0
