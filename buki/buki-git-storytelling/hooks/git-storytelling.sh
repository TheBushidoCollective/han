#!/bin/bash
# Git Storytelling Hook
# Commits work early and often to tell the story of development

# Read stdin (JSON from Claude Code hook)
stdin_data=$(cat)

# Check if stop_hook_active is true (we're in a recursive hook call)
stop_hook_active=$(echo "$stdin_data" | grep -o '"stop_hook_active"[[:space:]]*:[[:space:]]*true' || true)

if [ -n "$stop_hook_active" ]; then
    echo "Skipping commit - already in a stop hook"
    exit 0
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Not a git repository, skipping commit"
    exit 0
fi

# Check if there are any changes to commit
if [ -z "$(git status --porcelain)" ]; then
    echo "No changes to commit"
    exit 0
fi

# Exit with code 2 to block and instruct the AI to commit
cat <<'EOF'
# Git Storytelling: Commits Required

You have uncommitted changes. Following the git storytelling principle, you must commit your work before stopping.

## Instructions

1. Review all the changes you made during this session
2. Group changes into logical commits that tell the story of how the work was done
3. Create multiple commits if the work spans different logical units
4. Each commit should represent a coherent step in the development process

## Commit Strategy

Break your work into logical commits that someone reading the git history can follow:
- Each commit should be a single logical change
- Commits should build on each other to tell the story
- A reviewer should be able to understand the development process by reading the commit history

## Commit Message Format

Use conventional commits format:
- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for code refactoring
- `docs:` for documentation changes
- `test:` for test changes
- `chore:` for maintenance tasks

## Example

If you added a new feature with tests, you might create:
1. `feat: add user authentication endpoint`
2. `test: add tests for authentication endpoint`
3. `docs: update API documentation for auth`

Each commit tells part of the story of how the feature was built.
EOF
exit 2
