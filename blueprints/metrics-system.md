---
name: metrics-system
summary: Self-reporting agent performance tracking with validation
---

# Metrics System

Self-reporting agent performance tracking with objective validation.

## Overview

The metrics system enables agents to track their work progress and outcomes, which are then cross-validated against objective hook results. This creates a feedback loop for continuous improvement in agent performance, calibration accuracy, and success rates.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SessionStart Hook                     │
│         Injects metrics tracking instructions            │
│         (han metrics session-context)                    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
         ┌─────────────────────────────┐
         │   Agent Begins Work         │
         │   Calls start_task() with   │
         │   session_id (required)     │
         └──────────┬──────────────────┘
                    │
                    ↓
         ┌─────────────────────────────┐
         │   Agent Completes Work      │
         │   Calls complete_task()     │
         │   Self-assesses outcome     │
         └──────────┬──────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────┐
│                      Stop Hook                           │
│   1. Run quality validation (tests, lints, types)       │
│   2. Cross-validate with agent self-assessment          │
│   3. Calculate calibration accuracy                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
              ┌────────────────┐
              │ Metrics Database│
              │  (JSONL files)  │
              └────────────────┘
```

### Session Lifecycle

Sessions are long-lived and don't have explicit start/end management. Instead:

- **session_id** is a required parameter when calling `start_task()`
- The session_id comes from Claude Code context and is passed explicitly
- Tasks are grouped by session_id for analysis
- No session-start or session-end hooks for metrics lifecycle

## Components

### 1. MCP Server (hashi-han-metrics)

**Location**: `hashi/hashi-han-metrics/`

**Purpose**: Provides MCP tools for agents to self-report work progress

**Tools**:

- `start_task` - Begin tracking a new task
- `update_task` - Log progress updates
- `complete_task` - Mark task complete with self-assessment
- `fail_task` - Record task failure with details
- `query_metrics` - Query performance analytics

**Storage**: SQLite database at `~/.claude/han/han.db`

**Transport**: STDIO (subprocess)

### 2. SessionStart Hook (hashi-han-metrics)

**Location**: `hashi-han-metrics/hooks/metrics-tracking.md`

**Purpose**: Inject instructions at session start for how to use metrics tracking

**Content**:

- When to track tasks
- How to use MCP tools
- Confidence calibration guidelines
- Example workflows

**Integration**: Defined in `hashi-han-metrics/hooks/hooks.json` SessionStart event

### 3. Stop Hook (hashi-han-metrics)

**Location**: `hashi-han-metrics/hooks/validate-metrics.sh`

**Purpose**: Validate agent self-assessments against objective hook results

**Process**:

1. Query most recent in-progress task
2. Collect hook results (tests, lints, types)
3. Update task record with validation data
4. Calculate calibration accuracy
5. Report mismatches (agent said success, hooks failed)

**Integration**: Defined in `hashi-han-metrics/hooks/hooks.json` Stop event

### 4. Storage Format

**Location**: SQLite database at `~/.claude/han/han.db`

**Tables**: `tasks`, `frustration_events`, `hook_executions`

**Task Record Schema**:

```json
{
  "id": "task-1234567890-abc123",
  "session_id": "session-1234567890-xyz789",
  "description": "Fix authentication bug",
  "type": "fix",
  "estimated_complexity": "moderate",
  "started_at": 1734300000000,
  "completed_at": 1734300180000,
  "status": "completed",
  "outcome": "success",
  "confidence": 0.85,
  "files_modified": ["src/auth.ts"],
  "tests_added": 3,
  "notes": "All tests passing"
}
```

**Hook Execution Record Schema**:

```json
{
  "hook_name": "jutsu-biome_lint",
  "plugin_name": "jutsu-biome",
  "success": true,
  "duration_ms": 1234,
  "timestamp": 1734300000000,
  "session_id": "session-1234567890-xyz789"
}
```

## Workflow

### Agent Perspective

**1. Task Start**

```typescript
// User asks: "Add user authentication"
// session_id comes from Claude Code context
const { task_id } = await start_task({
  description: "Add JWT authentication",
  type: "implementation",
  estimated_complexity: "moderate",
  session_id: "session-1234567890-xyz789"  // Required
});
```

**2. During Work** (optional)

```typescript
await update_task({
  task_id,
  notes: "Implemented token generation, working on validation"
});
```

**3. Task Completion**

```typescript
// Agent assesses outcome
await complete_task({
  task_id,
  outcome: "success",
  confidence: 0.92,  // High confidence
  files_modified: ["src/auth/jwt.ts", "tests/auth.test.ts"],
  tests_added: 12,
  notes: "All tests passing, types clean, rate limiting included"
});
```

### System Perspective

**Stop Hook Validation**:

```bash
# 1. Get agent self-assessment
Agent outcome: "success"
Agent confidence: 0.92

