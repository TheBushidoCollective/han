#!/bin/bash
# Install yarn dependencies with frozen lockfile, fall back to regular install

if yarn install --check-files --frozen-lockfile 2>/dev/null; then
  exit 0
fi

# Frozen lockfile failed, fall back to regular install
yarn install
