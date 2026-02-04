# Scratch Workspace Requirements

When working with temporary files, drafts, or exploratory code that should not be committed:

## Location

All scratch files MUST be placed in:

```
.claude/.scratch/
```

## Gitignore Requirement

Before creating any scratch files, ensure `.claude/.scratch` is gitignored:

1. Check if `.gitignore` exists and contains `.claude/.scratch`
2. If not, add `.claude/.scratch` to `.gitignore`

## When to Use Scratch Space

Use `.claude/.scratch/` for:

- Draft implementations being explored
- Temporary test files
- Experimental code
- Notes and planning documents
- Any file that should not be version controlled

## Directory Structure

```
.claude/
├── .scratch/           # Gitignored scratch space
│   ├── drafts/         # Work in progress
│   ├── experiments/    # Experimental code
│   └── notes/          # Temporary notes
└── settings.json       # Claude Code settings (NOT in scratch)
```

## Important

- NEVER put scratch files in the main project directories
- ALWAYS verify gitignore before creating scratch files
- Clean up scratch files when no longer needed
