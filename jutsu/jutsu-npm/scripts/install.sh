#!/bin/bash
# Install npm dependencies, prefer ci for reproducibility

if npm ci 2>/dev/null; then
  exit 0
fi

# npm ci failed (likely no lock file), fall back to install
npm install
