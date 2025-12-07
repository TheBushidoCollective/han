---
name: runbooks-incident-response
description: Use when creating incident response procedures and on-call playbooks. Covers incident management, communication protocols, and post-mortem documentation.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Runbooks - Incident Response

Creating effective incident response procedures for handling production incidents and on-call scenarios.

## Incident Response Framework

### Incident Severity Levels

**SEV-1 (Critical)**

- Complete service outage
- Data loss or security breach
- Major customer impact (>50% of users)
- **Response Time:** Immediate
- **Escalation:** Page on-call + manager

**SEV-2 (High)**

- Partial service degradation
- Affecting significant users (10-50%)
- Performance issues (>50% slower)
- **Response Time:** Within 15 minutes
- **Escalation:** Page on-call

**SEV-3 (Medium)**

- Minor degradation
- Affecting few users (<10%)
- Non-critical features broken
- **Response Time:** Within 1 hour
- **Escalation:** On-call handles during business hours

**SEV-4 (Low)**

- Cosmetic issues
- Internal tools affected
- No customer impact
- **Response Time:** Next business day
- **Escalation:** Create ticket, no page

## Incident Response Template

```markdown
# Incident Response: [Alert/Issue Name]

**Severity:** SEV-1/SEV-2/SEV-3/SEV-4
**Response Time:** Immediate / 15 min / 1 hour / Next day
**Owner:** On-call Engineer

## Incident Detection

**This runbook is triggered by:**
- PagerDuty alert: `api_error_rate_high`
- Customer report in #support
- Monitoring dashboard showing anomaly

## Initial Response (First 5 Minutes)

### 1. Acknowledge & Assess

```bash
# Check current status
curl https://api.example.com/health
kubectl get pods -n production
```

**Determine severity:**

- All requests failing → SEV-1
- Partial failures → SEV-2
- Performance degraded → SEV-3

### 2. Notify Stakeholders

**SEV-1:**

- Create Slack incident channel: `/incident create SEV-1 API Outage`
- Page engineering manager
- Notify customer success team

**SEV-2:**

- Post in #incidents channel
- Tag on-call team

**SEV-3:**

- Post in #engineering channel
- No pages needed

### 3. Start Incident Timeline

Create incident doc (copy template):

```
Incident: API Outage
Started: 2025-01-15 14:30 UTC
Severity: SEV-1

Timeline:
14:30 - Alert fired
14:31 - On-call acknowledged
14:32 - Assessed as SEV-1
14:33 - Created incident channel
```

## Immediate Mitigation (First 15 Minutes)

**Goal:** Stop the bleeding, restore service

### Quick Mitigation Options

**Option A: Rollback Recent Deploy**

```bash
# Check recent deploys
kubectl rollout history deployment/api-server

# Rollback if deployed < 30 min ago
kubectl rollout undo deployment/api-server
```

**When to use:** Deploy coincides with incident start.

**Option B: Scale Up**

```bash
# Increase replicas
kubectl scale deployment/api-server --replicas=20
```

**When to use:** High traffic, resource exhaustion.

**Option C: Restart Services**

```bash
# Restart pods
kubectl rollout restart deployment/api-server
```

**When to use:** Memory leak, connection pool issues.

**Option D: Enable Circuit Breaker**

```bash
# Disable failing external service calls
kubectl set env deployment/api-server FEATURE_EXTERNAL_API=false
```

**When to use:** Third-party service degraded.

## Communication Protocol

### Update Frequency

**SEV-1:** Every 10 minutes
**SEV-2:** Every 30 minutes
**SEV-3:** Hourly

### Communication Template

```markdown
**[14:45] UPDATE**

**Status:** Investigating
**Impact:** API returning 503 errors. ~75% of requests failing.
**Actions Taken:**
- Rolled back deploy from 14:25
- Increased pod replicas to 15
**Next Steps:**
- Monitoring rollback impact
- Investigating database connection issues
**ETA:** Unknown

**Customer Impact:** Users cannot place orders.
**Workaround:** None available.
```

### Status Updates

```markdown
## Status Messages

**Investigating:**
> We are aware of elevated error rates on the API.
> Investigating the root cause. Updates every 10 minutes.

**Identified:**
> Root cause identified: database connection pool exhausted.
> Implementing fix now.

**Monitoring:**
> Fix deployed. Error rate dropping.
> Monitoring for 30 minutes before declaring resolved.

