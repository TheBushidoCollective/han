---
description: Get comprehensive review of a GitHub pull request
---

# Review GitHub Pull Request

## Name

sensei-github:review-pr - Get comprehensive review of a GitHub pull request

## Synopsis

```
/review-pr [arguments]
```

## Description

Get comprehensive review of a GitHub pull request

## Implementation

Get a comprehensive review of a pull request including commits, diffs, and checks status.

## Usage

```
/review-pr [owner/repo] [pr-number]
```

This command performs a thorough review of a pull request.

## What This Command Does

1. Fetches pull request details using `get_pull_request`
2. Retrieves commit history
3. Analyzes file changes and diffs
4. Checks CI/CD status from GitHub Actions
5. Provides a structured review with:
   - PR metadata (title, author, status, dates)
   - Commit history and messages
   - File changes summary
   - Code review suggestions
   - CI/CD workflow status
   - Recommendations for approval or changes

## Prerequisites

- GitHub MCP server must be installed and configured
- You must have access to the repository
- OAuth authentication must be completed

## Example Interaction

```
User: /review-pr my-org/my-repo 15

Claude: Reviewing pull request #15 in my-org/my-repo...

## Pull Request Review: #15 - Add JWT-based user authentication

### Overview
- **Author**: @johndoe
- **Status**: Open
- **Created**: 2025-01-15
- **Target Branch**: main <- feature/user-authentication
- **Changes**: +347 lines, -12 lines across 8 files

### Commits (3 total)
1. feat: add JWT token generation and validation
2. feat: implement user login and registration endpoints
3. test: add unit tests for authentication flows

### Files Changed
+ src/auth/jwt.ts (+145, -0) - New JWT utilities
+ src/api/login.ts (+89, -5) - Login endpoint implementation
+ src/api/register.ts (+67, -0) - Registration endpoint
+ src/middleware/auth.ts (+23, -0) - Authentication middleware
+ tests/auth.test.ts (+23, -0) - Unit tests

### Code Review Observations

**Strengths:**
- Clean separation of concerns with dedicated auth module
- Comprehensive error handling in login/register flows
- Good test coverage for happy and error paths
- Proper password hashing implementation

**Suggestions for Improvement:**
1. Consider adding rate limiting to login endpoint
2. Add JSDoc comments to JWT utility functions
3. Could benefit from integration tests

### CI/CD Status
- build: Passed (1m 23s)
- test: Passed (2m 45s)
- lint: Passed (24s)

### Recommendation
**Approve with minor suggestions**

This PR implements authentication securely and follows best practices.
```

## Arguments

- `owner/repo` (required): Repository in owner/repo format
- `pr-number` (required): Pull request number

## Tips

- Review PRs regularly to maintain code quality
- Look for security issues, especially in authentication code
- Check test coverage for new functionality
- Verify CI passes before approving
- Consider architectural impact of large changes
- Use this for pre-review analysis before detailed code review

## Related Commands

- `/create-pr`: Create a new pull request
- `/search-code`: Find similar implementations for comparison
- `/view-workflow`: Check detailed workflow run status