# 2. Run objective validation
jutsu-typescript: ✓ PASS
jutsu-tdd: ✓ PASS (12 new tests)
jutsu-biome: ✓ PASS

# 3. Cross-validate
hooks_passed: true
Agent was correct: ✓

# 4. Update database
UPDATE tasks SET
  hooks_passed = true,
  completed_at = now(),
  duration_seconds = 180
WHERE id = 'task_123';
```

## Metrics Available

### Success Metrics

**Success Rate**:

- Overall success rate
- Success rate by task type (implementation, fix, refactor, research)
- Success rate by complexity (simple, moderate, complex)

**Duration**:

- Average task duration
- Duration by type and complexity
- P50, P90, P99 latencies

### Calibration Metrics

**Core Metric**: Does agent confidence match reality?

```
Calibration Score = |agent_confidence - actual_success| averaged

Perfect calibration = 0.0
Agent says 90% confidence → 90% actually succeed
Agent says 70% confidence → 70% actually succeed
```

**Calibration by Confidence Bucket**:

```
0.90-1.00: Agent says 95% avg → 93% succeed (well-calibrated)
0.80-0.89: Agent says 85% avg → 87% succeed (well-calibrated)
0.70-0.79: Agent says 75% avg → 65% succeed (overconfident)
< 0.70:    Agent says 60% avg → 85% succeed (underconfident)
```

**Accuracy Types**:

- **Correct Success**: Agent said success, hooks confirmed
- **Correct Failure**: Agent said failure, hooks confirmed
- **Overconfident**: Agent said success, hooks failed (false positive)
- **Underconfident**: Agent said failure, hooks passed (false negative)

### Outcome Metrics

**By Outcome**:

- Success count and rate
- Partial success count and rate
- Failure count and rate

**By Task Type**:

- Implementation success rate
- Fix success rate
- Refactor success rate
- Research success rate

## Use Cases

### 1. Agent Performance Tracking

**Question**: Is the agent improving over time?

**Query**:

```sql
SELECT
  DATE(completed_at) as date,
  COUNT(*) as tasks,
  ROUND(100.0 * SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate,
  ROUND(AVG(confidence), 2) as avg_confidence
FROM tasks
WHERE completed_at >= date('now', '-30 days')
GROUP BY DATE(completed_at)
ORDER BY date;
```

**Insight**: Track success rate trends, identify improvement or regression

### 2. Calibration Analysis

**Question**: Is the agent well-calibrated in its confidence?

**Query**:

```sql
SELECT
  CASE
    WHEN confidence >= 0.9 THEN '0.90-1.00'
    WHEN confidence >= 0.8 THEN '0.80-0.89'
    WHEN confidence >= 0.7 THEN '0.70-0.79'
    ELSE '< 0.70'
  END as confidence_bucket,
  COUNT(*) as count,
  ROUND(AVG(confidence), 2) as avg_confidence,
  ROUND(100.0 * SUM(CASE WHEN hooks_passed THEN 1 ELSE 0 END) / COUNT(*), 1) as actual_success
FROM tasks
WHERE outcome IS NOT NULL AND hooks_passed IS NOT NULL
GROUP BY confidence_bucket;
```

**Insight**: Identify overconfidence or underconfidence patterns

### 3. Task Type Performance

**Question**: Which task types are most challenging?

**Query**:

```sql
SELECT
  type,
  COUNT(*) as total,
  ROUND(100.0 * SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate,
  ROUND(AVG(duration_seconds), 0) as avg_duration_sec
FROM tasks
WHERE outcome IS NOT NULL
GROUP BY type
ORDER BY success_rate DESC;
```

**Insight**: Focus improvement efforts on weakest task types

### 4. Failure Analysis

**Question**: Why are tasks failing?

**Query**:

```sql
SELECT
  type,
  failure_reason,
  COUNT(*) as count
FROM tasks
WHERE outcome = 'failure'
GROUP BY type, failure_reason
ORDER BY count DESC
LIMIT 10;
```

**Insight**: Identify common failure patterns, create targeted improvements

## Privacy & Security

**Local-First**:

- All data stored in SQLite at `~/.claude/han/han.db`
- No network calls
- No external tracking

**User-Owned**:

- SQLite database is portable and easily queryable
- Data can be exported, backed up, or deleted
- Full transparency

**Minimal Data**:

- Task descriptions (brief)
- Outcome assessments
- File paths (no content)
- No PII, no user conversations

## Integration Points

### With Hook System

Metrics validation runs as a Stop hook:

- Non-blocking (doesn't prevent Stop)
- Lightweight (SQLite update only)
- Silent (no user-visible output unless miscalibrated)

See: [Hook System](./hook-system.md)

### With Quality Tools

Hook validation leverages existing quality tools:

- jutsu-tdd (test results)
- jutsu-typescript (type checking)
- jutsu-biome (linting)
- Any other configured hooks

Quality gates become calibration signals.

### With MCP Server

hashi-han-metrics exposes tools via MCP:

- Standard STDIO transport
- Follows MCP protocol
- Integrates with Claude Code's MCP system

See: [MCP Server](./mcp-server.md)

## Continuous Improvement

**Feedback Loop**:

```
Agent completes task
       ↓
Self-assesses outcome + confidence
       ↓
Hooks validate objectively
       ↓
Calibration accuracy calculated
       ↓
Patterns identified (overconfident on refactors?)
       ↓
SessionStart instructions adjusted
       ↓
Agent learns from calibration data
       ↓
Performance improves over time
```

**Prompt Adjustments**:

Based on calibration metrics, SessionStart instructions can be dynamically adjusted:

```markdown
## Your Calibration Profile (Last 100 Tasks)

Refactoring tasks: You tend to be 15% overconfident
- When you think 85% confident → actually 70% succeed
- Recommendation: Be more thorough with edge case testing

Fix tasks: You tend to be 10% underconfident
- When you think 70% confident → actually 80% succeed
- Recommendation: Trust your fix validation more

Overall: Well-calibrated (92% accuracy)
```

## Future Enhancements

Potential additions based on usage:

1. **Team Aggregation** (opt-in)
   - Share anonymous metrics across team
   - Benchmark against team averages
   - Identify outlier patterns

2. **Production Validation**
   - Integrate with hashi-sentry
   - Retroactive validation (did the fix actually work in prod?)
   - Long-term outcome tracking

3. **Cost Tracking**
   - Track token usage per task
   - Cost per success
   - ROI analysis

4. **Quality Trend Analysis**
   - Test coverage trends
   - Code quality trends
   - Complexity trends

## Related Blueprints

- [Hook System](./hook-system.md) - How hooks execute and validate
- [MCP Server](./mcp-server.md) - MCP protocol integration
- [SDLC Coverage](./sdlc-coverage.md) - Where metrics fit in the workflow

## References

- hashi-han-metrics plugin: `hashi/hashi-han-metrics/`
- Metrics hooks: `hashi/hashi-han-metrics/hooks/metrics-tracking.md`, `hashi/hashi-han-metrics/hooks/validate-metrics.sh`
- Database schema: `hashi/hashi-han-metrics/server/storage.ts`
