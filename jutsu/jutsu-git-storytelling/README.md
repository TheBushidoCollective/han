# Jutsu: Git Storytelling

Provides guidance on git storytelling practices - committing work to tell the story of your development process.

## What This Jutsu Provides

### Git Storytelling Guidance

This jutsu provides a **Stop hook** that reminds Claude about git storytelling best practices at the end of each session:

- Consider committing meaningful work to preserve progress
- Use commits to tell the story of how code evolved
- Break complex work into logical commit steps
- Follow conventional commit message patterns

The guidance is **suggestive, not enforcing**:

- ✅ Provides context on when commits make sense
- ✅ Encourages thoughtful commit practices
- ✅ Allows flexibility for exploration and experimentation
- ✅ Respects your workflow and preferences

### Skills

This jutsu provides the following skill:

- **commit-strategy**: Comprehensive guide on when to commit, commit message patterns, and git storytelling best practices

## Installation

Install with npx (no installation required):

```bash
han plugin install jutsu-git-storytelling
```

## Usage

Once installed, this jutsu provides guidance at session end:

- **At Stop**: Claude receives git storytelling best practices
- **Judgment-based**: Claude decides if commits are appropriate
- **Non-blocking**: Never prevents you from ending a session

### How It Works

The Stop hook injects guidance that helps Claude:

1. **Assess the work**: Did meaningful progress happen?
2. **Consider context**: Is this a good stopping point?
3. **Use judgment**: Would commits help tell the story?
4. **Respect preferences**: Follow your workflow and choices

Claude might commit when:

- A logical unit of work is complete
- Multiple related changes form a coherent story
- Progress should be preserved

Claude won't commit when:

- Work is exploratory or incomplete
- You're mid-investigation
- It doesn't make sense for the workflow

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
