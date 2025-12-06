# hashi-han-metrics

MCP server for agent task tracking and performance metrics. Enables self-reporting agents with objective validation.

## Overview

The han-metrics plugin provides a Model Context Protocol (MCP) server that allows AI agents to track their work, report progress, and build a metrics database of their performance over time. This creates a foundation for:

- **Self-awareness**: Agents track what they work on and how it turns out
- **Calibration**: Compare agent confidence with actual outcomes
- **Performance analysis**: Understand success rates, common failure modes, and improvement areas
- **Objective validation**: Cross-reference self-reported outcomes with hook validation results

All data is stored locally in a SQLite database at `~/.claude/metrics/metrics.db` (or `$CLAUDE_CONFIG_DIR/metrics/metrics.db` if using a custom config directory) - no external services, complete privacy.

## How It Works

### Self-Reporting Workflow

1. **Agent starts task**: Calls `start_task` with description and type
2. **Agent works**: Optionally calls `update_task` to log progress
3. **Agent completes**: Calls `complete_task` or `fail_task` with self-assessment
4. **Hooks validate**: Quality enforcement hooks run and results are logged
5. **Metrics available**: Query performance data via `query_metrics`

### Example Flow

```typescript
// Agent begins implementing a feature
const { task_id } = await start_task({
  description: "Implement user authentication flow",
  type: "implementation",
  estimated_complexity: "moderate"
});

// Agent logs progress
await update_task({
  task_id,
  notes: "Created login component and auth service"
});

// Agent completes with self-assessment
await complete_task({
  task_id,
  outcome: "success",
  confidence: 0.85, // 85% confident in success
  files_modified: ["src/auth/login.tsx", "src/services/auth.ts"],
  tests_added: 12,
  notes: "All tests passing, ready for review"
});

// Hook validation runs automatically (via Stop hooks)
// Results cross-referenced with agent self-assessment
```

## MCP Tools

### start_task

Start tracking a new task. Returns a `task_id` for future updates.

**Parameters:**

- `description` (string, required): Clear description of the task
- `type` (enum, required): One of `implementation`, `fix`, `refactor`, `research`
- `estimated_complexity` (enum, optional): One of `simple`, `moderate`, `complex`

**Returns:**

```json
{
  "task_id": "task-1234567890-abc123"
}
```

**Example:**

```typescript
const result = await start_task({
  description: "Fix memory leak in event listeners",
  type: "fix",
  estimated_complexity: "simple"
});
```

### update_task

Update a task with progress notes or status changes.

**Parameters:**

- `task_id` (string, required): Task ID from `start_task`
- `status` (string, optional): Status update
- `notes` (string, optional): Progress notes

**Returns:**

```json
{
  "success": true
}
```

**Example:**

```typescript
await update_task({
  task_id: "task-1234567890-abc123",
  notes: "Identified leak in useEffect cleanup"
});
```

### complete_task

Mark a task as completed with outcome assessment.

**Parameters:**

- `task_id` (string, required): Task ID from `start_task`
- `outcome` (enum, required): One of `success`, `partial`, `failure`
- `confidence` (number, required): Confidence level 0-1 (used for calibration)
- `files_modified` (string[], optional): List of modified files
- `tests_added` (number, optional): Count of tests added
- `notes` (string, optional): Completion notes

**Returns:**

```json
{
  "success": true
}
```

**Example:**

```typescript
await complete_task({
  task_id: "task-1234567890-abc123",
  outcome: "success",
  confidence: 0.95,
  files_modified: ["src/components/EventListener.tsx"],
  tests_added: 3,
  notes: "Memory leak fixed, verified with heap snapshots"
});
```

### fail_task

Mark a task as failed with detailed reason.

**Parameters:**

- `task_id` (string, required): Task ID from `start_task`
- `reason` (string, required): Reason for failure
- `confidence` (number, optional): Confidence in failure assessment 0-1
- `attempted_solutions` (string[], optional): Solutions that were tried
- `notes` (string, optional): Additional notes

**Returns:**

```json
{
  "success": true
}
```

**Example:**

```typescript
await fail_task({
  task_id: "task-1234567890-abc123",
  reason: "Unable to reproduce issue in test environment",
  confidence: 0.7,
  attempted_solutions: [
    "Tried different Node versions",
    "Checked environment variables",
    "Reviewed production logs"
  ],
  notes: "Needs production debugging access"
});
```

### query_metrics

Query task metrics and performance data.

**Parameters:**

- `period` (enum, optional): One of `day`, `week`, `month`
- `task_type` (enum, optional): Filter by task type
- `outcome` (enum, optional): Filter by outcome

**Returns:**

```json
{
  "total_tasks": 45,
  "completed_tasks": 42,
  "success_rate": 0.88,
  "average_confidence": 0.82,
  "average_duration_seconds": 1847,
  "by_type": {
    "implementation": 20,
    "fix": 15,
    "refactor": 10
  },
  "by_outcome": {
    "success": 37,
    "partial": 5,
    "failure": 3
  },
  "calibration_score": 0.91,
  "tasks": [...]
}
```

**Example:**

```typescript
// Get metrics for the past week
const metrics = await query_metrics({
  period: "week"
});

// Get all failed fixes
const failedFixes = await query_metrics({
  task_type: "fix",
  outcome: "failure"
});
```

## Installation

### Via Claude Code

