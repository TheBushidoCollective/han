#!/bin/bash
# Validate agent self-assessments against objective hook results
# This runs during Stop hooks to cross-check agent confidence with reality

set -e

METRICS_DB="${HOME}/.claude/metrics/metrics.db"

# Skip if metrics tracking not installed
if [ ! -f "$METRICS_DB" ]; then
  exit 0
fi

# Get most recent in-progress task
TASK_DATA=$(sqlite3 "$METRICS_DB" \
  "SELECT id, outcome, confidence FROM tasks
   WHERE status = 'in_progress' OR (status = 'completed' AND completed_at IS NULL)
   ORDER BY started_at DESC LIMIT 1" 2>/dev/null || echo "")

if [ -z "$TASK_DATA" ]; then
  # No active task to validate
  exit 0
fi

TASK_ID=$(echo "$TASK_DATA" | cut -d'|' -f1)
AGENT_OUTCOME=$(echo "$TASK_DATA" | cut -d'|' -f2)
AGENT_CONFIDENCE=$(echo "$TASK_DATA" | cut -d'|' -f3)

# Determine if hooks passed
# This is set by other hooks that ran during this Stop event
HOOKS_PASSED=${HAN_HOOKS_ALL_PASSED:-true}

# Create hook results JSON
HOOK_RESULTS="{\"all_passed\": ${HOOKS_PASSED}}"

# Calculate duration
DURATION=$(sqlite3 "$METRICS_DB" \
  "SELECT CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER)
   FROM tasks WHERE id='$TASK_ID'" 2>/dev/null || echo "0")

# Update task with validation results
sqlite3 "$METRICS_DB" <<SQL
UPDATE tasks
SET
  hooks_passed = ${HOOKS_PASSED},
  hook_results = '${HOOK_RESULTS}',
  completed_at = datetime('now'),
  duration_seconds = ${DURATION},
  status = 'completed'
WHERE id = '${TASK_ID}';
SQL

# Check for calibration issues
if [ "$AGENT_OUTCOME" = "success" ] && [ "$HOOKS_PASSED" = "false" ]; then
  echo "⚠️  Metrics: Task ${TASK_ID} - Agent reported success (confidence: ${AGENT_CONFIDENCE}) but hooks failed" >&2
  echo "   This suggests potential overconfidence in task assessment" >&2
fi

if [ "$AGENT_OUTCOME" = "failure" ] && [ "$HOOKS_PASSED" = "true" ]; then
  echo "ℹ️  Metrics: Task ${TASK_ID} - Agent reported failure but hooks passed" >&2
  echo "   Agent may be appropriately cautious or underconfident" >&2
fi

exit 0
