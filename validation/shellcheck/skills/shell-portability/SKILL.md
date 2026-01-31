---
name: shell-portability
description: Use when writing shell scripts that need to run across different systems, shells, or environments. Covers POSIX compatibility and platform differences.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Shell Script Portability

Techniques for writing shell scripts that work across different platforms and environments.

## Shebang Selection

### Bash Scripts

```bash
#!/usr/bin/env bash
# Most portable for bash scripts
# Works on Linux, macOS, BSD
```

### POSIX Shell Scripts

```sh
#!/bin/sh
# For maximum portability
# Use only POSIX features
```

## Bash vs POSIX Differences

### Arrays (Bash only)

```bash
# Bash - arrays available
declare -a items=("one" "two" "three")
for item in "${items[@]}"; do
    echo "$item"
done

# POSIX - use positional parameters or space-separated strings
set -- one two three
for item in "$@"; do
    echo "$item"
done
```

### Test Syntax

```bash
# Bash - extended test
if [[ "$var" == "value" ]]; then
    echo "match"
fi

# POSIX - basic test
if [ "$var" = "value" ]; then
    echo "match"
fi
```

### String Operations

```bash
# Bash - regex matching
if [[ "$input" =~ ^[0-9]+$ ]]; then
    echo "numeric"
fi

# POSIX - use case or external tools
case "$input" in
    *[!0-9]*|'') echo "not numeric" ;;
    *) echo "numeric" ;;
esac
```

### Arithmetic

```bash
# Bash - arithmetic expansion
(( count++ ))
if (( count > 10 )); then
    echo "greater"
fi

# POSIX - expr or arithmetic expansion
count=$((count + 1))
if [ "$count" -gt 10 ]; then
    echo "greater"
fi
```

## Platform Differences

### macOS vs Linux

```bash
# Date command differences
# GNU (Linux)
date -d "yesterday" +%Y-%m-%d

# BSD (macOS)
date -v-1d +%Y-%m-%d

# Portable approach
if date --version >/dev/null 2>&1; then
    # GNU date
    yesterday=$(date -d "yesterday" +%Y-%m-%d)
else
    # BSD date
    yesterday=$(date -v-1d +%Y-%m-%d)
fi
```

### sed Differences

```bash
# GNU sed - in-place edit
sed -i 's/old/new/g' file.txt

# BSD sed - requires backup extension
sed -i '' 's/old/new/g' file.txt

# Portable approach
sed 's/old/new/g' file.txt > file.txt.tmp && mv file.txt.tmp file.txt

# Or use a function
sed_inplace() {
    if sed --version >/dev/null 2>&1; then
        sed -i "$@"
    else
        sed -i '' "$@"
    fi
}
```

### readlink Differences

```bash
# GNU readlink
readlink -f /path/to/link

# BSD/macOS - no -f option by default
# Use greadlink from coreutils or:
resolve_path() {
    local path="$1"
    if command -v greadlink >/dev/null 2>&1; then
        greadlink -f "$path"
    elif command -v realpath >/dev/null 2>&1; then
        realpath "$path"
    else
        # Fallback
        cd "$(dirname "$path")" && pwd -P
    fi
}
```

## Detecting Environment

### Operating System

```bash
detect_os() {
    case "$(uname -s)" in
        Linux*)  echo "linux" ;;
        Darwin*) echo "macos" ;;
        MINGW*|CYGWIN*|MSYS*) echo "windows" ;;
        FreeBSD*) echo "freebsd" ;;
        *) echo "unknown" ;;
    esac
}

OS=$(detect_os)
case "$OS" in
    linux)  INSTALL_CMD="apt-get install" ;;
    macos)  INSTALL_CMD="brew install" ;;
esac
```

### Architecture

```bash
detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64) echo "amd64" ;;
        aarch64|arm64) echo "arm64" ;;
        armv7l) echo "arm" ;;
        *) echo "unknown" ;;
    esac
}
```

### Shell Detection

```bash
detect_shell() {
    if [ -n "$BASH_VERSION" ]; then
        echo "bash"
    elif [ -n "$ZSH_VERSION" ]; then
        echo "zsh"
    else
        echo "sh"
    fi
}
```

## Portable Patterns

### Reading Files

```bash
# Portable line reading
while IFS= read -r line || [ -n "$line" ]; do
    echo "$line"
done < "$file"
# The || [ -n "$line" ] handles files without trailing newline
```

### Temporary Files

```bash
# POSIX-compatible temp file
make_temp() {
    if command -v mktemp >/dev/null 2>&1; then
        mktemp
    else
        # Fallback
        local tmp="/tmp/tmp.$$.$RANDOM"
        touch "$tmp" && echo "$tmp"
    fi
}
```

### Command Existence Check

```bash
# POSIX-compatible command check
has_command() {
    command -v "$1" >/dev/null 2>&1
}

# Usage
if has_command curl; then
    curl "$url"
elif has_command wget; then
    wget -O- "$url"
else
    echo "No HTTP client available" >&2
    exit 1
fi
```

### String Contains

```bash
# POSIX-compatible string contains
contains() {
    case "$1" in
        *"$2"*) return 0 ;;
        *) return 1 ;;
    esac
}

# Usage
if contains "$PATH" "/usr/local/bin"; then
    echo "Found in PATH"
fi
```

## ShellCheck Compatibility

### Disabling Warnings for Portability

```bash
# When intentionally using non-portable features
# shellcheck disable=SC2039  # Bash-specific feature
if [[ "$var" =~ regex ]]; then
    :
fi

# Document why
# shellcheck disable=SC2016  # Intentionally not expanding
echo 'Use $HOME for home directory'
```

### Testing Multiple Shells

```bash
#!/usr/bin/env bash
# shellcheck shell=bash

# Or for POSIX:
#!/bin/sh
# shellcheck shell=sh
```

## Best Practices

1. Choose the right shebang for your needs
2. Document shell requirements in README
3. Use `#!/usr/bin/env bash` for bash scripts
4. Test on multiple platforms when possible
5. Prefer POSIX features when portability matters
6. Abstract platform differences into functions
7. Use ShellCheck with appropriate shell directive
8. Provide fallbacks for platform-specific commands