**Resolved:**
> Incident resolved. Error rate back to baseline.
> Post-mortem to follow.
```

## Investigation (Concurrent with Mitigation)

While service is recovering, investigate root cause:

### 1. Gather Evidence

```bash
# Capture logs before they rotate
kubectl logs deployment/api-server > incident-logs.txt

# Snapshot metrics
curl -H "Authorization: Bearer $DD_API_KEY" \
  "https://api.datadoghq.com/api/v1/graph/snapshot?..." > metrics.png

# Database state
psql -c "SELECT * FROM pg_stat_activity" > db-state.txt
```

### 2. Timeline Reconstruction

```markdown
## Timeline

| Time | Event | Evidence |
|------|-------|----------|
| 14:20 | Deploy started | GitHub Actions log |
| 14:25 | Deploy completed | ArgoCD |
| 14:30 | Error rate spike | Datadog alert |
| 14:32 | Database connections maxed | CloudWatch |
| 14:35 | Rollback initiated | kubectl history |
| 14:38 | Service recovered | Datadog metrics |
```

### 3. Root Cause Analysis

```markdown
## Root Cause

**Immediate Cause:**
Deploy introduced N+1 query pattern in user endpoint.

**Contributing Factors:**
- Missing database index on users.created_at
- No query performance testing in CI
- Database connection pool too small for traffic spike

**Why It Wasn't Caught:**
- Staging has 10x less traffic than production
- Load testing doesn't cover this endpoint
- No alerting on query performance
```

## Resolution & Validation

### Declare Incident Resolved

**Criteria (ALL must be met):**

- [ ] Error rate < 1% for 30 minutes
- [ ] Response time p95 < 200ms
- [ ] No customer complaints in 15 minutes
- [ ] Root cause fix deployed (not just mitigation)
- [ ] Monitoring confirms stable

### Post-Incident Actions

```markdown
## Immediate (Within 1 hour)

- [ ] Post resolution update to #incidents
- [ ] Update status page to "operational"
- [ ] Thank responders
- [ ] Close PagerDuty incident

## Short-term (Within 24 hours)

- [ ] Create post-mortem ticket
- [ ] Schedule post-mortem meeting
- [ ] Extract action items
- [ ] Update runbook with learnings

## Long-term (Within 1 week)

- [ ] Complete action items from post-mortem
- [ ] Add monitoring/alerting to prevent recurrence
- [ ] Document in incident database
```

## Post-Mortem Template

```markdown
# Post-Mortem: API Outage - 2025-01-15

**Date:** 2025-01-15
**Duration:** 14:30 UTC - 14:45 UTC (15 minutes)
**Severity:** SEV-1
**Impact:** 75% of API requests failing
**Authors:** On-call engineer, Team lead

## Summary

On January 15th at 14:30 UTC, our API experienced a complete outage affecting
75% of requests. The incident lasted 15 minutes and was caused by a database
connection pool exhaustion triggered by an N+1 query in a recent deploy.

## Impact

**Customer Impact:**
- ~1,500 users unable to complete purchases
- Estimated revenue loss: $50,000
- 47 support tickets filed

**Internal Impact:**
- 3 engineers pulled from other work
- 15 minutes of complete outage
- Engineering manager paged

## Timeline (All times UTC)

**14:20** - Deploy #1234 merged and started deployment
**14:25** - Deploy completed, new code serving traffic
**14:30** - Alert fired: `api_error_rate_high`
**14:31** - On-call engineer acknowledged
**14:32** - Assessed as SEV-1, created incident channel
**14:33** - Identified database connection pool exhausted
**14:35** - Initiated rollback to previous version
**14:38** - Rollback complete, error rate dropping
**14:40** - Service stabilized, monitoring
**14:45** - Declared resolved

## Root Cause

The deploy introduced an N+1 query in the `/users/recent` endpoint. For each
user returned, the code made an additional database query to fetch their
profile picture URL. With 50 concurrent requests, this resulted in 50 × 20 =
1,000 database queries, exhausting the connection pool (configured for 100
connections).

**Code change:**
```diff
- user.profile_picture_url  # Preloaded in query
+ user.get_profile_picture()  # Additional query per user
```

## Contributing Factors

1. **Missing Index:** `users.created_at` not indexed, making base query slow
2. **Small Connection Pool:** 100 connections insufficient for traffic spike
3. **No Query Monitoring:** No alerts on query count or duration
4. **Insufficient Load Testing:** Staging has 10% of production traffic

