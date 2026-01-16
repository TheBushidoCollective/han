#!/bin/bash
set -e

# Lint Helm chart and validate template rendering
helm lint .
helm template . --debug > /dev/null
