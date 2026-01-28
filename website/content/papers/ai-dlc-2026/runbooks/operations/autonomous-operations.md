# Autonomous Operations

> **Operations Phase** | AI monitors and responds to production systems within defined boundaries

## System Prompt

```markdown

You are executing Autonomous Operations for AI-DLC 2026.

## System Under Management

${SYSTEM_SPECIFICATION}

## Telemetry Sources

${TELEMETRY_CONFIGURATION}

## Runbook Library

${RUNBOOK_PATHS}

## Relevant Principles

- **Bounded autonomy**: You can act within defined limits; escalate beyond them
- **Runbooks are your playbook**: Execute documented procedures autonomously
- **Human for novelty**: Escalate situations not covered by runbooks

## Operating Mode: AHOTL for Operations

You monitor and respond autonomously. Human oversees and handles escalations.

## Autonomous Actions (Pre-Approved)

${AUTONOMOUS_ACTIONS_CONFIG}

Example:

```yaml
autonomous_actions:
  allowed:
    - name: scale_horizontally
      trigger: "cpu > 80% for 5m"
      max_replicas: 10
      cooldown: 10m

    - name: restart_unhealthy
      trigger: "health_check_failures > 3"
      max_restarts: 3
      cooldown: 10m

    - name: rollback_deployment
      trigger: "error_rate > 5% for 10m"
      automatic: true

  requires_human_approval:
    - scale_vertically
    - database_migration
    - security_configuration_change
    - delete_any_resource
    - modify_network_rules
```

## Process

### 1. Monitor

- Ingest telemetry (metrics, logs, traces)
- Detect anomalies against baselines
- Correlate across signals

### 2. Diagnose

When anomaly detected:

- Identify affected components
- Check recent changes (deployments, config)
- Match symptoms to known runbooks

### 3. Respond

If runbook exists and action is pre-approved:

- Execute runbook steps
- Log all actions taken
- Monitor for resolution

If no runbook or action requires approval:

- Document findings
- Output: ESCALATION_REQUIRED
- Wait for human direction

### 4. Report

After resolution:

- Document incident timeline
- Record actions taken
- Note whether runbook was sufficient
- Suggest runbook improvements if needed

## Escalation Triggers

**Always escalate (never act autonomously):**

- Data loss or corruption risk
- Security incidents
- Situations not covered by runbooks
- Actions in requires_human_approval list
- Uncertainty about correct response
- Customer-impacting issues beyond thresholds

## Communication

### Autonomous Action Taken

```
AUTONOMOUS_ACTION_EXECUTED

Action: scale_horizontally
Trigger: cpu > 80% for 5m (observed: 87% for 7m)
Details: Scaled from 3 to 5 replicas
Runbook: runbooks/scaling.md
Status: Monitoring for resolution

No human action required unless escalation follows.
```

### Escalation Required

```
ESCALATION_REQUIRED

Anomaly: Error rate spike to 8%
Affected: /api/checkout endpoint
Recent changes: None in 24h
Symptoms: Database connection timeouts

Runbook match: None (novel symptom combination)

Recommended actions (require approval):
1. Increase database connection pool
2. Enable circuit breaker for checkout
3. Scale database read replicas

Awaiting human direction.
```

## Constraints

- Never exceed autonomous action limits
- Always log actions before executing
- Cooldown periods are mandatory
- Escalate when uncertain
- Never modify security configurations autonomously

```

---

## Entry Criteria

You have:

- **Production system** deployed and running
- **Telemetry configured** (metrics, logs, traces)
- **Runbooks documented** for known scenarios
- **Autonomous action boundaries** defined
- Human available for escalations

## The Activity

### The Operations Loop

```

      ┌─────────────────────────────────────────┐
      │                                         │
      │    ┌──────────┐                        │
      │    │ Monitor  │ ←── Telemetry          │
      │    └────┬─────┘                        │
      │         │                              │
      │         ▼                              │
      │    ┌──────────┐                        │
      │    │ Detect   │ ←── Anomaly?           │
      │    └────┬─────┘                        │
      │         │                              │
      │    No   │   Yes                        │
      │    ┌────┴────┐                         │
      │    │         ▼                         │
      │    │    ┌──────────┐                   │
      │    │    │ Diagnose │                   │
      │    │    └────┬─────┘                   │
      │    │         │                         │
      │    │         ▼                         │
      │    │    ┌──────────┐                   │
      │    │    │ Runbook? │                   │
      │    │    └────┬─────┘                   │
      │    │         │                         │
      │    │    Yes  │   No                    │
      │    │    ┌────┴────┐                    │
      │    │    │         ▼                    │
      │    │    │    ┌──────────┐              │
      │    │    │    │ Escalate │ → Human      │
      │    │    │    └──────────┘              │
      │    │    ▼                              │
      │    │ ┌──────────┐                      │
      │    │ │ Execute  │                      │
      │    │ └────┬─────┘                      │
      │    │      │                            │
      │    │      ▼                            │
      │    │ ┌──────────┐                      │
      │    │ │ Resolved?│                      │
      │    │ └────┬─────┘                      │
      │    │      │                            │
      │    │ No   │   Yes                      │
      │    │ ┌────┴────┐                       │
      │    │ │         ▼                       │
      │    │ │    ┌──────────┐                 │
      │    │ │    │  Report  │                 │
      │    │ │    └──────────┘                 │
      │    │ │         │                       │
      │    └─┴─────────┴───────────────────────┘
      │                                         │
      └─────────────────────────────────────────┘

```

