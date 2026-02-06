---
name: create-issue
description: Create a new issue in a GitHub repository
---

# Create GitHub Issue

## Name

hashi-github:create-issue - Create a new issue in a GitHub repository

## Synopsis

```
/create-issue [arguments]
```

## Description

Create a new issue in a GitHub repository

## Implementation

Create a new issue in a GitHub repository with title, body, and labels.

## Usage

```
/create-issue [owner/repo]
```

This command helps you create a well-structured GitHub issue.

## What This Command Does

1. Asks for the repository (owner/repo format)
2. Prompts for issue title
3. Requests issue body/description
4. Asks for labels (optional)
5. Creates the issue using the GitHub MCP `create_issue` tool
6. Returns the issue number and URL

## Prerequisites

- GitHub MCP server must be installed and configured
- You must have permission to create issues in the target repository
- OAuth authentication must be completed

## Example Interaction

```
User: /create-issue

Claude: I'll help you create a GitHub issue. What repository? (owner/repo format)

User: my-org/my-repo

Claude: What should the issue title be?

User: Fix memory leak in image processor

Claude: Please provide a description for the issue:

User: Memory usage increases continuously when processing large images.
After processing 100+ images, the application crashes due to OOM errors.

## Steps to reproduce
1. Start the image processor
2. Process 100+ large images (>5MB each)
3. Observe memory usage climbing

Claude: Any labels to add? (comma-separated, or press Enter to skip):

User: bug, high-priority

Claude: Creating issue in my-org/my-repo...

Issue created successfully!
#42 - Fix memory leak in image processor
https://github.com/my-org/my-repo/issues/42
```

## Tips

- Use `owner/repo` format for repository identification
- Write clear, actionable issue titles
- Include reproduction steps in the description
- Use GitHub-flavored Markdown in descriptions
- Reference related issues with `#123` syntax
- Mention users with `@username` for notifications

## Related Commands

- `/search-code`: Find related code before filing
- `/create-pr`: Create a pull request to fix the issue
- `/review-pr`: Review existing PRs related to the issue
