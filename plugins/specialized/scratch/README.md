# Scratch

Scratch workspace enforcement - ensures temporary files are placed in `.claude/.scratch` and gitignored.

## Purpose

This plugin provides guidance for working with temporary, draft, or experimental files that should not be committed to version control. It enforces placement in a standardized, gitignored location.

## What This Plugin Provides

### Hooks

- **UserPromptSubmit**: Reminds you to use `.claude/.scratch/` for temporary files

### Skills

- **scratch-workspace**: Complete guide for scratch file organization, setup, and cleanup

## Installation

```bash
han plugin install scratch
```

Or manually add to your Claude Code settings:

```json
{
  "enabledPlugins": {
    "scratch@han": true
  }
}
```

## Usage

Once installed, the plugin will remind you when working with temporary files to:

1. Place them in `.claude/.scratch/`
2. Ensure the directory is gitignored
3. Organize by purpose (drafts, experiments, notes)

## Scratch Directory Structure

```
.claude/
├── .scratch/           # Gitignored scratch space
│   ├── drafts/         # Work in progress
│   ├── experiments/    # Experimental code
│   ├── notes/          # Temporary notes
│   └── temp/           # Truly temporary files
└── settings.json       # Claude Code settings (NOT in scratch)
```

## Quick Setup

```bash
# Create scratch directory
mkdir -p .claude/.scratch

# Add to gitignore (if not already present)
echo '.claude/.scratch' >> .gitignore
```

## When to Use Scratch Space

- Draft implementations being explored
- Temporary test files
- Experimental code
- Planning documents
- Any file that should not be version controlled