### Autonomous Action Boundaries

Define what AI can do without asking:

```yaml
# Safe autonomous actions
allowed:
  # Scaling
  - name: scale_horizontally
    trigger: "cpu > 80% for 5m"
    action: "increase replicas"
    limits:
      max_replicas: 10
      cooldown: 10m

  # Self-healing
  - name: restart_unhealthy_pod
    trigger: "health_check_failures > 3"
    action: "restart pod"
    limits:
      max_restarts: 3
      cooldown: 10m

  # Automatic rollback
  - name: rollback_on_error_spike
    trigger: "error_rate > 5% for 10m AND recent_deployment"
    action: "rollback to previous version"
    limits:
      automatic: true

  # Cache management
  - name: clear_cache
    trigger: "cache_hit_rate < 50% for 15m"
    action: "invalidate cache"
    limits:
      cooldown: 30m

# Always require human approval
requires_human_approval:
  - scale_vertically          # Cost implications
  - database_migration        # Data risk
  - security_config_change    # Security risk
  - delete_any_resource       # Irreversible
  - modify_network_rules      # Connectivity risk
  - access_production_data    # Privacy risk
```

### Runbook Execution

When symptoms match a runbook:

```markdown

## Runbook: High Memory Usage

### Symptoms

- Memory usage > 85% for 10+ minutes
- No recent deployments
- Gradual increase pattern

### Diagnosis Steps

1. Check for memory leaks: `kubectl top pods`
2. Review recent traffic patterns
3. Check for connection pool exhaustion

### Remediation (Autonomous)

1. Restart highest-memory pod
2. Wait 5 minutes
3. If memory still high, scale horizontally

### Remediation (Requires Human)

If restarts don't help:

- May need heap dump analysis
- May need code fix for memory leak
- Escalate to engineering

### Success Criteria

- Memory usage < 75%
- No increase in error rate
- Application responsive

```

### Incident Documentation

```markdown

## Incident Report

### Summary

High CPU triggered automatic horizontal scaling

### Timeline

- 14:23 UTC: CPU alert triggered (87% for 5m)
- 14:23 UTC: Autonomous action: scale from 3 to 5 replicas
- 14:25 UTC: CPU decreased to 62%
- 14:30 UTC: Stable at 58%
- 14:35 UTC: Incident closed

### Actions Taken

1. Executed runbook: horizontal-scaling
2. Scaled replicas: 3 → 5
3. Monitored for 10 minutes

### Root Cause

Traffic spike from marketing campaign (expected)

### Recommendations

- Consider pre-scaling for known campaigns
- Update runbook with campaign awareness

### Runbook Effectiveness

✅ Runbook sufficient for this incident

```

## Exit Criteria

This is a continuous activity. "Exit" means:

- **Incident resolved** and documented
- **Runbooks updated** based on learnings
- **System stable** within normal parameters

## Common Failure Modes

### 1. Over-Automation

**Symptom:** AI takes destructive actions without human check.
**Impact:** Data loss, extended outages.
**Fix:** Strict boundaries. Dangerous actions always require approval.

### 2. Alert Fatigue

**Symptom:** Too many alerts, human ignores them.
**Impact:** Real issues missed.
**Fix:** Tune thresholds. AI handles routine; human sees only escalations.

### 3. Runbook Gaps

**Symptom:** Novel incidents with no playbook.
**Impact:** Slow response, repeated escalations.
**Fix:** After each novel incident, create or update runbook.

### 4. Missing Context

**Symptom:** AI acts without understanding recent changes.
**Impact:** Wrong diagnosis, wrong action.
**Fix:** Include recent deployments, config changes in diagnostic context.

### 5. Cooldown Violations

**Symptom:** Same action repeated rapidly.
**Impact:** Thrashing, instability.
**Fix:** Enforce cooldown periods. Log violations.

### 6. Silent Escalation

**Symptom:** AI escalates but human doesn't notice.
**Impact:** Delayed response to critical issues.
**Fix:** Escalations must page. Human acknowledgment required.
