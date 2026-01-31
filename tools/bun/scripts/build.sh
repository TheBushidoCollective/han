#!/bin/bash
# Run all build scripts from package.json (build, build:*, etc.)

if [ ! -f package.json ]; then
  echo "No package.json found, skipping"
  exit 0
fi

# Extract all script names matching "build" or "build:*" using han parse
build_scripts=$(han parse json scripts --keys < package.json 2>/dev/null | grep -E '^build(:|$)')

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
