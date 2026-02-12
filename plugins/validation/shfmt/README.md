# shfmt

Validation and quality enforcement for shell scripts using [shfmt](https://github.com/mvdan/sh), the shell parser, formatter, and interpreter.

## What This Plugin Provides

### Validation Hooks

- **Format Validation**: Runs `shfmt -d` on shell scripts to check formatting consistency
- Validates scripts on session stop and when agents complete work
- Only runs when shell files have changed (with `--cached` flag)
- Non-zero exit if any files need formatting

### Skills

This plugin provides the following skills:

- **shfmt-configuration**: Configuration files, EditorConfig integration, and project setup
- **shfmt-formatting**: Formatting patterns, shell dialect support, and editor integration
- **shell-best-practices**: Portable scripting, error handling, and secure coding patterns

## Installation

```bash
han plugin install shfmt
```

## Usage

Once installed, this plugin automatically validates your shell script formatting:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Before commits (when combined with git hooks)

### Manual Validation

Check formatting manually:

```bash
# Show diff of what would change
shfmt -d .

# List files that need formatting
shfmt -l .

# Format files in place
shfmt -w .
```

### Configuring shfmt

Create a `.shfmt.toml` or `shfmt.toml` file in your project root:

```toml
# Shell dialect (posix, bash, mksh, bats)
shell = "bash"

# Indent with spaces (0 for tabs)
indent = 2

# Binary operators at start of line
binary-next-line = true

# Switch cases indented
switch-case-indent = true
```

Or use EditorConfig in `.editorconfig`:

```ini
[*.sh]
indent_style = space
indent_size = 2
shell_variant = bash
binary_next_line = true
switch_case_indent = true
```

## Requirements

- [shfmt](https://github.com/mvdan/sh) installed and available in PATH
- Shell scripts with `.sh` or `.bash` extensions

### Installing shfmt

**macOS:**

```bash
brew install shfmt
```

**Ubuntu/Debian:**

```bash
snap install shfmt
```

**Go install:**

```bash
go install mvdan.cc/sh/v3/cmd/shfmt@latest
```

**Binary releases:**

Download from [GitHub releases](https://github.com/mvdan/sh/releases).

## Command Reference

| Command | Description |
|---------|-------------|
| `shfmt -d .` | Show diff of changes (validation) |
| `shfmt -l .` | List files needing formatting |
| `shfmt -w .` | Write formatted files in place |
| `shfmt -i 2` | Use 2-space indentation |
| `shfmt -ci` | Indent switch cases |
| `shfmt -bn` | Binary ops on next line |
| `shfmt -ln bash` | Force bash dialect |

## Supported Shell Dialects

shfmt supports multiple shell dialects:

| Dialect | Description | Shebang |
|---------|-------------|---------|
| `posix` | POSIX shell | `#!/bin/sh` |
| `bash` | Bash | `#!/bin/bash` or `#!/usr/bin/env bash` |
| `mksh` | MirBSD Korn Shell | `#!/bin/mksh` |
| `bats` | Bash Automated Testing | `#!/usr/bin/env bats` |

## Overriding Hooks

Create a `han-config.json` in directories where you want to customize behavior:

```json
{
  "hooks": {
    "shfmt": {
      "format": {
        "enabled": false
      }
    }
  }
}
```

Or override the command:

```json
{
  "hooks": {
    "shfmt": {
      "format": {
        "command": "shfmt -d -i 4 ."
      }
    }
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Shell Format Check
on: [push, pull_request]
jobs:
  shfmt:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install shfmt
        run: |
          curl -sS https://webinstall.dev/shfmt | bash
          echo "$HOME/.local/bin" >> $GITHUB_PATH
      - name: Check formatting
        run: shfmt -d .
```

### Pre-commit

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/scop/pre-commit-shfmt
    rev: v3.8.0-1
    hooks:
      - id: shfmt
```

## Differences from ShellCheck

| Tool | Purpose | Focus |
|------|---------|-------|
| **shfmt** | Formatter | Code style, consistency |
| **ShellCheck** | Linter | Bugs, pitfalls, best practices |

Both tools complement each other. Use ShellCheck for catching bugs and shfmt for consistent formatting.
