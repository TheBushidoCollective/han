#!/bin/bash
# Bootstrap Lerna monorepo, try CI mode first then fall back to regular

if npx -y lerna bootstrap --ci 2>/dev/null; then
  exit 0
fi

# CI mode failed, fall back to regular bootstrap
npx -y lerna bootstrap
