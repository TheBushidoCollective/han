# Jutsu: Git Storytelling

Enforce git storytelling practices by automatically committing work early and often to tell the story of your development process.

## What This Jutsu Provides

### Automatic Commit Hook

This jutsu provides a **Stop hook** that automatically commits your work when you finish a Claude Code session, encouraging you to:

- Commit early and commit often
- Create a detailed history of your development process
- Tell the story of how your solution evolved
- Make debugging and code review easier

The hook intelligently:

- ✅ Detects if a commit was already made during the session (via `CLAUDE_HOOK_STOP_HOOK_ACTIVE`)
- ✅ Skips if not in a git repository
- ✅ Skips if there are no changes to commit
- ✅ Creates a descriptive commit message automatically
- ✅ Handles errors gracefully

### Skills

This jutsu provides the following skill:

- **commit-strategy**: Comprehensive guide on when to commit, commit message patterns, and git storytelling best practices

## Installation

Install with npx (no installation required):

```bash
npx @thebushidocollective/han plugin install jutsu-git-storytelling
```

## Usage

Once installed, this jutsu automatically commits your work:

- **When you finish a conversation** with Claude Code (Stop hook)
- **Intelligently skips** if:
  - A commit was already made (detected via `CLAUDE_HOOK_STOP_HOOK_ACTIVE=true`)
  - Not in a git repository
  - No changes are present

### How It Works

The Stop hook runs this logic:

1. **Check if commit already made**: If `CLAUDE_HOOK_STOP_HOOK_ACTIVE` is `true`, skip
2. **Check if git repo**: If not a git repository, skip gracefully
3. **Check for changes**: If no changes to commit, skip
4. **Commit changes**: Stage all changes and create a commit with descriptive message

### Commit Message Format

Automatic commits use this format:

```
work: commit current progress

Committed early and often to tell the story of development.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

You can always amend the commit message afterward:

```bash
git commit --amend -m "feat: add user authentication system"
```

## Git Storytelling Best Practices

### When to Commit

✅ **DO commit when:**

- You've completed a logical unit of work
- Tests pass for the changes made
- You're about to switch tasks
- You've fixed a bug
- You've refactored code
- You're at a stable checkpoint

❌ **DON'T commit when:**

- Code doesn't compile
- Tests are failing (unless documenting a known issue)
- You have unrelated changes mixed together
- You have debugging code still in place

### Cleaning Up Before Pushing

**Commit often, but clean up before sharing:**

- ✅ Use `git rebase -i` to clean up local commits before pushing
- ✅ Squash "oops" and "fix typo" commits into their parent commits
- ✅ Reword unclear commit messages
- ✅ Reorder commits to tell a better story
- ❌ Never rebase commits that have already been pushed to shared branches

```bash
# Check what you haven't pushed yet
git log origin/main..HEAD --oneline

# Clean up local commits interactively
git rebase -i origin/main

# Push your clean history
git push origin feature/my-branch
```

### Example Story

Good git storytelling looks like:

```bash
git log --oneline

feat: add user authentication skeleton
feat: implement JWT token generation
test: add authentication tests
fix: handle expired tokens properly
refactor: extract validation logic
docs: add authentication guide
```

Each commit tells part of the story of how the feature was built.

## Configuration

### Customizing Commit Messages

You can override the automatic commit by making your own commit before the Stop hook runs:

```bash
# Your custom commit
git add .
git commit -m "feat: implement user dashboard"

# Stop hook will detect CLAUDE_HOOK_STOP_HOOK_ACTIVE and skip
```

### Disabling for Specific Projects

If you want to disable auto-commits for a specific project, add to `.claude/settings.local.json`:

```json
{
  "enabledPlugins": {
    "jutsu-git-storytelling@han": false
  }
}
```

## Requirements

- Git 2.0+
- Running in a git repository

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
