---
name: shell-error-handling
description: Use when implementing error handling, cleanup routines, or debugging in shell scripts. Covers traps, exit codes, and robust error patterns.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Shell Error Handling

Patterns for robust error handling, cleanup, and debugging in shell scripts.

## Exit Codes

### Standard Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Misuse of shell command |
| 126 | Command not executable |
| 127 | Command not found |
| 128+N | Fatal signal N |
| 130 | Ctrl+C (SIGINT) |

### Checking Exit Status

```bash
# Check last command's exit status
if ! command; then
    echo "Command failed with status $?" >&2
    exit 1
fi

# Alternative pattern
command || {
    echo "Command failed" >&2
    exit 1
}

# Capture exit status
command
status=$?
if (( status != 0 )); then
    echo "Failed with status $status" >&2
fi
```

## Trap for Cleanup

### Basic Cleanup Pattern

```bash
#!/usr/bin/env bash
set -euo pipefail

cleanup() {
    local exit_code=$?
    # Remove temporary files
    rm -f "$TEMP_FILE" 2>/dev/null || true
    exit "$exit_code"
}

trap cleanup EXIT

TEMP_FILE=$(mktemp)
# Script continues...
# cleanup runs automatically on exit
```

### Handling Multiple Signals

```bash
#!/usr/bin/env bash
set -euo pipefail

cleanup() {
    echo "Cleaning up..." >&2
    rm -rf "$WORK_DIR" 2>/dev/null || true
}

handle_interrupt() {
    echo "Interrupted by user" >&2
    cleanup
    exit 130
}

trap cleanup EXIT
trap handle_interrupt INT TERM

WORK_DIR=$(mktemp -d)
```

### Trap Best Practices

```bash
# Preserve original exit code in cleanup
cleanup() {
    local exit_code=$?
    # Cleanup operations here
    rm -f "$temp_file" 2>/dev/null || true
    # Restore exit code
    exit "$exit_code"
}

# Use || true for optional cleanup
trap 'rm -f "$temp_file" 2>/dev/null || true' EXIT
```

## Error Reporting

### Standard Error Output

```bash
# Always write errors to stderr
echo "Error: Something went wrong" >&2

# Error function
error() {
    echo "Error: $*" >&2
}

# Die function - error and exit
die() {
    echo "Fatal: $*" >&2
    exit 1
}

# Usage
[[ -f "$config" ]] || die "Config file not found: $config"
```

### Verbose Logging

```bash
#!/usr/bin/env bash
set -euo pipefail

VERBOSE="${VERBOSE:-false}"

log() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2
    fi
}

error() {
    echo "[ERROR] $*" >&2
}

log "Starting script"
log "Processing file: $file"
```

## Defensive Programming

### Check Prerequisites

```bash
# Check required commands exist
require_command() {
    command -v "$1" >/dev/null 2>&1 || {
        echo "Error: Required command '$1' not found" >&2
        exit 1
    }
}

require_command jq
require_command curl
require_command shellcheck
```

### Validate Input

```bash
# Validate arguments
if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <source> <destination>" >&2
    exit 1
fi

source_file="$1"
dest_dir="$2"

# Validate file exists
[[ -f "$source_file" ]] || {
    echo "Error: Source file not found: $source_file" >&2
    exit 1
}

# Validate directory
[[ -d "$dest_dir" ]] || {
    echo "Error: Destination directory not found: $dest_dir" >&2
    exit 1
}
```

### Safe Temporary Files

```bash
# Create secure temp file
TEMP_FILE=$(mktemp) || {
    echo "Error: Failed to create temp file" >&2
    exit 1
}

# Create secure temp directory
TEMP_DIR=$(mktemp -d) || {
    echo "Error: Failed to create temp directory" >&2
    exit 1
}

# Always clean up
trap 'rm -rf "$TEMP_FILE" "$TEMP_DIR" 2>/dev/null || true' EXIT
```

## Debugging

### Debug Mode

```bash
#!/usr/bin/env bash

# Enable debug mode via environment variable
if [[ "${DEBUG:-}" == "1" ]]; then
    set -x
fi

set -euo pipefail

# Or toggle with a flag
while getopts "d" opt; do
    case $opt in
        d) set -x ;;
        *) echo "Usage: $0 [-d]" >&2; exit 1 ;;
    esac
done
```

### Trace Execution

```bash
# Enable tracing for specific section
set -x
problematic_code
set +x

# Trace with custom PS4
export PS4='+ ${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
set -x
```

## Error Recovery Patterns

### Retry Pattern

```bash
retry() {
    local max_attempts="${1:-3}"
    local delay="${2:-1}"
    shift 2
    local cmd=("$@")

    local attempt=1
    while (( attempt <= max_attempts )); do
        if "${cmd[@]}"; then
            return 0
        fi
        echo "Attempt $attempt failed, retrying in ${delay}s..." >&2
        sleep "$delay"
        (( attempt++ ))
    done

    echo "All $max_attempts attempts failed" >&2
    return 1
}

# Usage
retry 3 5 curl -f "http://example.com/api"
```

### Fallback Pattern

```bash
# Try primary, fall back to secondary
get_config() {
    if [[ -f "$HOME/.config/myapp/config" ]]; then
        cat "$HOME/.config/myapp/config"
    elif [[ -f "/etc/myapp/config" ]]; then
        cat "/etc/myapp/config"
    else
        echo "Error: No config file found" >&2
        return 1
    fi
}
```
