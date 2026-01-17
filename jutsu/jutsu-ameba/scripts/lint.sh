#!/bin/bash
set -e

# Install dependencies and run Ameba linter
shards install
ameba
