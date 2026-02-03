#!/bin/bash
set -e

# Install dependencies and check Crystal formatting
shards install
crystal tool format --check