```bash
# Install the plugin
claude plugin install hashi-han-metrics@han

# Or via npx han CLI
npx @thebushidocollective/han plugin install hashi-han-metrics
```

### Manual Installation

Add to your `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "hashi-han-metrics@han": true
  },
  "extraKnownMarketplaces": {
    "han": {
      "source": "directory",
      "path": "/path/to/han"
    }
  }
}
```

The metrics server is integrated into the `@thebushidocollective/han` CLI package and will be automatically invoked via `npx` when the plugin is enabled.

### MCP Server Configuration

The plugin automatically configures the following MCP server:

```json
{
  "mcpServers": {
    "han-metrics": {
      "command": "npx",
      "args": ["--yes", "@thebushidocollective/han", "mcp", "metrics"],
      "env": {}
    }
  }
}
```

This configuration is applied automatically when you install the plugin via Claude Code. The server runs via the `han mcp metrics` command, which is part of the main Han CLI package.

## Database Schema

The metrics database is stored at `~/.claude/metrics/metrics.db` (respects `$CLAUDE_CONFIG_DIR` environment variable) with the following schema:

### tasks table

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (task ID) |
| description | TEXT | Task description |
| type | TEXT | Task type (implementation/fix/refactor/research) |
| complexity | TEXT | Estimated complexity (simple/moderate/complex) |
| started_at | DATETIME | When task started |
| completed_at | DATETIME | When task completed |
| duration_seconds | INTEGER | Task duration in seconds |
| status | TEXT | Task status (active/completed/failed) |
| outcome | TEXT | Task outcome (success/partial/failure) |
| confidence | REAL | Agent confidence (0-1) |
| notes | TEXT | Task notes |
| files_modified | TEXT | JSON array of modified files |
| tests_added | INTEGER | Number of tests added |
| failure_reason | TEXT | Reason for failure |
| attempted_solutions | TEXT | JSON array of attempted solutions |
| hooks_passed | BOOLEAN | Whether validation hooks passed |
| hook_results | TEXT | JSON hook validation results |

### task_updates table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| task_id | TEXT | Foreign key to tasks |
| timestamp | DATETIME | Update timestamp |
| status | TEXT | Status update |
| notes | TEXT | Update notes |

## Integrated Hooks

This plugin includes two hooks that work automatically when installed:

### SessionStart Hook

**File**: `hooks/metrics-tracking.md`

Injects instructions at the start of each session teaching agents how to:

- Use the MCP tracking tools
- Self-assess task outcomes
- Calibrate confidence levels
- Determine when to track work

### Stop Hook

**File**: `hooks/validate-metrics.sh`

Runs at the end of each session to:

- Cross-validate agent self-assessments with hook results
- Update task records with objective validation data
- Calculate calibration accuracy
- Report confidence mismatches

These hooks create a complete feedback loop where agents report their work, and the system validates their assessments against objective quality checks (tests, lints, type checks).

## Privacy & Security

- **100% local**: All data stored in local SQLite database
- **No network calls**: MCP server operates entirely offline
- **User-owned data**: Database at `~/.claude/metrics/` can be backed up, queried, or deleted
- **No PII required**: Tracks work patterns, not personal information

## Querying the Database

You can query the database directly with SQLite (respects `$CLAUDE_CONFIG_DIR` environment variable):

```bash
# Set database path (use custom config dir if set)
DB_PATH="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/metrics/metrics.db"

# View recent tasks
sqlite3 "$DB_PATH" "SELECT * FROM tasks ORDER BY started_at DESC LIMIT 10"

# Calculate success rate
sqlite3 "$DB_PATH" "SELECT
  COUNT(*) as total,
  SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
  ROUND(100.0 * SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM tasks WHERE outcome IS NOT NULL"

# Find tasks where confidence didn't match outcome
sqlite3 "$DB_PATH" "SELECT * FROM tasks
WHERE confidence > 0.8 AND outcome = 'failure'
OR confidence < 0.5 AND outcome = 'success'"
```

## Use Cases

### Agent Self-Awareness

Agents can review their past performance before starting similar work:

```typescript
// Check historical performance on fix tasks
const fixMetrics = await query_metrics({
  task_type: "fix",
  period: "month"
});

// Adjust confidence based on past success rate
const myConfidence = fixMetrics.success_rate * 0.9;
```

### Calibration Training

Build datasets for training agents to better estimate their own confidence:

```sql
SELECT confidence, outcome, type, complexity
FROM tasks
WHERE outcome IS NOT NULL
ORDER BY started_at DESC
```

### Performance Reports

Generate reports on agent productivity and quality:

```typescript
const weeklyReport = await query_metrics({
  period: "week"
});

console.log(`
This week:
- Completed ${weeklyReport.completed_tasks} tasks
- Success rate: ${(weeklyReport.success_rate * 100).toFixed(1)}%
- Calibration score: ${(weeklyReport.calibration_score * 100).toFixed(1)}%
- Avg duration: ${Math.round(weeklyReport.average_duration_seconds / 60)} minutes
`);
```

## Future Enhancements

Potential additions for future versions:

- Export metrics to CSV/JSON
- Visualization dashboard
- Comparison between agents
- Hook result integration
- Custom metrics and tags
- Time-based analytics
- Failure pattern detection

## License

MIT

## Contributing

Contributions welcome! Please ensure:

- TypeScript types are properly defined
- Database migrations are handled
- Privacy is preserved (no external calls)
- Documentation is updated
