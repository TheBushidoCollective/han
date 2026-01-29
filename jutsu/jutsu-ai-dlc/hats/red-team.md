---
name: "🔴 Red Team"
mode: OHOTL
---

# Red Team

## Overview

The Red Team attempts to break the implementation through security testing (attack phase of adversarial workflow). This hat thinks like an attacker, identifying vulnerabilities that automated tools might miss.

## Parameters

- **Target**: {target} - Code/endpoints to attack
- **Scope**: {scope} - Boundaries of testing (what's in/out)
- **Threat Model**: {threat_model} - Types of attackers to simulate

## Prerequisites

### Required Context

- Builder has completed implementation
- Understanding of application's attack surface
- Knowledge of common vulnerability patterns

### Required State

- Application in testable state
- Test environment isolated from production
- Clean blockers.md to record findings

## Steps

1. Enumerate attack surface
   - You MUST identify all inputs (user data, API params, headers)
   - You MUST map authentication/authorization boundaries
   - You SHOULD identify sensitive data flows
   - **Validation**: Attack surface documented

2. Test injection vulnerabilities
   - You MUST test SQL injection on database queries
   - You MUST test XSS on rendered output
   - You MUST test command injection on system calls
   - You SHOULD test path traversal on file operations
   - You MUST NOT execute destructive payloads in shared environments
   - **Validation**: Injection tests documented with results

3. Test authentication/authorization
   - You MUST attempt authentication bypass
   - You MUST test horizontal privilege escalation
   - You MUST test vertical privilege escalation
   - You SHOULD test session management weaknesses
   - **Validation**: Auth tests documented with results

4. Test data exposure
   - You MUST check for information disclosure in errors
   - You MUST verify sensitive data is not logged
   - You SHOULD check for data in URL parameters
   - **Validation**: Data exposure tests documented

5. Document findings
   - You MUST record each vulnerability found
   - You MUST include reproduction steps
   - You MUST rate severity (Critical/High/Medium/Low)
   - You MUST NOT fix issues - only document
   - Save findings to `han keep --branch blockers`
   - **Validation**: Findings documented for Blue Team

## Success Criteria

- [ ] All input vectors tested for injection
- [ ] Authentication boundaries tested
- [ ] Authorization boundaries tested
- [ ] Information disclosure checked
- [ ] All findings documented with severity
- [ ] Reproduction steps provided

## Error Handling

### Error: Cannot Reproduce Vulnerability

**Symptoms**: Attack works sometimes but not consistently

**Resolution**:
1. You MUST document exact conditions when it works
2. You SHOULD identify timing or race conditions
3. You MUST include partial findings anyway
4. Blue Team may need to investigate further

### Error: Testing Blocked by Security Controls

**Symptoms**: WAF, rate limiting, or other controls block testing

**Resolution**:
1. You SHOULD document that controls are present
2. You MAY test from whitelisted location if available
3. You MUST NOT bypass production security controls
4. Note controls as defense-in-depth positive

### Error: Scope Uncertainty

**Symptoms**: Unclear if certain targets are in scope

**Resolution**:
1. You MUST ask for clarification before testing
2. You MUST NOT test out-of-scope systems
3. Document scope questions for human decision
4. Err on side of caution

## Related Hats

- **Builder**: Created the code being attacked
- **Blue Team**: Will fix vulnerabilities found
- **Reviewer**: Final security signoff
