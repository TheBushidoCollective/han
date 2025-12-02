---
name: shell-scripting-fundamentals
description: Use when writing or modifying Bash/shell scripts. Covers script structure, variables, quoting, conditionals, and loops with modern best practices.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Shell Scripting Fundamentals

Core patterns and best practices for writing robust, maintainable shell scripts.

## Script Structure

Always start scripts with a proper shebang and safety options:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Script description here
```

### Safety Options Explained

- `set -e`: Exit on any command failure
- `set -u`: Error on undefined variables
- `set -o pipefail`: Pipeline fails if any command fails

## Variables

### Declaration and Assignment

```bash
# No spaces around =
name="value"

# readonly for constants
readonly CONFIG_DIR="/etc/myapp"

# local in functions
my_function() {
    local result="computed"
    echo "$result"
}
```

### Always Quote Variables

```bash
# Good - prevents word splitting and glob expansion
echo "$variable"
cp "$source" "$destination"

# Bad - can break on spaces or special characters
echo $variable
cp $source $destination
```

### Default Values

```bash
# Use default if unset
name="${NAME:-default}"

# Use default if unset or empty
name="${NAME:-}"

# Assign default if unset
: "${NAME:=default}"

# Error if unset
: "${REQUIRED_VAR:?Error: REQUIRED_VAR must be set}"
```

## Conditionals

### Test Syntax

```bash
# Modern syntax - preferred
if [[ -f "$file" ]]; then
    echo "File exists"
fi

# String comparison
if [[ "$string" == "value" ]]; then
    echo "Match"
fi

# Numeric comparison
if (( count > 10 )); then
    echo "Greater than 10"
fi

# Regex matching
if [[ "$input" =~ ^[0-9]+$ ]]; then
    echo "Numeric input"
fi
```

### Common Test Operators

| Operator | Description |
|----------|-------------|
| `-f` | File exists and is regular file |
| `-d` | Directory exists |
| `-e` | Path exists |
| `-r` | Readable |
| `-w` | Writable |
| `-x` | Executable |
| `-z` | String is empty |
| `-n` | String is not empty |

## Loops

### For Loops

```bash
# Iterate over list
for item in one two three; do
    echo "$item"
done

# Iterate over files (use glob, not ls)
for file in *.txt; do
    [[ -e "$file" ]] || continue  # Handle no matches
    process "$file"
done

# C-style for loop
for (( i = 0; i < 10; i++ )); do
    echo "$i"
done
```

### While Loops

```bash
# Read lines from file
while IFS= read -r line; do
    echo "$line"
done < "$filename"

# Read with process substitution
while IFS= read -r line; do
    echo "$line"
done < <(some_command)
```

## Arrays

```bash
# Declare array
declare -a files=()

# Add elements
files+=("file1.txt")
files+=("file2.txt")

# Iterate all elements
for file in "${files[@]}"; do
    echo "$file"
done

# Get array length
echo "${#files[@]}"

# Access by index
echo "${files[0]}"
```

## Command Substitution

```bash
# Modern syntax - preferred
result=$(command)

# Nested substitution
result=$(echo $(date))

# Avoid legacy backticks
result=`command`  # Don't use this
```

## Functions

```bash
# Function definition
process_file() {
    local file="$1"
    local output_dir="${2:-./output}"

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    # Process the file
    cp "$file" "$output_dir/"
}

# Call with arguments
process_file "input.txt" "/tmp/output"
```

## Best Practices Summary

1. Always use `#!/usr/bin/env bash` for portability
2. Enable strict mode: `set -euo pipefail`
3. Quote all variable expansions
4. Use `[[ ]]` instead of `[ ]` for tests
5. Use `$(command)` instead of backticks
6. Declare local variables in functions
7. Use arrays for lists of items
8. Check command existence before use: `command -v cmd >/dev/null`
