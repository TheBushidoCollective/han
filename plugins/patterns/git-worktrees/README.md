# Git Worktrees

Agent isolation via git worktrees. When Claude Code spawns subagents (via the Task tool), they all operate in the same working directory by default. This means agents can interfere with each other - one agent's file edits or branch switches can corrupt another agent's work. This plugin solves that by instructing each subagent to create and work in its own isolated git worktree.

## How It Works

This plugin uses a **PreToolUse** hook on the `Task` tool to inject worktree isolation instructions into every subagent's prompt. When a subagent is spawned:

1. The hook runs `worktree-context.sh` which generates markdown instructions
2. These instructions are wrapped in `<subagent-context>` tags via `han hook wrap-subagent-context`
3. The subagent receives instructions to create an isolated worktree before modifying any files

Each subagent creates its own worktree at `.worktrees/<agent-name>` and performs all file operations there. This prevents:

- File edit conflicts between parallel agents
- Branch switch interference
- Uncommitted change corruption

## Installation

```bash
han plugin install git-worktrees
```

## What Gets Injected

Each subagent prompt is prepended with instructions to:

1. Create a worktree: `git worktree add .worktrees/<name> --detach HEAD`
2. Use the worktree path for all file operations
3. Commit changes within the worktree before completing
4. Leave cleanup to the orchestrator or user

## Managing Worktrees

Use the `/worktree-management` skill to list, prune, or merge worktrees:

```
/worktree-management list    # Show active worktrees
/worktree-management prune   # Remove stale worktrees
/worktree-management merge   # Merge a worktree's work back
```

Or manage manually:

```bash
# List all worktrees
git worktree list

# Remove a specific worktree
git worktree remove .worktrees/agent-xxx

# Prune stale entries
git worktree prune
```

## Gitignore

Add `.worktrees/` to your `.gitignore` to avoid tracking worktree directories:

```
.worktrees/
```

## Requirements

- Git 2.5+ (worktree support)
- Running in a git repository
