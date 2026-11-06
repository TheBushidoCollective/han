#!/bin/sh
set -eu

for config in playwright.bdd.config.ts playwright.bdd.config.js playwright.config.ts playwright.config.js; do
  if [ -f "$config" ]; then
    exec npx bddgen --config "$config"
  fi
done
printf '%s\n' 'No Playwright BDD configuration found' >&2
exit 1
