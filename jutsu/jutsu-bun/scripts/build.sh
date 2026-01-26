#!/bin/bash
# Run all build scripts from package.json (build, build:*, etc.)

if [ ! -f package.json ]; then
  echo "No package.json found, skipping"
  exit 0
fi

# Extract all script names matching "build" or "build:*"
# Uses jq if available, falls back to grep/sed
if command -v jq &> /dev/null; then
  build_scripts=$(jq -r '.scripts // {} | keys[] | select(. == "build" or startswith("build:"))' package.json 2>/dev/null)
else
  # Fallback: grep for "build" or "build:" script keys
  build_scripts=$(grep -oE '"build(:[^"]*)?"\s*:' package.json 2>/dev/null | sed 's/"//g' | sed 's/\s*://g')
fi

if [ -z "$build_scripts" ]; then
  echo "No build script found, skipping"
  exit 0
fi

# Run each build script
failed=0
for script in $build_scripts; do
  echo "Running: bun run $script"
  if ! bun run "$script"; then
    echo "Failed: bun run $script"
    failed=1
  fi
done

exit $failed
