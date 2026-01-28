# Deployment

> **Operations Phase** | Ship verified code safely to production

## System Prompt

```markdown

You are executing Deployment for AI-DLC 2026.

## Deployment Unit

${DEPLOYMENT_UNIT_SPECIFICATION}

## Artifacts to Deploy

${ARTIFACT_LIST}

## Environment Target

${TARGET_ENVIRONMENT}

## Relevant Principles

- **Verified code ships**: All quality gates passed in Construction
- **Reversibility**: Every deployment must be rollback-capable
- **Human approves production**: HITL for production promotion

## Process

### 1. Package

- Build deployment artifacts (containers, functions, IaC)
- Tag with version/commit SHA
- Push to artifact registry

### 2. Deploy to Staging

- Apply to staging environment
- Run smoke tests
- Run integration tests against staging
- Output: STAGING_READY or STAGING_FAILED

### 3. Validate Staging

Present validation results:

- Functional tests: pass/fail
- Performance benchmarks: vs baseline
- Security scan: findings
- **STOP**: Wait for human review

### 4. Production Promotion

After human approval:

- Deploy using configured strategy (canary, blue-green, rolling)
- Monitor deployment metrics
- Output: PRODUCTION_DEPLOYED or ROLLBACK_TRIGGERED

### 5. Post-Deployment Validation

- Run production smoke tests
- Verify key metrics within thresholds
- Output: DEPLOYMENT_COMPLETE or ISSUE_DETECTED

## Deployment Strategies

### Canary (Default for critical services)

```yaml
strategy: canary
stages:
  - weight: 5%
    duration: 10m
    gates: [error_rate < 1%, latency_p99 < baseline * 1.1]
  - weight: 25%
    duration: 15m
    gates: [error_rate < 1%, latency_p99 < baseline * 1.1]
  - weight: 100%
```

### Blue-Green (For stateless services)

```yaml
strategy: blue-green
validation_period: 15m
rollback_trigger: error_rate > 2%
```

### Rolling (For stateful services)

```yaml
strategy: rolling
max_unavailable: 25%
max_surge: 25%
```

## Rollback Triggers

Automatic rollback if:

- Error rate > ${ERROR_THRESHOLD}%
- Latency p99 > ${LATENCY_THRESHOLD}ms
- Health checks fail for > ${HEALTH_TIMEOUT}
- Deployment timeout exceeded

## Human Checkpoints

**STOP and wait for approval:**

- Before production promotion
- After rollback (explain what happened)
- When metrics are ambiguous (not clearly good or bad)

## Constraints

- Never skip staging validation
- Never force-push to production without approval
- Always have rollback ready before deploying
- Never deploy during blackout windows: ${BLACKOUT_WINDOWS}

```

---

## Entry Criteria

You have:

- **Verified code** from Construction (all quality gates passed)
- **Deployment artifacts** (containers, IaC, configs)
- **Target environment** configured
- **Rollback plan** ready
- Human available for production approval

## The Activity

### Deployment Pipeline

```

Construction Complete
         ↓
    Build Artifacts
         ↓
    Push to Registry
         ↓
    Deploy to Staging ←←← Automated
         ↓
    Validate Staging
         ↓
    CHECKPOINT: Human Reviews ←←← Human Required
         ↓
    Deploy to Production ←←← Human Approved
         ↓
    Monitor & Validate
         ↓
    COMPLETE or ROLLBACK

```

### Staging Validation

```markdown

## Staging Validation Report

### Functional Tests

- API tests: 147/147 passed
- Integration tests: 23/23 passed
- E2E tests: 12/12 passed

### Performance

| Metric | Baseline | Current | Status |
|--------|----------|---------|--------|
| Latency p50 | 45ms | 43ms | ✅ |
| Latency p99 | 180ms | 175ms | ✅ |
| Throughput | 1200 req/s | 1250 req/s | ✅ |

### Security

- Vulnerability scan: 0 critical, 0 high, 2 medium (existing)
- Dependency audit: No new vulnerabilities

### Recommendation

✅ Ready for production promotion

```

### Production Promotion

```markdown

## Production Deployment Plan

### Strategy: Canary

### Stages

1. 5% traffic for 10 minutes
   - Monitor: error_rate, latency_p99, business_metrics
   - Auto-rollback if: error_rate > 1%

2. 25% traffic for 15 minutes
   - Monitor: same metrics
   - Auto-rollback if: error_rate > 1%

3. 100% traffic
   - Continue monitoring for 30 minutes
   - Mark stable after validation period

### Rollback Plan

- One-click rollback to previous version
- Estimated rollback time: < 2 minutes
- Data migration: None (backward compatible)

**Awaiting approval to proceed.**

```

### Post-Deployment Monitoring

```markdown

## Post-Deployment Report

### Deployment Status: ✅ COMPLETE

### Metrics (30 minutes post-deploy)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Error rate | 0.12% | 0.11% | -8% |
| Latency p99 | 180ms | 175ms | -3% |
| CPU usage | 45% | 43% | -4% |

### Alerts

- None triggered

### Recommendation

Deployment successful. Marking as stable.

```

## Exit Criteria

- Deployment **completed successfully** in target environment
- **Monitoring confirms** healthy metrics
- **Rollback plan** validated and ready
- **Documentation updated** (runbooks, architecture)

OR

- **Rollback executed** due to issues
- **Incident documented** for post-mortem
- **Root cause** identified for retry

## Handoff Artifacts

| Artifact | Purpose |
|----------|---------|
| Deployment record | Audit trail |
| Validation reports | Evidence of testing |
| Monitoring dashboards | Ongoing observability |
| Runbooks | Operational procedures |

## Common Failure Modes

### 1. Skipping Staging

**Symptom:** Direct to production because "it's a small change."
**Impact:** Production incidents from untested changes.
**Fix:** All changes go through staging. No exceptions.

### 2. No Rollback Plan

**Symptom:** Deployment fails, no quick recovery.
**Impact:** Extended outage, data loss risk.
**Fix:** Rollback plan is a deployment prerequisite.

### 3. Insufficient Monitoring

**Symptom:** Issues discovered by users, not metrics.
**Impact:** Slow detection, poor user experience.
**Fix:** Define monitoring requirements in completion criteria.

### 4. Over-Automation

**Symptom:** Auto-deploy to production without human review.
**Impact:** Bad changes reach production unchecked.
**Fix:** Human approval for production promotion. Always.

### 5. Blackout Window Violations

**Symptom:** Deploying during peak hours or freeze periods.
**Impact:** Amplified blast radius, policy violations.
**Fix:** Enforce blackout windows in deployment tooling.
