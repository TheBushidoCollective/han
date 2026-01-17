#!/bin/bash
# Run bun build if a build script exists in package.json

if grep -q '"build"' package.json 2>/dev/null; then
  bun run build
else
  echo "No build script found, skipping"
fi
