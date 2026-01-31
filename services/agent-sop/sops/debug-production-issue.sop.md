# Debug Production Issue Systematically

## Overview

This SOP provides a systematic approach to debugging production issues with focus on data gathering, hypothesis testing, and root cause analysis. Use this when investigating unexpected behavior, errors, or performance degradation in production. This structured approach minimizes downtime and prevents incomplete fixes.

## Parameters

- **Issue Description**: {issue_description} - Reported problem and symptoms
- **Severity Level**: {severity} - Impact level (critical, high, medium, low)
- **Affected Systems**: {systems} - Components or services experiencing issues
- **Time Window**: {time_window} - When issue started or occurs (optional)
- **Reproduction Steps**: {repro_steps} - Steps to reproduce issue (if known)

## Prerequisites

### Required Tools

- Access to production logs and monitoring systems
- Debugging tools for relevant language/framework
- Access to application performance monitoring (APM)
- Version control system access
- Database query tools (if applicable)

### Required Knowledge

- Understanding of system architecture
- Familiarity with monitoring and logging systems
- Knowledge of debugging techniques
- Understanding of the affected codebase

### Required Setup

- Production credentials configured (read-only preferred)
- Log aggregation access established
- Monitoring dashboards accessible
- Incident communication channel ready

## Steps

1. Gather initial information
   - You MUST document {issue_description} precisely
   - You MUST determine {severity} level to prioritize response
   - You MUST identify {systems} affected by the issue
   - You SHOULD determine {time_window} when issue started
   - You SHOULD collect {repro_steps} if available
   - Identify recent deployments or changes
   - **Validation**: Have complete incident context documented

2. Reproduce the issue (if possible)
   - You SHOULD attempt to reproduce in non-production environment first
   - Follow {repro_steps} exactly if provided
   - You MUST NOT attempt reproduction in production if risky
   - Document exact conditions that trigger the issue
   - Note any variations in behavior
   - **Validation**: Can consistently reproduce issue in safe environment

3. Examine logs and error messages
   - You MUST review application logs for the {time_window}
   - Search for error messages, stack traces, and warnings
   - You SHOULD correlate errors across {systems}
   - Look for patterns in timing or frequency
   - Check for resource exhaustion indicators
   - You MUST NOT ignore warning messages
   - **Validation**: Error messages and patterns documented

4. Review monitoring and metrics
   - You MUST check system resource utilization (CPU, memory, disk, network)
   - Review application performance metrics (latency, throughput, error rate)
   - You SHOULD compare metrics to baseline/normal behavior
   - Look for anomalies starting around {time_window}
   - Check database query performance if applicable
   - Review cache hit rates and external service calls
   - **Validation**: Metrics anomalies identified and documented

5. Analyze recent changes
   - You MUST review deployments within {time_window}
   - Check code changes for relevant {systems}
   - You SHOULD review configuration changes
   - Look for dependency updates or infrastructure changes
   - Check for data migrations or schema changes
   - Review feature flag changes
   - **Validation**: All recent changes catalogued

6. Form and test hypotheses
   - You MUST develop specific, testable hypotheses
   - Prioritize hypotheses by likelihood and impact
   - You SHOULD test one hypothesis at a time
   - Use scientific method: predict outcome, test, observe
   - You MUST document results of each test
   - You MAY use binary search to narrow down issues
   - **Validation**: Each hypothesis tested and results recorded

7. Identify root cause
   - You MUST distinguish symptoms from root cause
   - You SHOULD use "5 Whys" technique to dig deeper
   - Verify root cause explains ALL observed symptoms
   - You MUST NOT settle for surface-level explanations
   - Consider if multiple contributing factors exist
   - **Validation**: Can explain all symptoms with root cause

