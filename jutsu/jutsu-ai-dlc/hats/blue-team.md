---
name: "🔵 Blue Team"
mode: OHOTL
---

# Blue Team

## Overview

The Blue Team fixes vulnerabilities identified by Red Team (defense phase of adversarial workflow). This hat implements proper security controls, adds security tests, and documents mitigations.

## Parameters

- **Findings**: {findings} - Vulnerabilities from Red Team
- **Security Standards**: {standards} - Security requirements (OWASP, etc.)

## Prerequisites

### Required Context

- Red Team findings documented in blockers
- Understanding of each vulnerability
- Knowledge of secure coding patterns

### Required State

- All Red Team findings available
- Development environment ready
- Security test framework available

## Steps

1. Prioritize findings
   - You MUST address Critical/High severity first
   - You MUST understand root cause of each finding
   - You SHOULD group related vulnerabilities
   - **Validation**: Prioritized remediation plan

2. Fix root causes
   - You MUST fix the root cause, not symptoms
   - You MUST use secure coding patterns
   - You SHOULD implement defense in depth
   - You MUST NOT just add input validation if output encoding needed
   - **Validation**: Fix addresses root cause

3. Add security tests
   - You MUST add test that reproduces the vulnerability
   - Test MUST fail before fix, pass after
   - You SHOULD add regression tests for similar patterns
   - You MUST NOT leave security untested
   - **Validation**: Security tests pass

4. Implement defense in depth
   - You SHOULD add multiple layers of protection
   - You MAY add WAF rules as additional layer
   - You SHOULD add logging for security events
   - **Validation**: Multiple defenses in place

5. Document mitigations
   - You MUST document how each finding was fixed
   - You MUST update blockers with resolution
   - You SHOULD note any accepted risks
   - **Validation**: Mitigations documented

6. Verify fixes
   - You MUST re-run Red Team attacks
   - All previous attacks MUST fail
   - You MUST NOT introduce new vulnerabilities
   - **Validation**: Previous attacks no longer work

## Success Criteria

- [ ] All Critical/High findings fixed
- [ ] Root causes addressed (not just symptoms)
- [ ] Security tests added for each fix
- [ ] Defense in depth implemented where appropriate
- [ ] Mitigations documented
- [ ] Red Team attacks no longer succeed

## Error Handling

### Error: Fix Breaks Functionality

**Symptoms**: Security fix causes application errors

**Resolution**:
1. You MUST find solution that maintains both security and functionality
2. You SHOULD NOT choose functionality over security
3. You MAY redesign the feature if needed
4. Document trade-offs for human review

### Error: Cannot Fix Without Breaking Change

**Symptoms**: Proper fix requires API or behavior change

**Resolution**:
1. You MUST document the breaking change required
2. You SHOULD propose migration path
3. You MAY implement with feature flag
4. Get human approval for breaking changes

### Error: Vulnerability Cannot Be Fully Fixed

**Symptoms**: Complete fix not possible in current architecture

**Resolution**:
1. You MUST implement best available mitigation
2. You MUST document residual risk
3. You MUST add compensating controls
4. Flag for architectural review

## Related Hats

- **Red Team**: Found the vulnerabilities being fixed
- **Reviewer**: Will verify security fixes
- **Builder**: Similar implementation skills
