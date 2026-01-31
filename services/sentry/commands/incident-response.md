---
description: Manage incident response workflow with Sentry alerts and issue tracking
---

# Incident Response

## Name

hashi-sentry:incident-response - Manage incident response workflow with Sentry alerts and issue tracking

## Synopsis

```
/incident-response [arguments]
```

## Description

Coordinate incident response using Sentry's monitoring and alerting capabilities to quickly identify, triage, and resolve production issues.

## Implementation

This command provides a structured workflow for responding to production incidents detected by Sentry.

## Usage

```
/incident-response [incident-type]
```

## What This Command Does

1. Detects active incidents from Sentry alerts
2. Provides incident overview with:
   - Affected services and users
   - Error rates and trends
   - Recent deployments that may correlate
3. Guides through incident response workflow:
   - Assess severity and impact
   - Identify root cause using Seer AI
   - Create action items
   - Track resolution progress
4. Updates issue status and assigns teams
5. Coordinates communication about incident status
6. Performs post-incident analysis

## Prerequisites

- Sentry MCP server must be installed and configured
- OAuth authentication with Sentry must be completed
- Alert rules configured in Sentry
- Access to relevant Sentry projects

## Example Interaction

```
User: /incident-response

Claude: Checking Sentry for active incidents...

## Active Incidents Detected: 2

### Incident #1: High Error Rate in Payment Service
- **Severity**: Critical
- **Status**: Ongoing (Started 23 minutes ago)
- **Affected Service**: payment-processor (production)
- **Impact**:
  - Error rate: 45% (normal: 0.2%)
  - Affected users: ~2,300
  - Failed transactions: 1,247

**Primary Issue:**
TypeError: Cannot read property 'amount' of null
- Events: 1,247 (spiking)
- First seen: 23m ago
- Correlated with: v3.2.1 deployment (25m ago)

**Recommended Actions:**
1. Rollback to v3.2.0 immediately
2. Investigate null handling in payment amount processing
3. Enable feature flag to bypass new code path

Would you like me to help with rollback or investigation?

---

### Incident #2: Database Connection Pool Exhaustion
- **Severity**: High
- **Status**: Ongoing (Started 1 hour ago)
- **Affected Service**: api-backend (production)
- **Impact**:
  - Slow response time: P95 4,200ms (normal: 800ms)
  - Affected users: ~890
  - Timeout errors: 234

**Primary Issue:**
Error: Connection pool timeout after 30000ms
- Events: 234 (steady)
- Pattern: Gradual increase over 2 hours
- Possible cause: Connection leak in database queries

**Recommended Actions:**
1. Restart connection pool (temporary fix)
2. Audit for unclosed database connections
3. Increase pool size as immediate mitigation
4. Review recent database query changes

---

## Incident Response Workflow

For Incident #1 (Critical), I recommend:

**Phase 1: Immediate Mitigation (Now)**
1. Execute rollback to v3.2.0
2. Verify error rate returns to normal
3. Enable monitoring for rollback confirmation

**Phase 2: Investigation (Next 30 minutes)**
1. Use Seer AI to analyze root cause in v3.2.1
2. Review code changes affecting payment processing
3. Identify the null value source

**Phase 3: Fix & Deploy (Next 2-4 hours)**
1. Implement null check before amount access
2. Add unit tests for null payment scenarios
3. Deploy fix with gradual rollout
4. Monitor error rates during deployment

**Phase 4: Post-Incident (After resolution)**
1. Document root cause and fix
2. Update runbooks with this incident
3. Add alerts for similar patterns
4. Review deployment checklist

Which incident would you like to focus on first?
```

## Incident Response Actions

This command can help with:

1. **Assess Impact**
   - Count affected users
   - Calculate error rates
   - Identify affected features

2. **Find Root Cause**
   - Correlate with recent deployments
   - Use Seer AI for automated analysis
   - Review related code changes
   - Check infrastructure metrics

3. **Mitigate**
   - Guide rollback decisions
   - Suggest feature flag strategies
   - Recommend traffic shifting

4. **Communicate**
   - Draft status updates
   - Identify stakeholders to notify
   - Track incident timeline

5. **Resolve**
   - Verify fix effectiveness
   - Monitor error rate recovery
   - Update issue status

6. **Learn**
   - Generate post-mortem outline
   - Identify preventive measures
   - Document lessons learned

## Arguments

- `incident-type` (optional): error-spike, performance-degradation, outage

## Tips

- Set up Sentry alert rules for proactive detection
- Integrate with PagerDuty or Slack for notifications
- Use Seer AI for faster root cause analysis
- Document incident response procedures in runbooks
- Tag incidents for pattern analysis
- Review incidents regularly for prevention opportunities

## Related Commands

- `/investigate-errors`: Deep dive into specific errors
- `/check-releases`: Verify release correlation
- `/analyze-performance`: Check performance impact
- `/query-events`: Custom investigation queries
