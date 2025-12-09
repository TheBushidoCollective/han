---
name: shfmt-formatting
description: Use when formatting shell scripts with shfmt. Covers consistent formatting patterns, shell dialect support, common issues, and editor integration.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# shfmt Formatting

Expert knowledge of shfmt's formatting capabilities, patterns, and integration with development workflows for consistent shell script formatting.

## Overview

shfmt formats shell scripts for readability and consistency. It parses scripts into an AST and prints them in a canonical format, eliminating style debates and ensuring uniformity across codebases.

## Supported Shell Dialects

shfmt supports multiple shell dialects with different syntax rules:

### POSIX Shell

Most portable, works with `/bin/sh` on any Unix system:

```bash
#!/bin/sh
# POSIX-compliant syntax only

# No arrays
# No [[ ]] tests
# No $() must work in all contexts

if [ "$var" = "value" ]; then
    echo "match"
fi
```

### Bash

Most common for scripts, supports extended features:

```bash
#!/usr/bin/env bash
# Bash-specific features allowed

declare -a array=("one" "two" "three")

if [[ "$var" == "value" ]]; then
    echo "match"
fi

result=$((1 + 2))
```

### mksh (MirBSD Korn Shell)

Korn shell variant with its own extensions:

```bash
#!/bin/mksh
# mksh-specific syntax

typeset -A assoc
assoc[key]=value
```

### Bats (Bash Automated Testing System)

For Bats test files:

```bash
#!/usr/bin/env bats

@test "example test" {
    run my_command
    [ "$status" -eq 0 ]
}
```

## Formatting Patterns

### Indentation

shfmt normalizes indentation throughout scripts:

**Before:**

```bash
if [ "$x" = "y" ]; then
  echo "two spaces"
    echo "four spaces"
 echo "tab"
fi
```

**After (with `-i 2`):**

```bash
if [ "$x" = "y" ]; then
  echo "two spaces"
  echo "four spaces"
  echo "tab"
fi
```

### Spacing

shfmt normalizes spacing around operators and keywords:

**Before:**

```bash
if[$x="y"];then
echo "no spaces"
fi
x=1;y=2;z=3
```

**After:**

```bash
if [ $x = "y" ]; then
    echo "no spaces"
fi
x=1
y=2
z=3
```

### Semicolons and Newlines

Multiple statements are split to separate lines:

**Before:**

```bash
if [ "$x" ]; then echo "yes"; else echo "no"; fi
```

**After:**

```bash
if [ "$x" ]; then
    echo "yes"
else
    echo "no"
fi
```

### Here Documents

Here-docs are preserved but indentation is normalized:

**Before:**

```bash
cat <<EOF
    line 1
    line 2
EOF
```

**After (preserved):**

```bash
cat <<EOF
    line 1
    line 2
EOF
```

Indented here-docs with `<<-` allow tab stripping:

```bash
if true; then
    cat <<-EOF
 indented content
 more content
 EOF
fi
```

### Function Definitions

Functions are formatted consistently:

**Before:**

```bash
function my_func
{
echo "old style"
}
my_func2 () { echo "one liner"; }
```

**After:**

```bash
function my_func {
    echo "old style"
}
my_func2() {
    echo "one liner"
}
```

With `-fn` (function next line):

```bash
function my_func
{
    echo "brace on new line"
}
```

### Case Statements

Case statements are formatted consistently:

**Before:**

```bash
case "$1" in
start) do_start;;
stop)
do_stop
;;
*) echo "unknown";;
esac
```

**After:**

```bash
case "$1" in
start)
    do_start
    ;;
stop)
    do_stop
    ;;
*)
    echo "unknown"
    ;;
esac
```

With `-ci` (case indent):

```bash
case "$1" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
esac
```

### Binary Operators

Line continuation with binary operators:

**Default:**

```bash
if [ "$a" = "foo" ] &&
    [ "$b" = "bar" ]; then
    echo "match"
fi
```

**With `-bn` (binary next line):**

```bash
if [ "$a" = "foo" ] \
    && [ "$b" = "bar" ]; then
    echo "match"
fi
```

### Redirections

Redirection formatting:

**Default:**

```bash
echo "hello" >file.txt
cat <input.txt 2>&1
```

**With `-sr` (space redirects):**

```bash
echo "hello" > file.txt
cat < input.txt 2>&1
```

## Common Formatting Issues

### Issue: Mixed Tabs and Spaces

**Problem:** Script has inconsistent indentation

**Solution:**

```bash
# Convert all to spaces (2-space indent)
shfmt -i 2 -w script.sh

# Or convert all to tabs
shfmt -i 0 -w script.sh
```

### Issue: Trailing Semicolons

**Problem:** Unnecessary semicolons at end of lines

**Before:**

```bash
echo "hello";
x=1;
```

**After (shfmt removes them):**

```bash
echo "hello"
x=1
```

### Issue: Inconsistent Quotes

shfmt preserves quote style but normalizes unnecessary quotes:

**Before:**

```bash
echo 'single' "double" $'ansi'
x="simple"
```

**After (preserved):**

