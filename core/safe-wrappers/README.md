# Safe Command Wrappers

Shell wrappers that provide OS-level protection against dangerous file operations outside the project directory.

## What They Do

These wrappers intercept common file manipulation commands and block operations that:

- Target protected system directories (`/etc`, `/usr`, `/var`, etc.)
- Operate outside the project directory (when `CLAUDE_PROJECT_DIR` is set)

## Available Wrappers

- `rm` - Blocks removing files outside project or in protected paths
- `mv` - Blocks moving files to/from outside project or protected paths
- `cp` - Blocks copying files to outside project or protected paths
- `chmod` - Blocks changing permissions outside project or protected paths
- `chown` - Blocks changing ownership outside project or protected paths

## Installation (Optional)

Add this directory to your PATH in your shell profile:

```bash
# Add to ~/.bashrc, ~/.zshrc, or equivalent
export PATH="$HOME/.claude/plugins/marketplaces/han/core/safe-wrappers:$PATH"
```

Or for Claude Code sessions only, add to your Claude settings:

```json
{
  "env": {
    "PATH": "$HOME/.claude/plugins/marketplaces/han/core/safe-wrappers:$PATH"
  }
}
```

## How It Works

1. When you run `rm /etc/passwd`, the wrapper script runs first
2. The wrapper checks if the path is protected or outside the project
3. If blocked: prints error and exits
4. If allowed: passes through to the real `rm` command

## Multi-Tiered Defense

This is **Tier 2** of the Han safety system:

1. **Tier 1: PreToolUse Hook** - Catches dangerous operations at the Claude Code level
2. **Tier 2: Shell Wrappers** - Catches operations at the OS level (optional, requires PATH setup)
3. **Tier 3: Sandbox Mode** - Claude Code's built-in protection

The PreToolUse hook (`safe-operations.py`) runs automatically for all Han users.
Shell wrappers require manual PATH configuration but provide stronger enforcement.

## Environment Variables

- `CLAUDE_PROJECT_DIR` - The project root directory. Operations outside this are blocked.

If `CLAUDE_PROJECT_DIR` is not set, only protected system directories are blocked.