## What Went Well

- ✅ Fast detection (< 1 minute from start)
- ✅ Clear escalation path
- ✅ Rollback worked smoothly
- ✅ Good communication to stakeholders
- ✅ Service fully recovered in 15 minutes

## What Went Wrong

- ❌ Code review didn't catch N+1 query
- ❌ No automated query performance testing
- ❌ Alert fired but root cause took 5 minutes to identify
- ❌ No automatic rollback on error spike

## Action Items

| Action | Owner | Deadline | Priority |
|--------|-------|----------|----------|
| Add database index on users.created_at | Alice | 2025-01-16 | P0 |
| Increase connection pool to 200 | Bob | 2025-01-16 | P0 |
| Add query performance test to CI | Charlie | 2025-01-20 | P1 |
| Implement automatic rollback on error spike | Dave | 2025-01-30 | P1 |
| Create ORM query linter to detect N+1 | Eve | 2025-02-15 | P2 |

## Lessons Learned

1. **Prevention:** Need automated N+1 query detection in code review
2. **Detection:** Should alert on database query count, not just errors
3. **Mitigation:** Automatic rollback could reduce MTTR by 5+ minutes
4. **Recovery:** Rollback was effective, keep this as primary strategy

## Appendix

- [Incident Timeline Doc](link)
- [Datadog Metrics](link)
- [Database Logs](link)
- [Deploy PR #1234](link)

```

## On-Call Playbook

```markdown
# On-Call Playbook

## Before Your On-Call Shift

**1 week before:**
- [ ] Review recent incidents
- [ ] Update on-call runbooks if needed
- [ ] Test PagerDuty notifications

**1 day before:**
- [ ] Verify laptop ready (charged, VPN working)
- [ ] Test access to all systems
- [ ] Review current system status
- [ ] Check calendar for conflicting events

## During Your Shift

### When You Get Paged

**Within 1 minute:**
1. Acknowledge alert in PagerDuty
2. Check alert details for severity
3. Open relevant runbook

**Within 5 minutes:**
4. Assess severity (is it really SEV-1?)
5. Create incident channel if SEV-1/SEV-2
6. Post initial status update

### Escalation Decision Tree

```

                Get paged
                    |
          Can I handle this alone?
                /       \
              Yes        No
               |          |
          Work it    Escalate
               |          |
          Fixed?     Loop in team
          /   \           |
        Yes   No     Work together
         |     |          |
      Close  Need     Fixed?
             help       |
               \       Yes
                \       |
                 \    Close
                  \    |
                 Escalate

```

### Handoff Procedure

**End of shift checklist:**
- [ ] No active incidents
- [ ] Status doc updated
- [ ] Next on-call acknowledged handoff
- [ ] Brief next on-call on any ongoing issues

**Handoff template:**
```

Hey @next-oncall! Handing off on-call. Here's the status:

**Active Issues:** None

**Watch Items:**

- Database CPU elevated but stable (85%)
- Deploy planned for tomorrow 10 AM

**Recent Incidents:**

- SEV-2 yesterday: Database slow queries (resolved)
  Post-mortem: [link]

**System Status:**

- All services green
- No upcoming maintenance

Let me know if you have questions!

```

## After Your Shift

- [ ] Update runbooks with any new learnings
- [ ] Complete post-mortems for incidents
- [ ] File bug tickets for issues found
- [ ] Share feedback on alerting/runbooks
```

## Anti-Patterns

### Don't Panic

```markdown
# Bad: Reactive chaos
EVERYTHING IS DOWN! RESTART ALL THE THINGS!

# Good: Calm assessment
Service is degraded. Let me check:
1. What's the actual impact?
2. When did it start?
3. What's the quickest safe mitigation?
```

### Don't Skip Communication

```markdown
# Bad: Silent fixing
*Fixes issue without telling anyone*
*Marks incident as resolved*

# Good: Regular updates
[14:30] Investigating API errors
[14:40] Root cause identified, deploying fix
[14:45] Fix deployed, monitoring
[15:00] Service stable, incident resolved
```

### Don't Skip Post-Mortems

```markdown
# Bad: Move on quickly
Fixed it! Moving on to next task.

# Good: Learn from incidents
- Document what happened
- Identify action items
- Prevent recurrence
- Share learnings with team
```

## Related Skills

- **runbook-structure**: Organizing incident response procedures
- **troubleshooting-guides**: Diagnosing issues during incidents
