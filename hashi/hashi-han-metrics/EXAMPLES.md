# hashi-han-metrics Usage Examples

This document provides practical examples of using the han-metrics MCP server tools.

## Basic Workflow

### Starting a Task

```json
// Tool: start_task
{
  "description": "Implement user authentication with JWT tokens",
  "type": "implementation",
  "estimated_complexity": "moderate"
}

// Response:
{
  "task_id": "task-1733441234567-abc123"
}
```

### Logging Progress

```json
// Tool: update_task
{
  "task_id": "task-1733441234567-abc123",
  "notes": "Created JWT service and auth middleware"
}

// Response:
{
  "success": true
}
```

### Completing Successfully

```json
// Tool: complete_task
{
  "task_id": "task-1733441234567-abc123",
  "outcome": "success",
  "confidence": 0.90,
  "files_modified": [
    "src/services/jwt.ts",
    "src/middleware/auth.ts",
    "src/routes/auth.ts"
  ],
  "tests_added": 15,
  "notes": "All authentication flows tested, ready for review"
}

// Response:
{
  "success": true
}
```

## Handling Failures

### Recording a Failed Task

```json
// Tool: fail_task
{
  "task_id": "task-1733441234567-def456",
  "reason": "Cannot reproduce bug in development environment",
  "confidence": 0.75,
  "attempted_solutions": [
    "Tried with different Node versions (16, 18, 20)",
    "Checked environment variables against production",
    "Reviewed production logs for stack traces",
    "Attempted to replicate data conditions"
  ],
  "notes": "Needs production database dump to reproduce locally"
}

// Response:
{
  "success": true
}
```

## Querying Metrics

### Get Weekly Performance Summary

```json
// Tool: query_metrics
{
  "period": "week"
}

// Response:
{
  "total_tasks": 23,
  "completed_tasks": 22,
  "success_rate": 0.86,
  "average_confidence": 0.82,
  "average_duration_seconds": 2145,
  "by_type": {
    "implementation": 10,
    "fix": 8,
    "refactor": 4,
    "research": 1
  },
  "by_outcome": {
    "success": 19,
    "partial": 2,
    "failure": 1
  },
  "calibration_score": 0.88,
  "tasks": [...]
}
```

### Filter by Task Type

```json
// Tool: query_metrics
{
  "task_type": "fix",
  "period": "month"
}

// Response:
{
  "total_tasks": 34,
  "completed_tasks": 32,
  "success_rate": 0.91,
  "average_confidence": 0.85,
  "average_duration_seconds": 1247,
  "by_type": {
    "fix": 34
  },
  "by_outcome": {
    "success": 29,
    "partial": 2,
    "failure": 1
  },
  "calibration_score": 0.92,
  "tasks": [...]
}
```

### Find Failed Tasks

```json
// Tool: query_metrics
{
  "outcome": "failure"
}

// Response:
{
  "total_tasks": 5,
  "completed_tasks": 5,
  "success_rate": 0,
  "average_confidence": 0.42,
  "average_duration_seconds": 3421,
  "by_type": {
    "implementation": 2,
    "fix": 2,
    "refactor": 1
  },
  "by_outcome": {
    "failure": 5
  },
  "calibration_score": 0.58,
  "tasks": [
    {
      "id": "task-1733441234567-ghi789",
      "description": "Refactor database connection pool",
      "type": "refactor",
      "complexity": "complex",
      "started_at": "2025-12-05T10:30:00.000Z",
      "completed_at": "2025-12-05T14:45:00.000Z",
      "duration_seconds": 15300,
      "status": "failed",
      "outcome": "failure",
      "confidence": 0.60,
      "failure_reason": "Breaking changes to existing API, requires coordination",
      "attempted_solutions": [
        "Tried backwards-compatible wrapper",
        "Attempted gradual migration",
        "Proposed feature flag approach"
      ],
      "notes": "Needs architectural review and team consensus"
    }
  ]
}
```

## Real-World Scenarios

### Scenario 1: Bug Fix with Partial Success

```json
// Start
{
  "description": "Fix memory leak in WebSocket connections",
  "type": "fix",
  "estimated_complexity": "moderate"
}
// Returns: { "task_id": "task-xyz" }

// Update progress
{
  "task_id": "task-xyz",
  "notes": "Found leak in event listener cleanup, implementing fix"
}

// Complete with partial success
{
  "task_id": "task-xyz",
  "outcome": "partial",
  "confidence": 0.70,
  "files_modified": ["src/websocket/connection.ts"],
  "tests_added": 5,
  "notes": "Fixed main leak, but intermittent leak still occurs under high load"
}
```

