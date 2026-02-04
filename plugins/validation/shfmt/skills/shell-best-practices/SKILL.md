---
name: shell-best-practices
description: Use when writing shell scripts following modern best practices. Covers portable scripting, Bash patterns, error handling, and secure coding.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Shell Scripting Best Practices

Comprehensive guide to writing robust, maintainable, and secure shell scripts following modern best practices.

## Script Foundation

### Shebang Selection

Choose the appropriate shebang for your needs:

```bash
# Portable bash (recommended)
#!/usr/bin/env bash

# Direct bash path (faster, less portable)
#!/bin/bash

# POSIX-compliant shell (most portable)
#!/bin/sh

# Specific shell version
#!/usr/bin/env bash
# Requires Bash 4.0+
```

### Strict Mode

Always enable strict error handling:

```bash
#!/usr/bin/env bash
set -euo pipefail

# What these do:
# -e: Exit immediately on command failure
# -u: Treat unset variables as errors
# -o pipefail: Pipeline fails if any command fails
```

For debugging, add:

```bash
set -x  # Print commands as they execute
```

### Script Header Template

```bash
#!/usr/bin/env bash
set -euo pipefail

# Script: script-name.sh
# Description: Brief description of what this script does
# Usage: ./script-name.sh [options] <arguments>

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
```

## Variable Handling

### Always Quote Variables

Prevents word splitting and glob expansion:

```bash
# Good
echo "$variable"
cp "$source" "$destination"
if [ -f "$file" ]; then

# Bad - can break on spaces/special chars
echo $variable
cp $source $destination
if [ -f $file ]; then
```

### Use Meaningful Names

```bash
# Good
readonly config_file="/etc/app/config.yml"
local user_input="$1"
declare -a log_files=()

# Bad
readonly f="/etc/app/config.yml"
local x="$1"
declare -a arr=()
```

### Default Values

```bash
# Use default if unset
name="${NAME:-default_value}"

# Use default if unset or empty
name="${NAME:-}"

# Assign default if unset
: "${NAME:=default_value}"

# Error if unset (with message)
: "${REQUIRED_VAR:?Error: REQUIRED_VAR must be set}"
```

### Readonly and Local

```bash
# Constants
readonly MAX_RETRIES=3
readonly CONFIG_DIR="/etc/myapp"

# Function-local variables
my_function() {
    local input="$1"
    local result=""
    # ...
}
```

## Error Handling

### Exit Codes

Use meaningful exit codes:

```bash
# Standard codes
readonly EXIT_SUCCESS=0
readonly EXIT_FAILURE=1
readonly EXIT_INVALID_ARGS=2
readonly EXIT_NOT_FOUND=3

# Exit with code
exit "$EXIT_FAILURE"
```

### Trap for Cleanup

```bash
cleanup() {
    local exit_code=$?
    # Clean up temporary files
    rm -f "${temp_file:-}"
    # Restore state if needed
    exit "$exit_code"
}

trap cleanup EXIT

# Script continues...
temp_file=$(mktemp)
```

### Error Messages

```bash
error() {
    echo "ERROR: $*" >&2
}

warn() {
    echo "WARNING: $*" >&2
}

die() {
    error "$@"
    exit 1
}

# Usage
[[ -f "$config_file" ]] || die "Config file not found: $config_file"
```

### Validate Inputs

```bash
validate_args() {
    if [[ $# -lt 1 ]]; then
        die "Usage: $SCRIPT_NAME <input_file>"
    fi

    local input_file="$1"
    [[ -f "$input_file" ]] || die "File not found: $input_file"
    [[ -r "$input_file" ]] || die "File not readable: $input_file"
}
```

## Functions

### Function Definition

```bash
# Document functions
# Process a log file and extract errors
# Arguments:
#   $1 - Path to log file
#   $2 - Output directory (optional, default: ./output)
# Returns:
#   0 on success, 1 on failure
process_log() {
    local log_file="$1"
    local output_dir="${2:-./output}"

    [[ -f "$log_file" ]] || return 1

    grep -i "error" "$log_file" > "$output_dir/errors.log"
}
```

### Return Values

