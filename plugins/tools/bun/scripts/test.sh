#!/bin/bash
# Run bun tests, but skip if directory uses Playwright for testing

set -e

# Check if directory uses Playwright (has playwright.config.*)
if [ -f "playwright.config.ts" ] || [ -f "playwright.config.js" ] || [ -f "playwright.config.mjs" ]; then
  echo "Skipping bun test - directory uses Playwright"
  exit 0
fi

# Check if directory has any bun test files
if ! bun --version &>/dev/null; then
  echo "Bun not installed, skipping"
  exit 0
fi

# Check if there are any test files that bun test would pick up
# bun test looks for *.test.ts, *.test.tsx, *.test.js, *.test.jsx
# and *.spec.ts, *.spec.tsx, *.spec.js, *.spec.jsx in the test/ or __tests__/ dirs
# But we've already excluded Playwright projects above

# Run bun test with only-failures for faster iteration
exec bun test --only-failures
