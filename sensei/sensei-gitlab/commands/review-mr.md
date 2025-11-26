---
description: Get comprehensive review of a GitLab merge request
---

# Review GitLab Merge Request

## Name

sensei-gitlab:review-mr - Get comprehensive review of a GitLab merge request

## Synopsis

```
/review-mr [arguments]
```

## Description

Get comprehensive review of a GitLab merge request

## Implementation

Get a comprehensive review of a GitLab merge request including commits, diffs, and pipeline status.

## Usage

```
/review-mr [project-id] [mr-number]
```

This command performs a thorough review of a merge request.

## What This Command Does

1. Fetches merge request details using `get_merge_request`
2. Retrieves all commits using `get_merge_request_commits`
3. Analyzes file changes using `get_merge_request_diffs`
4. Checks pipeline status using `get_merge_request_pipelines`
5. Provides a structured review with:
   - MR metadata (title, author, status, dates)
   - Commit history and messages
   - File changes summary
   - Code review suggestions
   - CI/CD pipeline status
   - Recommendations for approval or changes

## Prerequisites

- GitLab MCP server must be installed and configured
- You must have access to the project and merge request
- OAuth authentication must be completed

## Example Interaction

```
User: /review-mr 456 15

Claude: Reviewing merge request !15 in project 456...

## Merge Request Review: !15 - Add JWT-based user authentication

### Overview
- **Author**: @johndoe
- **Status**: Open
- **Created**: 2025-01-15
- **Target Branch**: main ← feature/user-authentication
- **Changes**: +347 lines, -12 lines across 8 files

### Commits (3 total)
1. feat: add JWT token generation and validation
2. feat: implement user login and registration endpoints
3. test: add unit tests for authentication flows

### Files Changed
✓ src/auth/jwt.ts (+145, -0) - New JWT utilities
✓ src/api/login.ts (+89, -5) - Login endpoint implementation
✓ src/api/register.ts (+67, -0) - Registration endpoint
✓ src/middleware/auth.ts (+23, -0) - Authentication middleware
✓ tests/auth.test.ts (+23, -0) - Unit tests
⚠ src/config/keys.ts (+0, -7) - Removed hardcoded secrets (good!)

### Code Review Observations

**Strengths:**
- Clean separation of concerns with dedicated auth module
- Comprehensive error handling in login/register flows
- Good test coverage for happy and error paths
- Proper password hashing implementation
- Removed hardcoded secrets

**Suggestions for Improvement:**
1. **Security**: Consider adding rate limiting to login endpoint
2. **Documentation**: Add JSDoc comments to JWT utility functions
3. **Testing**: Could benefit from integration tests
4. **Error Messages**: Login errors could be more specific for debugging

### CI/CD Pipeline Status
Pipeline #1234 - ✓ Passed (4m 32s)
- build: ✓ Passed (1m 23s)
- test: ✓ Passed (2m 45s)
- lint: ✓ Passed (24s)

### Recommendation
✅ **Approve with minor suggestions**

This MR implements authentication securely and follows best practices. The suggestions above would further improve code quality but aren't blocking. The pipeline passes all checks.

Consider addressing the rate limiting and documentation suggestions in a follow-up MR or before merging.
```

## Arguments

- `project-id` (required): Numeric project ID or URL-encoded path
- `mr-number` (required): Merge request number (the !NUMBER from GitLab)

## Tips

- Review merge requests regularly to maintain code quality
- Look for security issues, especially in authentication code
- Check test coverage for new functionality
- Verify CI/CD pipelines pass before approving
- Consider architectural impact of large changes
- Leave constructive feedback on the actual MR page
- Use this for pre-review analysis before detailed code review

## Related Commands

- `/create-mr`: Create a new merge request
- `/view-mr`: View basic MR details without full review
- `/search-code`: Find similar implementations for comparison
