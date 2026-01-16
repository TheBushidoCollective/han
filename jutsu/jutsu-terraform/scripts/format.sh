#!/bin/bash
set -e

# Initialize terraform without backend, check formatting, and validate
terraform init -backend=false
terraform fmt -check
terraform validate