```bash
# Return status
is_valid() {
    [[ -n "$1" && "$1" =~ ^[0-9]+$ ]]
}

if is_valid "$input"; then
    echo "Valid"
fi

# Capture output
get_config_value() {
    local key="$1"
    grep "^${key}=" "$config_file" | cut -d= -f2
}

value=$(get_config_value "database_host")
```

## Conditionals

### Use [[ ]] for Tests

```bash
# Good - [[ ]] is more powerful and safer
if [[ -f "$file" ]]; then
if [[ "$string" == "value" ]]; then
if [[ "$string" =~ ^[0-9]+$ ]]; then

# Avoid - [ ] has limitations
if [ -f "$file" ]; then
if [ "$string" = "value" ]; then
```

### Numeric Comparisons

```bash
# Use (( )) for arithmetic
if (( count > 10 )); then
if (( a == b )); then
if (( x >= 0 && x <= 100 )); then

# Or -eq/-lt/-gt in [[ ]]
if [[ "$count" -gt 10 ]]; then
```

### String Comparisons

```bash
# Equality
if [[ "$str" == "value" ]]; then

# Pattern matching
if [[ "$str" == *.txt ]]; then

# Regex matching
if [[ "$str" =~ ^[a-z]+$ ]]; then

# Empty/non-empty
if [[ -z "$str" ]]; then  # empty
if [[ -n "$str" ]]; then  # non-empty
```

## Loops

### Iterate Over Files

```bash
# Good - handles spaces in filenames
for file in *.txt; do
    [[ -e "$file" ]] || continue  # Skip if no matches
    process "$file"
done

# With find for recursive
while IFS= read -r -d '' file; do
    process "$file"
done < <(find . -name "*.txt" -print0)

# Bad - breaks on spaces
for file in $(ls *.txt); do  # Don't do this
```

### Read Lines from File

```bash
# Correct - preserves whitespace
while IFS= read -r line; do
    echo "$line"
done < "$filename"

# With process substitution
while IFS= read -r line; do
    echo "$line"
done < <(some_command)
```

### Iterate with Index

```bash
files=("one.txt" "two.txt" "three.txt")

for i in "${!files[@]}"; do
    echo "Index $i: ${files[i]}"
done
```

## Arrays

### Declaration and Usage

```bash
# Indexed array
declare -a files=()
files+=("file1.txt")
files+=("file2.txt")

# Access all elements
for f in "${files[@]}"; do
    echo "$f"
done

# Array length
echo "${#files[@]}"

# Associative array (Bash 4+)
declare -A config
config[host]="localhost"
config[port]="8080"

echo "${config[host]}"
```

### Array Best Practices

```bash
# Quote expansions
"${array[@]}"   # All elements, word-split
"${array[*]}"   # All elements, single string

# Check if empty
if [[ ${#array[@]} -eq 0 ]]; then
    echo "Empty array"
fi

# Check for key (associative)
if [[ -v config[key] ]]; then
    echo "Key exists"
fi
```

## Command Execution

### Check Command Existence

```bash
# Preferred method
if command -v docker &>/dev/null; then
    echo "Docker is installed"
fi

# In conditionals
require_command() {
    command -v "$1" &>/dev/null || die "Required command not found: $1"
}

require_command git
require_command docker
```

### Capture Output and Status

```bash
# Capture output
output=$(some_command)

# Capture output and status
if output=$(some_command 2>&1); then
    echo "Success: $output"
else
    echo "Failed: $output" >&2
fi

# Check status without output
if some_command &>/dev/null; then
    echo "Command succeeded"
fi
```

### Safe Command Substitution

```bash
# Use $() not backticks
result=$(command)      # Good
result=`command`       # Avoid

# Nested substitution
result=$(echo $(date)) # Works with $()
```

## Portability

### POSIX vs Bash

| Feature | POSIX | Bash |
|---------|-------|------|
| Test syntax | `[ ]` | `[[ ]]` |
| Arrays | No | Yes |
| `$()` | Yes | Yes |
| `${var//pat/rep}` | No | Yes |
| `[[ =~ ]]` regex | No | Yes |
| `(( ))` arithmetic | No | Yes |

### Portable Alternatives

