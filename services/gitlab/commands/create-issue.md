---
description: Create a new issue in a GitLab project
---

# Create GitLab Issue

## Name

hashi-gitlab:create-issue - Create a new issue in a GitLab project

## Synopsis

```
/create-issue [arguments]
```

## Description

Create a new issue in a GitLab project

## Implementation

Create a new issue in a GitLab project with title, description, and labels.

## Usage

```
/create-issue
```

This command helps you create a well-structured GitLab issue by guiding you through the process.

## What This Command Does

1. Asks for the project ID or path
2. Prompts for issue title
3. Requests issue description
4. Asks for labels (optional)
5. Creates the issue using the GitLab MCP `create_issue` tool
6. Returns the issue number and URL

## Prerequisites

- GitLab MCP server must be installed and configured
- You must have permission to create issues in the target project
- OAuth authentication must be completed

## Example Interaction

```
User: /create-issue

Claude: I'll help you create a GitLab issue. What's the project ID or path?

User: 123

Claude: What should the issue title be?

User: Fix memory leak in image processor

Claude: Please provide a description for the issue (optional, press Enter to skip):

User: Memory usage increases continuously when processing large images. After processing 100+ images, the application crashes due to OOM errors.

Claude: Any labels to add? (comma-separated, or press Enter to skip):

User: bug, high-priority, performance

Claude: Creating issue in project 123...

✓ Issue created successfully!
  #42 - Fix memory leak in image processor
  https://gitlab.com/your-org/project/-/issues/42
```

## Tips

- Use numeric project IDs for faster lookups
- URL-encoded paths work too: `my-group%2Fmy-project`
- Write clear, actionable issue titles
- Include reproduction steps in the description
- Use labels consistently across your project
- Mention related issues or MRs using `#123` syntax

## Related Commands

- `/search-issues`: Find existing issues before creating duplicates
- `/view-issue`: View issue details
- `/create-mr`: Create a merge request to fix the issue
