---
name: view-workflow
description: View GitHub Actions workflow runs and status
---

# View GitHub Actions Workflow

## Name

hashi-github:view-workflow - View GitHub Actions workflow runs and status

## Synopsis

```
/view-workflow [arguments]
```

## Description

View GitHub Actions workflow runs and status

## Implementation

View the status of GitHub Actions workflow runs for a repository or pull request.

## Usage

```
/view-workflow [owner/repo] [run-id or pr-number]
```

This command displays comprehensive workflow and job information.

## What This Command Does

1. Fetches workflow run data for a repository or PR
2. Retrieves all jobs in the workflow using `list_workflow_runs`
3. Displays:
   - Workflow status and duration
   - Individual job statuses
   - Failed job logs (if any)
   - Job durations and timestamps
   - Workflow trigger information

## Prerequisites

- GitHub MCP server must be installed and configured
- You must have access to the repository
- OAuth authentication must be completed

## Example Interaction

### View Latest Workflow Runs

```
User: /view-workflow my-org/my-repo

Claude: Fetching workflow runs for my-org/my-repo...

## Recent Workflow Runs

### Run #1234 - CI Pipeline
**Status**: Running
**Branch**: feature/user-auth
**Triggered by**: Push by @johndoe
**Started**: 3 minutes ago

Jobs:
- build: Passed (1m 23s)
- test: Running (2m 15s elapsed)
- lint: Pending
- deploy: Pending

### Run #1233 - CI Pipeline
**Status**: Success
**Branch**: main
**Duration**: 4m 32s
**Completed**: 1 hour ago

All jobs passed.
```

### View Failed Workflow

```
User: /view-workflow my-org/my-repo 1232

Claude: Fetching workflow run #1232...

## Workflow Run #1232 - CI Pipeline
**Status**: Failed
**Branch**: feature/new-feature
**Duration**: 2m 45s

### Jobs by Status

#### Failed
- test (2m 15s)
  **Error**: Test suite failed with 3 failures
  ```

  FAIL src/auth.test.ts
    Authentication API
      POST /login
        should return JWT token
        Expected: 200
        Received: 500

  ```

#### Passed
- build (1m 18s)
- lint (24s)

#### Skipped
- deploy (skipped due to test failure)

### Recommendations
1. Check database connection in test environment
2. Review test timeout settings
3. Re-run workflow after fixes
```

## Arguments

- `owner/repo` (required): Repository in owner/repo format
- `run-id` (optional): Specific workflow run ID to view
- `pr-number` (optional): View workflows for a specific PR

## Tips

- Monitor workflows during active development
- Investigate failed jobs immediately
- Compare run times to identify bottlenecks
- Check if tests are flaky or consistently failing
- Review job logs for specific error messages
- Use workflow status to determine PR readiness

## Common Issues

### Failed Tests

- Review test logs for specific failures
- Check if tests pass locally
- Verify test environment configuration
- Look for flaky tests

### Build Errors

- Check for missing dependencies
- Verify build configuration
- Look for syntax or compilation errors

### Timeout Issues

- Increase timeout values if needed
- Optimize slow tests or builds
- Check for infinite loops

## Related Commands

- `/review-pr`: Full PR review including workflow status
- `/create-pr`: Create PR that will trigger workflows
- `/create-issue`: Create issue for workflow failures
