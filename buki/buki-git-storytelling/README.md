# Buki: Git Storytelling

Enforce git storytelling practices by automatically committing work early and often to tell the story of your development process.

## What This Buki Provides

### Automatic Commit Hook

This buki provides a **Stop hook** that automatically commits your work when you finish a Claude Code session, encouraging you to:

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

This buki provides the following skill:

- **commit-strategy**: Comprehensive guide on when to commit, commit message patterns, and git storytelling best practices

## Installation

Install via the Han marketplace:

```bash
npx @thebushidocollective/han install
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install buki-git-storytelling@han
```

## Usage

Once installed, this buki automatically commits your work:

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

## Philosophy

This buki embodies the Bushido virtues:

- **Courage (勇 - Yū)**: Commit your work confidently, even when incomplete
- **Integrity (誠 - Makoto)**: Create an honest record of your development process
- **Respect (礼 - Rei)**: Make your work reviewable and understandable for others
- **Honor (名誉 - Meiyo)**: Take pride in showing your problem-solving journey

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
    "buki-git-storytelling@han": false
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
