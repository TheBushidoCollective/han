---
name: create-mr
description: Create a new merge request in a GitLab project
---

# Create GitLab Merge Request

## Name

gitlab:create-mr - Create a new merge request in a GitLab project

## Synopsis

```
/create-mr [arguments]
```

## Description

Create a new merge request in a GitLab project

## Implementation

Create a new merge request in a GitLab project with source and target branches.

## Usage

```
/create-mr
```

This command helps you create a merge request with all necessary details.

## What This Command Does

1. Asks for the project ID or path
2. Prompts for source branch name
3. Requests target branch name
4. Asks for MR title
5. Requests MR description (optional)
6. Creates the merge request using the GitLab MCP `create_merge_request` tool
7. Returns the MR number and URL

## Prerequisites

- GitLab MCP server must be installed and configured
- GitLab version 18.5 or later
- You must have Developer or higher role in the project
- Both source and target branches must exist
- OAuth authentication must be completed

## Example Interaction

```
User: /create-mr

Claude: I'll help you create a merge request. What's the project ID or path?

User: 456

Claude: What's the source branch name?

User: feature/user-authentication

Claude: What's the target branch name?

User: main

Claude: What should the merge request title be?

User: Add JWT-based user authentication

Claude: Please provide a description (optional, press Enter to skip):

User: This MR implements JWT-based authentication for the API:
- User login and registration endpoints
- Token generation and validation middleware
- Password hashing with bcrypt
- Unit tests for auth flows

Closes #42

Claude: Creating merge request in project 456...

✓ Merge request created successfully!
  !15 - Add JWT-based user authentication
  https://gitlab.com/your-org/project/-/merge_requests/15

  Status: Open
  Source: feature/user-authentication
  Target: main
```

## Tips

- Link related issues using `Closes #123` or `Fixes #123` in the description
- Use conventional commit prefixes in titles: `feat:`, `fix:`, `refactor:`
- Include a testing checklist in the description
- Add reviewers after creation if needed
- Set appropriate labels for categorization
- Consider creating a draft MR for work-in-progress

## Related Commands

- `/view-mr`: View merge request details and diffs
- `/review-mr`: Get a comprehensive review of a merge request
- `/create-issue`: Create an issue that this MR will resolve