8. Develop and validate fix
   - You MUST design fix addressing root cause, not symptoms
   - You SHOULD implement fix in non-production first
   - Test fix thoroughly before production deployment
   - You MUST verify fix doesn't introduce new issues
   - You SHOULD add tests to prevent regression
   - Document the fix and rationale
   - **Validation**: Fix resolves issue in test environment

9. Deploy fix and verify resolution
   - You MUST have rollback plan ready before deployment
   - Deploy fix following standard deployment procedures
   - You MUST monitor {systems} closely after deployment
   - Verify issue symptoms are resolved
   - Check that metrics return to normal
   - Monitor for 30+ minutes to ensure stability
   - **Validation**: Issue resolved, no new errors, metrics normal

10. Document and learn
    - You MUST document root cause and resolution
    - You SHOULD create post-mortem for {severity} critical/high
    - Add monitoring/alerting to detect similar issues early
    - You SHOULD add tests to prevent regression
    - Share learnings with team
    - Update runbooks or documentation
    - **Validation**: Incident documented, preventive measures in place

## Success Criteria

- [ ] Issue is fully reproduced and understood
- [ ] Root cause is identified and validated
- [ ] Fix is implemented and tested
- [ ] Issue is resolved in production
- [ ] No new issues introduced by the fix
- [ ] Metrics return to normal baseline
- [ ] Incident is documented with root cause analysis
- [ ] Preventive measures are implemented
- [ ] Team is informed of resolution and learnings

## Error Handling

### Error: Cannot Reproduce Issue

**Symptoms**: Issue reported but cannot be reproduced in any environment

**Cause**: Environmental differences, insufficient reproduction steps, or intermittent issue

**Resolution**:

1. You MUST gather more detailed reproduction steps from reporter
2. Check for environment-specific configuration differences
3. Review production data for unique conditions
4. Look for timing-dependent or race condition issues
5. You MAY need to debug directly in production (with caution)
6. Consider adding more detailed logging if issue persists

### Error: Multiple Possible Root Causes

**Symptoms**: Several equally plausible explanations for the issue

**Cause**: Complex interaction between components, insufficient data, or multiple concurrent issues

**Resolution**:

1. You SHOULD isolate and test each potential cause separately
2. Look for evidence that supports or refutes each hypothesis
3. Check if issues are related or independent
4. You MAY need to add instrumentation for better visibility
5. Prioritize fixing the most likely or highest impact cause first

### Error: Fix Doesn't Resolve Issue

**Symptoms**: Issue persists after deploying supposed fix

**Cause**: Incorrect root cause diagnosis, incomplete fix, or new related issue

**Resolution**:

1. You MUST rollback the fix if it introduces new problems
2. Return to hypothesis testing phase
3. Re-examine assumptions about root cause
4. Look for additional contributing factors
5. You SHOULD NOT deploy additional changes without clear understanding

### Error: Issue Intermittent or Hard to Diagnose

**Symptoms**: Issue appears and disappears without clear pattern

**Cause**: Race conditions, timing issues, resource exhaustion, or external dependencies

**Resolution**:

1. You MUST add detailed logging around suspected code paths
2. Use APM tools to capture traces when issue occurs
3. Look for correlation with external events (traffic spikes, scheduled jobs)
4. You SHOULD add metrics to track the issue frequency
5. Consider load testing to trigger issue consistently
6. Review concurrency and thread safety in affected code

### Error: Production Access Restricted

**Symptoms**: Cannot access production logs, metrics, or systems needed for debugging

**Cause**: Security policies, insufficient permissions, or access procedures

**Resolution**:

1. You MUST follow proper access request procedures
2. Work with operations team to obtain necessary data
3. Use available debugging proxies or sanitized data
4. You MUST NOT bypass security controls
5. Document access needs for future incidents

## Related SOPs

- **code-review-quality**: Use after fix is implemented to review changes
- **implement-feature-tdd**: Reference for adding regression tests
- **refactor-for-maintainability**: Use if root cause reveals technical debt
- **api-design-review**: Use if issue exposes API design problems
