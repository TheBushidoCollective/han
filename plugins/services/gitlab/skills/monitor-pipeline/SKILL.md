---
description: Monitor a GitLab pipeline or job until completion, reporting status changes and failures in real-time
---

# Monitor GitLab Pipeline

## Name

gitlab:monitor-pipeline - Monitor a pipeline or job until completion with real-time status updates

## Synopsis

```
/monitor-pipeline <project-id> <pipeline-id> [--job <job-id>] [--interval <seconds>]
```

## Description

Continuously monitors a GitLab CI/CD pipeline or specific job until it reaches a terminal state (success, failed, or canceled). Reports status changes as they happen and immediately notifies the user of any failures with detailed error information.

## Implementation

This skill uses a polling approach to monitor pipeline and job statuses:

1. **Initial Status Check**: Fetch current pipeline/job state
2. **Polling Loop**: Check status at regular intervals (default: 15 seconds)
3. **Change Detection**: Compare current state with previous state
4. **Real-time Reporting**: Output updates when jobs transition states
5. **Failure Notification**: Immediately report failures with job logs
6. **Completion**: Exit when pipeline reaches terminal state

### Monitoring Algorithm

```
WHILE pipeline.status IN [pending, running, waiting_for_resource, preparing]
  WAIT interval seconds
  FETCH current pipeline status
  FETCH all job statuses

  FOR each job:
    IF job.status changed:
      REPORT status change
      IF job.status == "failed":
        FETCH job logs
        REPORT failure details immediately

  REPORT overall progress summary

REPORT final pipeline result
```

## Usage

### Monitor a Pipeline

```
/monitor-pipeline 456 1234
```

### Monitor a Specific Job

```
/monitor-pipeline 456 1234 --job 5678
```

### Custom Polling Interval

```
/monitor-pipeline 456 1234 --interval 30
```

## What This Skill Does

1. **Fetches initial pipeline state** using GitLab API
2. **Tracks job transitions** from pending -> running -> success/failed
3. **Reports immediately** when any job fails
4. **Fetches failure logs** automatically for failed jobs
5. **Provides progress updates** showing completed vs remaining jobs
6. **Exits cleanly** when pipeline completes or is canceled

## Prerequisites

- GitLab MCP server must be configured
- Access to the target project
- Valid pipeline ID (can be obtained from MR or project pipelines list)

## Example Interaction

### Successful Pipeline Monitoring

```
User: /monitor-pipeline 456 1234

Claude: Starting pipeline monitor for Pipeline #1234 in project 456...

## Pipeline Monitor Started

**Pipeline**: #1234
**Branch**: feature/add-authentication
**Started**: 2025-01-15 10:30:22
**Status**: Running

I'll monitor this pipeline and report status changes as they happen.

---

### Update [10:31:45]

**Stage: build**
- ✓ `compile` completed successfully (1m 18s)

Progress: 1/6 jobs complete

---

### Update [10:32:30]

**Stage: build**
- ✓ `bundle-assets` completed successfully (42s)

Progress: 2/6 jobs complete

---

### Update [10:34:15]

**Stage: test**
- ✓ `unit-tests` completed successfully (1m 45s)

Progress: 3/6 jobs complete

---

### Update [10:36:00]

**Stage: test**
- ✓ `integration-tests` completed successfully (1m 45s)

Progress: 4/6 jobs complete

---

### Update [10:37:30]

**Stage: lint**
- ✓ `eslint-check` completed successfully (1m 30s)
- ✓ `type-check` completed successfully (1m 28s)

Progress: 6/6 jobs complete

---

## Pipeline Complete

**Status**: ✓ Success
**Total Duration**: 7m 08s
**All 6 jobs passed**

The pipeline completed successfully. Your changes are ready for merge.
```

### Pipeline with Failure

```
User: /monitor-pipeline 456 1234

Claude: Starting pipeline monitor for Pipeline #1234...

## Pipeline Monitor Started

**Pipeline**: #1234
**Branch**: feature/database-migration
**Status**: Running

---

### Update [10:31:45]

**Stage: build**
- ✓ `compile` completed successfully (1m 18s)

Progress: 1/6 jobs complete

---

### FAILURE ALERT [10:33:20]

**Job Failed**: `integration-tests` in stage `test`

**Duration**: 1m 35s
**Exit Code**: 1

**Error Log**:
```
FAILED tests/integration/auth.test.ts

  ● Authentication API › POST /login › should validate credentials

    ConnectionError: Connection to database refused
    at PostgresClient.connect (src/db/client.ts:45:12)
    at setupTestDB (tests/setup.ts:23:8)

  1 test failed, 12 passed
```

**Likely Causes**:
1. Database service not available in CI environment
2. Missing DATABASE_URL environment variable
3. Network connectivity issues in test container

---

## Pipeline Failed

**Status**: ✗ Failed
**Duration**: 3m 35s
**Failed Jobs**: 1 (integration-tests)
**Passed Jobs**: 2
**Canceled Jobs**: 3

The pipeline failed due to test failures. Review the error above and push a fix.

Would you like me to help debug the database connection issue?
```

### Monitoring a Specific Job

```
User: /monitor-pipeline 456 1234 --job 5678

Claude: Starting job monitor for Job #5678 (deploy-production)...

## Job Monitor Started

**Job**: deploy-production (#5678)
**Stage**: deploy
**Status**: Running
**Started**: 2025-01-15 14:30:00

---

### Progress [14:31:00]

```
Deploying to production cluster...
- Pulling latest images... done
- Running database migrations... done
- Starting new containers...
```

---

### Progress [14:32:30]

```
- Health checks passing (3/3 replicas)
- Draining old instances...
- Deployment complete!
```

---

## Job Complete

**Status**: ✓ Success
**Duration**: 2m 45s

Production deployment successful!
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `project-id` | Yes | Numeric project ID or URL-encoded path |
| `pipeline-id` | Yes | Pipeline ID to monitor |
| `--job` | No | Specific job ID to monitor instead of entire pipeline |
| `--interval` | No | Polling interval in seconds (default: 15, min: 5, max: 300) |

## Terminal States

The monitor exits when the pipeline/job reaches one of these states:

| State | Description |
|-------|-------------|
| `success` | All jobs completed successfully |
| `failed` | One or more jobs failed |
| `canceled` | Pipeline was manually canceled |
| `skipped` | Pipeline was skipped (rules not met) |

## Status Indicators

| Icon | Meaning |
|------|---------|
| ✓ | Success/Passed |
| ✗ | Failed |
| ⏳ | Running |
| ⏸️ | Pending/Waiting |
| ⏭️ | Skipped |
| ⊘ | Canceled |

## Tips

- Use shorter intervals (5-10s) for quick pipelines
- Use longer intervals (30-60s) for long-running deployments
- Monitor specific jobs when you only care about one stage
- The skill automatically fetches logs for failed jobs
- Cancel monitoring with Ctrl+C if needed

## Error Handling

- **API Errors**: Retries with exponential backoff
- **Network Issues**: Reports connection problems, continues monitoring
- **Invalid IDs**: Exits immediately with helpful error message
- **Permission Denied**: Reports access issue, suggests checking permissions

## Related Commands

- `/view-pipeline`: One-time snapshot of pipeline status
- `/create-mr`: Create MR that triggers a pipeline
- `/review-mr`: Review MR including pipeline status
