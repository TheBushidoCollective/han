# Mise

Validation and quality enforcement for Mise projects.

## What This Plugin Provides

### Validation Hooks

- **Task Validation**: Runs `mise tasks validate` to ensure task configuration is correct
- **Configuration Checking**: Validates mise.toml syntax and structure
- **Automatic Execution**: Validates when you finish conversations in Claude Code

### Skills

This plugin provides the following skills:

- **task-configuration**: Defining and managing tasks for builds, tests, and development workflows
- **tool-management**: Managing development tool versions across projects
- **environment-management**: Managing environment variables and project settings

## Installation

```bash
han plugin install mise
```

## Usage

Once installed, this plugin automatically validates your Mise configuration:

- When you finish a conversation with Claude Code
- Before commits (when combined with git hooks)
- Validates task definitions, dependencies, and configuration

## What Gets Validated

### Task Configuration

- Task definition syntax in mise.toml
- Task dependencies and circular dependency detection
- Required task fields (description, run command)
- File task metadata and structure

### Configuration Files

- mise.toml syntax and structure
- Tool version specifications
- Environment variable definitions
- Settings configuration

## Requirements

- Mise 2024.1.0+
- Projects using mise.toml for configuration

## Example Project Structure

```
my-project/
├── mise.toml              # Main configuration
├── .mise.toml             # Alternative location
├── mise/
│   └── tasks/             # File-based tasks
│       ├── build
│       ├── test
│       └── deploy
├── mise.local.toml        # Local overrides (gitignored)
└── src/
```

## Common Validation Errors

### Missing Task Description

```toml
# ❌ Invalid
[tasks.build]
run = "cargo build"

# ✅ Valid
[tasks.build]
description = "Build the project"
run = "cargo build"
```

### Circular Dependencies

```toml
# ❌ Invalid
[tasks.a]
description = "Task A"
depends = ["b"]
run = "echo a"

[tasks.b]
description = "Task B"
depends = ["a"]  # Creates circular dependency
run = "echo b"
```

### Invalid Dependency Reference

```toml
# ❌ Invalid
[tasks.deploy]
description = "Deploy"
depends = ["nonexistent-task"]
run = "./deploy.sh"
```
