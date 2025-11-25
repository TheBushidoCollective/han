---
description: View CI/CD pipeline status for a merge request or project
---

# View GitLab Pipeline Status

View the status of CI/CD pipelines for a merge request or project.

## Usage

```
/view-pipeline [project-id] [mr-number]
```

Or for a specific pipeline:

```
/view-pipeline [project-id] --pipeline [pipeline-id]
```

This command displays comprehensive pipeline and job information.

## What This Command Does

1. Fetches pipeline data for a merge request or specific pipeline ID
2. Retrieves all jobs in the pipeline using `get_pipeline_jobs`
3. Displays:
   - Pipeline status and duration
   - Individual job statuses
   - Failed job logs (if any)
   - Job durations and timestamps
   - Pipeline stages breakdown

## Prerequisites

- GitLab MCP server must be installed and configured
- You must have access to the project
- OAuth authentication must be completed

## Example Interaction

### View MR Pipeline

```
User: /view-pipeline 456 15

Claude: Fetching pipeline status for MR !15 in project 456...

## Pipeline Status for MR !15

### Pipeline #1234
**Status**: ⏳ Running
**Duration**: 3m 42s (still running)
**Started**: 2025-01-15 10:30:22
**Branch**: feature/user-authentication

### Jobs by Stage

#### Stage: build (✓ Completed - 1m 23s)
- ✓ compile-typescript - Passed (1m 18s)
- ✓ bundle-assets - Passed (54s)

#### Stage: test (⏳ Running - 2m 15s)
- ✓ unit-tests - Passed (1m 45s)
- ⏳ integration-tests - Running (30s elapsed)
- ⏸️ e2e-tests - Pending

#### Stage: lint (⏸️ Pending)
- ⏸️ eslint-check - Pending
- ⏸️ type-check - Pending

#### Stage: deploy (⏸️ Pending)
- ⏸️ deploy-staging - Pending

### Summary
2 of 7 jobs completed successfully
1 job currently running
4 jobs pending

Estimated time remaining: ~2-3 minutes
```

### View Failed Pipeline

```
User: /view-pipeline 456 15

Claude: Fetching pipeline status for MR !15...

## Pipeline Status for MR !15

### Pipeline #1234
**Status**: ✗ Failed
**Duration**: 4m 18s
**Finished**: 2025-01-15 10:35:40
**Branch**: feature/user-authentication

### Jobs by Stage

#### Stage: build (✓ Completed - 1m 23s)
- ✓ compile-typescript - Passed (1m 18s)
- ✓ bundle-assets - Passed (54s)

#### Stage: test (✗ Failed - 2m 45s)
- ✓ unit-tests - Passed (1m 45s)
- ✗ integration-tests - Failed (2m 15s)
  **Error**: Test suite failed with 3 test failures
- ⏸️ e2e-tests - Canceled

#### Stage: lint (⏸️ Canceled)
- ⏸️ eslint-check - Canceled
- ⏸️ type-check - Canceled

### Failed Job Details: integration-tests

**Exit Code**: 1
**Log excerpt**:
```

Error: Connection to test database failed
    at Database.connect (db.ts:45:12)
    at setupTestDB (setup.ts:23:8)

  ● Authentication API › POST /login › should return JWT token

    expect(received).toBe(expected)

    Expected: 200
    Received: 500

  ● Authentication API › POST /register › should create new user

    Timeout - Async callback was not invoked within 5000ms

```

### Recommendations
1. Check database connection configuration in test environment
2. Verify test database is running and accessible
3. Review timeout settings for async tests
4. Re-run pipeline after fixes

Would you like me to help debug these test failures?
```

## Arguments

- `project-id` (required): Numeric project ID or URL-encoded path
- `mr-number` (optional): Merge request number to view its pipelines
- `--pipeline` (optional): Specific pipeline ID to view

## Tips

- Monitor pipelines during active development
- Investigate failed jobs immediately
- Compare pipeline times to identify bottlenecks
- Check if tests are flaky or consistently failing
- Review job logs for specific error messages
- Use pipeline status to determine MR readiness
- Set up notifications for pipeline failures

## Common Pipeline Issues

### Failed Tests

- Review test logs for specific failures
- Check if tests pass locally
- Verify test environment configuration
- Look for flaky tests that fail intermittently

### Build Errors

- Check for missing dependencies
- Verify build configuration
- Look for syntax or compilation errors
- Ensure all files are committed

### Timeout Issues

- Increase timeout values if needed
- Optimize slow tests or builds
- Check for infinite loops or deadlocks
- Review resource allocation

### Environment Issues

- Verify environment variables are set
- Check service dependencies are available
- Ensure correct versions of tools/languages
- Review secret and credential configuration

## Related Commands

- `/review-mr`: Get full MR review including pipeline status
- `/create-mr`: Create MR that will trigger pipeline
- `/view-issue`: View issues related to pipeline failures
