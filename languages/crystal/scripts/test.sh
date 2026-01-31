#!/bin/bash
set -e

# Install dependencies and run Crystal specs
shards install
crystal spec
