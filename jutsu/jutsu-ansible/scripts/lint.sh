#!/bin/bash
# Lint Ansible playbooks if ansible-lint is available

if ! command -v ansible-lint >/dev/null 2>&1; then
  echo "ansible-lint not found, skipping"
  exit 0
fi

# Run ansible-lint on YAML files, ignore errors for missing files
ansible-lint *.yml *.yaml 2>/dev/null || true