### Scenario 2: Research Task

```json
// Start research
{
  "description": "Evaluate GraphQL vs REST for new API endpoints",
  "type": "research",
  "estimated_complexity": "simple"
}
// Returns: { "task_id": "task-research" }

// Complete research
{
  "task_id": "task-research",
  "outcome": "success",
  "confidence": 0.85,
  "notes": "Recommendation: Use REST for now, GraphQL for future v2. See docs/api-decision.md"
}
```

### Scenario 3: Complex Implementation with Updates

```json
// Start
{
  "description": "Implement real-time collaboration with CRDT",
  "type": "implementation",
  "estimated_complexity": "complex"
}
// Returns: { "task_id": "task-collab" }

// Update 1
{
  "task_id": "task-collab",
  "status": "researching",
  "notes": "Evaluating Yjs vs Automerge for CRDT implementation"
}

// Update 2
{
  "task_id": "task-collab",
  "status": "implementing",
  "notes": "Chose Yjs, integrating with existing document model"
}

// Update 3
{
  "task_id": "task-collab",
  "status": "testing",
  "notes": "Basic functionality working, testing conflict resolution"
}

// Complete
{
  "task_id": "task-collab",
  "outcome": "success",
  "confidence": 0.75,
  "files_modified": [
    "src/collaboration/crdt.ts",
    "src/collaboration/sync.ts",
    "src/models/document.ts"
  ],
  "tests_added": 28,
  "notes": "CRDT integration complete, handles most conflict scenarios. Edge cases documented."
}
```

## Analyzing Calibration

The calibration score indicates how well agent confidence matches actual outcomes.

### Well-Calibrated Agent (score: 0.90+)

```json
{
  "task_id": "task-1",
  "outcome": "success",
  "confidence": 0.95  // High confidence, successful outcome
}

{
  "task_id": "task-2",
  "outcome": "failure",
  "confidence": 0.30  // Low confidence, did fail
}
```

### Poorly-Calibrated Agent (score: < 0.70)

```json
{
  "task_id": "task-3",
  "outcome": "failure",
  "confidence": 0.90  // Overconfident
}

{
  "task_id": "task-4",
  "outcome": "success",
  "confidence": 0.40  // Underconfident
}
```

## Direct Database Queries

For advanced analysis, query the SQLite database directly:

```bash
# Most time-consuming tasks
sqlite3 ~/.claude/metrics/metrics.db "
  SELECT description, type, duration_seconds/60 as duration_minutes, outcome
  FROM tasks
  WHERE duration_seconds IS NOT NULL
  ORDER BY duration_seconds DESC
  LIMIT 10
"

# Success rate by complexity
sqlite3 ~/.claude/metrics/metrics.db "
  SELECT
    complexity,
    COUNT(*) as total,
    SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
    ROUND(100.0 * SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
  FROM tasks
  WHERE outcome IS NOT NULL AND complexity IS NOT NULL
  GROUP BY complexity
"

# Average confidence by outcome
sqlite3 ~/.claude/metrics/metrics.db "
  SELECT
    outcome,
    ROUND(AVG(confidence), 3) as avg_confidence,
    COUNT(*) as count
  FROM tasks
  WHERE confidence IS NOT NULL
  GROUP BY outcome
"

# Tasks with biggest calibration errors
sqlite3 ~/.claude/metrics/metrics.db "
  SELECT
    description,
    outcome,
    confidence,
    ABS(confidence - CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as error
  FROM tasks
  WHERE outcome IN ('success', 'failure') AND confidence IS NOT NULL
  ORDER BY error DESC
  LIMIT 10
"
```

## Integration with Hooks

Hooks can update task records with validation results:

```bash
#!/bin/bash
# In a quality enforcement hook

TASK_ID="task-1733441234567-abc123"

# Run tests
if mix test; then
  HOOKS_PASSED=1
  HOOK_RESULTS='{"tests": "passed", "warnings": 0}'
else
  HOOKS_PASSED=0
  HOOK_RESULTS='{"tests": "failed", "failures": 3}'
fi

# Update task record
sqlite3 ~/.claude/metrics/metrics.db "
  UPDATE tasks
  SET hooks_passed = ${HOOKS_PASSED},
      hook_results = '${HOOK_RESULTS}'
  WHERE id = '${TASK_ID}'
"
```

This creates objective validation that can be compared with agent self-assessment for calibration analysis.