```bash
# Instead of [[ ]], use [ ] with quotes
if [ -f "$file" ]; then
if [ "$str" = "value" ]; then

# Instead of (( )), use [ ] with -eq
if [ "$count" -gt 10 ]; then

# Instead of ${var//pat/rep}
echo "$var" | sed 's/pat/rep/g'

# Instead of arrays, use space-separated strings
files="one.txt two.txt three.txt"
for f in $files; do
    echo "$f"
done
```

## Security

### Avoid Eval

```bash
# Bad - code injection risk
eval "$user_input"

# Better - use arrays for command building
cmd=("grep" "-r" "$pattern" "$directory")
"${cmd[@]}"
```

### Sanitize Inputs

```bash
# Validate expected format
if [[ ! "$input" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    die "Invalid input format"
fi

# Escape for use in commands
escaped=$(printf '%q' "$input")
```

### Temporary Files

```bash
# Secure temp file creation
temp_file=$(mktemp) || die "Failed to create temp file"
trap 'rm -f "$temp_file"' EXIT

# Secure temp directory
temp_dir=$(mktemp -d) || die "Failed to create temp dir"
trap 'rm -rf "$temp_dir"' EXIT
```

## Logging

### Basic Logging

```bash
readonly LOG_FILE="/var/log/myapp.log"

log() {
    local level="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@" >&2; }
log_error() { log "ERROR" "$@" >&2; }

# Usage
log_info "Starting process"
log_error "Failed to connect"
```

### Verbose Mode

```bash
VERBOSE="${VERBOSE:-false}"

debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo "DEBUG: $*" >&2
    fi
}

# Enable with: VERBOSE=true ./script.sh
```

## Complete Script Template

```bash
#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Script: example.sh
# Description: Template demonstrating shell best practices
# Usage: ./example.sh [options] <input_file>
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_FAILURE=1
readonly EXIT_INVALID_ARGS=2

# Logging functions
log_info() { echo "[INFO] $*"; }
log_error() { echo "[ERROR] $*" >&2; }

# Error handling
die() {
    log_error "$@"
    exit "$EXIT_FAILURE"
}

cleanup() {
    local exit_code=$?
    rm -f "${temp_file:-}"
    exit "$exit_code"
}
trap cleanup EXIT

# Argument parsing
usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [options] <input_file>

Options:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose output
    -o, --output    Output directory (default: ./output)

Examples:
    $SCRIPT_NAME input.txt
    $SCRIPT_NAME -v -o /tmp/output input.txt
EOF
}

parse_args() {
    local OPTIND opt
    while getopts ":hvo:-:" opt; do
        case "$opt" in
            h) usage; exit "$EXIT_SUCCESS" ;;
            v) VERBOSE=true ;;
            o) OUTPUT_DIR="$OPTARG" ;;
            -) case "$OPTARG" in
                   help) usage; exit "$EXIT_SUCCESS" ;;
                   verbose) VERBOSE=true ;;
                   output=*) OUTPUT_DIR="${OPTARG#*=}" ;;
                   *) die "Unknown option: --$OPTARG" ;;
               esac ;;
            :) die "Option -$OPTARG requires an argument" ;;
            \?) die "Unknown option: -$OPTARG" ;;
        esac
    done
    shift $((OPTIND - 1))

    if [[ $# -lt 1 ]]; then
        usage
        exit "$EXIT_INVALID_ARGS"
    fi

    INPUT_FILE="$1"
}

# Validate inputs
validate() {
    [[ -f "$INPUT_FILE" ]] || die "File not found: $INPUT_FILE"
    [[ -r "$INPUT_FILE" ]] || die "File not readable: $INPUT_FILE"
    mkdir -p "$OUTPUT_DIR" || die "Cannot create output directory"
}

# Main logic
main() {
    # Defaults
    VERBOSE="${VERBOSE:-false}"
    OUTPUT_DIR="${OUTPUT_DIR:-./output}"

    parse_args "$@"
    validate

    log_info "Processing $INPUT_FILE"
    # ... main logic here ...
    log_info "Done"
}

main "$@"
```

## When to Use This Skill

- Writing new shell scripts from scratch
- Reviewing shell scripts for issues
- Refactoring legacy shell code
- Debugging script failures
- Improving script security
- Making scripts more portable
- Setting up proper error handling