```bash
echo 'single' "double" $'ansi'
x="simple"
```

### Issue: Long Lines

shfmt does not wrap long lines automatically. Use manual line continuation:

```bash
# Long command with continuation
very_long_command \
    --option1 value1 \
    --option2 value2 \
    --option3 value3
```

### Issue: Array Formatting

Arrays are formatted on single or multiple lines as written:

```bash
# Single line (preserved)
array=(one two three)

# Multi-line (preserved)
array=(
    one
    two
    three
)
```

## Editor Integration

### VS Code

Install "shell-format" extension:

```json
// settings.json
{
  "shellformat.path": "/usr/local/bin/shfmt",
  "shellformat.flag": "-i 2 -ci -bn",
  "[shellscript]": {
    "editor.defaultFormatter": "foxundermoon.shell-format",
    "editor.formatOnSave": true
  }
}
```

### Vim/Neovim

Using ALE:

```vim
" .vimrc
let g:ale_fixers = {
\   'sh': ['shfmt'],
\}
let g:ale_sh_shfmt_options = '-i 2 -ci -bn'
let g:ale_fix_on_save = 1
```

Using native formatting:

```vim
" .vimrc
autocmd FileType sh setlocal formatprg=shfmt\ -i\ 2\ -ci
```

### Emacs

Using reformatter:

```elisp
;; init.el
(use-package reformatter
  :config
  (reformatter-define shfmt
    :program "shfmt"
    :args '("-i" "2" "-ci")))

(add-hook 'sh-mode-hook 'shfmt-on-save-mode)
```

### JetBrains IDEs

Install "Shell Script" plugin, configure in:
Settings -> Tools -> Shell Scripts -> Formatter

```
Path to shfmt: /usr/local/bin/shfmt
Options: -i 2 -ci -bn
```

## Diff and Check Modes

### Check Formatting (CI Mode)

```bash
# Show diff of what would change (exit 1 if changes needed)
shfmt -d script.sh
shfmt -d .

# List files that need formatting
shfmt -l .

# Exit codes:
# 0 = no changes needed
# 1 = changes needed or error
```

### Format in Place

```bash
# Overwrite files with formatted version
shfmt -w script.sh
shfmt -w .
```

### Preview Changes

```bash
# Output formatted version to stdout
shfmt script.sh

# Output formatted version to file
shfmt script.sh > formatted.sh
```

## Working with Git

### Format Staged Files

```bash
# Format only staged shell scripts
git diff --cached --name-only --diff-filter=ACM | \
    grep '\.sh$' | \
    xargs -r shfmt -w
```

### Pre-commit Hook

```bash
#!/usr/bin/env bash
# .git/hooks/pre-commit

# Check if shfmt is available
if ! command -v shfmt &>/dev/null; then
    echo "shfmt not found, skipping format check"
    exit 0
fi

# Get staged shell files
files=$(git diff --cached --name-only --diff-filter=ACM | grep '\.sh$')

if [ -n "$files" ]; then
    # Check formatting
    if ! echo "$files" | xargs shfmt -d; then
        echo "Shell scripts need formatting. Run: shfmt -w <files>"
        exit 1
    fi
fi
```

### Format Changed Files

```bash
# Format files changed since main branch
git diff --name-only main...HEAD | \
    grep '\.sh$' | \
    xargs -r shfmt -w
```

## Minification (Advanced)

shfmt can minify scripts by removing whitespace:

```bash
# Minify script
shfmt -mn script.sh > script.min.sh
```

**Before:**

```bash
#!/bin/bash
# Comment
function hello {
    echo "Hello, World!"
}
hello
```

**After (minified):**

```bash
#!/bin/bash
function hello { echo "Hello, World!"; }
hello
```

Note: Minification removes comments and most whitespace. Use only for distribution, not development.

## Best Practices

1. **Format on Save** - Configure editor to format automatically
2. **CI Validation** - Run `shfmt -d` in CI pipelines
3. **Consistent Team Settings** - Commit `.shfmt.toml` to repository
4. **Match Shebang** - Ensure shell dialect matches script shebang
5. **Review After Formatting** - Verify changes make sense
6. **Don't Mix Styles** - Use same settings across all scripts
7. **Pre-commit Hooks** - Prevent unformatted code from being committed

## Troubleshooting

### Parse Errors

If shfmt fails to parse a script:

```bash
# Check syntax first
bash -n script.sh

# Or for POSIX
sh -n script.sh
```

### Wrong Dialect Detection

Force the correct dialect:

```bash
shfmt -ln bash script.sh
shfmt -ln posix script.sh
```

### Preserving Intentional Formatting

For code that should not be reformatted, consider:

1. Moving it to a separate file not processed by shfmt
2. Using `# shfmt:ignore` comments (not supported - use file exclusion)
3. Accepting the formatted version

## When to Use This Skill

- Formatting shell scripts for consistency
- Integrating shfmt into development workflow
- Resolving formatting issues in scripts
- Setting up format-on-save in editors
- Configuring CI/CD format checks
- Understanding shfmt's formatting decisions
