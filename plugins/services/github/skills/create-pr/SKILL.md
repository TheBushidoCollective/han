---
name: create-pr
description: Create a new pull request in a GitHub repository
---

# Create GitHub Pull Request

## Name

github:create-pr - Create a new pull request in a GitHub repository

## Synopsis

```
/create-pr [arguments]
```

## Description

Create a new pull request in a GitHub repository

## Implementation

Create a new pull request with source and target branches.

## Usage

```
/create-pr [owner/repo]
```

This command helps you create a pull request with all necessary details.

## What This Command Does

1. Asks for the repository (owner/repo format)
2. Prompts for source branch name (head)
3. Requests target branch name (base)
4. Asks for PR title
5. Requests PR description (optional)
6. Creates the pull request using the GitHub MCP `create_pull_request` tool
7. Returns the PR number and URL

## Prerequisites

- GitHub MCP server must be installed and configured
- You must have push access to the repository
- Both source and target branches must exist
- OAuth authentication must be completed

## Example Interaction

```
User: /create-pr my-org/my-repo

Claude: I'll help you create a pull request. What's the source branch?

User: feature/user-authentication

Claude: What's the target branch?

User: main

Claude: What should the pull request title be?

User: Add JWT-based user authentication

Claude: Please provide a description (optional):

User: This PR implements JWT-based authentication for the API:
- User login and registration endpoints
- Token generation and validation middleware
- Password hashing with bcrypt
- Unit tests for auth flows

Closes #42

Claude: Should this be a draft PR?

User: No

Claude: Creating pull request...

Pull request created successfully!
#15 - Add JWT-based user authentication
https://github.com/my-org/my-repo/pull/15

Status: Open
Source: feature/user-authentication -> main
```

## Tips

- Link related issues using `Closes #123` or `Fixes #123` in the description
- Use conventional commit prefixes in titles: `feat:`, `fix:`, `refactor:`
- Include a testing checklist in the description
- Consider creating a draft PR for work-in-progress
- Ensure your branch is up to date with the target branch

## Related Commands

- `/review-pr`: Get a comprehensive review of your PR
- `/create-issue`: Create an issue that this PR will resolve
- `/view-workflow`: Check CI/CD status for the PR
