---
name: git-storytelling-commit-strategy
description: Use when planning commit strategies or determining when to commit changes. Helps developers commit early and often to tell the story of their development process.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Git Storytelling - Commit Strategy

This skill helps you understand and implement effective commit strategies that tell the story of your development process through small, focused commits.

## Key Concepts

### Commit Early, Commit Often

The practice of making small, frequent commits throughout development rather than large, infrequent commits. This approach:

- Creates a detailed history of your thought process
- Makes it easier to understand changes
- Simplifies debugging and reverting changes
- Enables better code reviews
- Tells the story of how the solution evolved

### Atomic Commits

Each commit should represent a single logical change:

- One feature addition
- One bug fix
- One refactoring
- One documentation update

This makes the git history navigable and meaningful.

### The Story Arc

Your commits should read like a story:

1. **Setup**: Initial project structure, dependencies
2. **Development**: Incremental feature additions
3. **Refinement**: Bug fixes, optimizations
4. **Polish**: Documentation, cleanup

## Best Practices

### DO Commit When:

✅ You've completed a logical unit of work (even if small)
✅ Tests pass for the changes made
✅ You're about to switch tasks or take a break
✅ You've refactored code to be clearer
✅ You've fixed a bug (one commit per bug)
✅ You've added a new file or module
✅ You've updated documentation
✅ You're at a stable checkpoint

### DON'T Commit When:

❌ Code doesn't compile or has syntax errors
❌ Tests are failing (unless documenting a known issue)
❌ You have unrelated changes mixed together
❌ You have debugging code or temporary comments
❌ You have secrets or sensitive data

## Commit Message Patterns

### Good Commit Messages

```
feat: add user authentication with JWT

Implement JWT-based authentication system with:
- Login endpoint
- Token generation
- Token validation middleware

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

```
fix: resolve memory leak in websocket handler

Close websocket connections properly when client disconnects
to prevent memory accumulation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

```
refactor: extract validation logic into separate module

Move validation functions from controllers to validators/
for better reusability and testing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Commit Prefixes

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring without behavior change
- `test:` - Adding or updating tests
- `docs:` - Documentation changes
- `style:` - Formatting, whitespace changes
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks

## Examples

### Example 1: Building a REST API

Good storytelling commits:

```bash
# 1. Setup
git commit -m "feat: initialize Express server with basic configuration"

# 2. Foundation
git commit -m "feat: add database connection with Prisma"

# 3. Feature development
git commit -m "feat: create user model and migration"
git commit -m "feat: add user registration endpoint"
git commit -m "feat: add user login endpoint"
git commit -m "test: add user authentication tests"

# 4. Refinement
git commit -m "fix: validate email format in registration"
git commit -m "refactor: extract password hashing to utility"

# 5. Documentation
git commit -m "docs: add API endpoint documentation"
```

### Example 2: Bug Fix Process

```bash
# 1. Identify and reproduce
git commit -m "test: add failing test for pagination edge case"

# 2. Fix the issue
git commit -m "fix: handle empty results in pagination"

# 3. Verify
git commit -m "test: verify pagination works with edge cases"

# 4. Cleanup
git commit -m "refactor: simplify pagination logic"
```

### Example 3: Refactoring

```bash
# 1. Prepare
git commit -m "test: add comprehensive tests before refactoring"

# 2. Small steps
git commit -m "refactor: extract common validation logic"
git commit -m "refactor: rename confusing variable names"
git commit -m "refactor: split large function into smaller units"

# 3. Verify
git commit -m "test: verify all tests still pass after refactor"
```

## Common Patterns

### Working on a Feature

1. Commit initial structure/skeleton
2. Commit each component or module
3. Commit tests as you write them
4. Commit bug fixes immediately when found
5. Commit documentation when complete
6. Final commit for integration

### Debugging

1. Commit reproduction test case
2. Commit the fix
3. Commit any related improvements discovered
4. Commit documentation of the issue

### Code Review Feedback

1. Commit each suggested change separately
2. Use descriptive messages referencing the feedback
3. Keep commits small for easier review

## Anti-Patterns

### Avoid These Commit Styles

❌ **The Dump Truck**
```bash
git commit -m "updated files"  # Too vague, too many changes
```

❌ **The Novel**
```bash
git commit -m "fixed bug and added feature and updated docs and refactored code and..."
```

❌ **The WIP Spam**
```bash
git commit -m "wip"
git commit -m "wip2"
git commit -m "wip3"
# Use better descriptions even for work-in-progress
```

❌ **The Time Machine**
```bash
# Making 50 commits then squashing them all
# Keep the story, just clean up truly meaningless commits
```

## Workflow Integration

### With Feature Branches

```bash
# On feature branch
git checkout -b feature/user-auth

# Make small commits
git commit -m "feat: add User model"
git commit -m "feat: add authentication middleware"
git commit -m "test: add auth tests"

# Clean history is preserved when merging
git checkout main
git merge feature/user-auth
```

### With Pull Requests

Small commits make code review easier:
- Reviewers can understand changes step-by-step
- Discussion can happen on specific commits
- Changes are easier to test individually

### With CI/CD

Frequent commits trigger CI more often:
- Catch issues earlier
- Smaller changesets are easier to debug
- Faster feedback loop

## Related Skills

- **git-history-navigation**: Understanding git log, bisect, and blame
- **git-branch-strategy**: Managing branches effectively
- **code-review**: How commit strategy improves reviews

## Tips for Success

1. **Commit before context switching** - Always commit before changing tasks
2. **Review before committing** - Use `git diff` to review changes
3. **Write commit messages for future you** - Explain the "why" not just the "what"
4. **Keep the story coherent** - Each commit should make sense on its own
5. **Use the hook** - Let the buki-git-storytelling hook remind you to commit

## Checking Your Commit Story

Review your commits to ensure they tell a good story:

```bash
# View commit history
git log --oneline --graph

# See what changed in each commit
git log -p

# Review recent commits
git log --oneline -10
```

A good story should be:
- Easy to follow
- Logically ordered
- Self-documenting
- Helpful for debugging
