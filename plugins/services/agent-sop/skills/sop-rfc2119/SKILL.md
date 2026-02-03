---
name: sop-rfc2119
description: Use when writing SOPs that require precise requirement levels using RFC 2119 constraint keywords (MUST, SHOULD, MAY). Covers proper usage of requirement keywords for deterministic agent behavior.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# RFC 2119 Keywords for SOPs

RFC 2119 defines keywords for indicating requirement levels in specifications. Using these keywords in SOPs creates precise, unambiguous instructions that AI agents can execute deterministically.

## Key Concepts

### The RFC 2119 Keywords

RFC 2119 defines these keywords for requirement levels:

| Keyword | Meaning | Usage |
|---------|---------|-------|
| **MUST** | Absolute requirement | Non-negotiable steps that must be performed |
| **MUST NOT** | Absolute prohibition | Actions that are forbidden |
| **SHOULD** | Strong recommendation | Preferred approach, but alternatives may exist |
| **SHOULD NOT** | Strong discouragement | Discouraged, but may be acceptable in specific cases |
| **MAY** | Optional | Truly optional actions at agent's discretion |

### Why Use RFC 2119 in SOPs

1. **Eliminates Ambiguity**: Clear distinction between required and optional steps
2. **Predictable Execution**: Agents know exactly what is mandatory vs. recommended
3. **Better Error Handling**: Violations of MUST/MUST NOT trigger immediate failures
4. **Consistent Interpretation**: Standard keywords understood across implementations

## Best Practices

### Using MUST

**MUST** indicates absolute requirements. Use for:

- Critical safety or security steps
- Steps that affect data integrity
- Prerequisites that block subsequent steps
- Validation that prevents errors

```markdown
## Steps

1. You MUST verify all tests pass before deployment
2. You MUST backup the database before running migrations
3. You MUST validate user input before processing
4. You MUST check authentication before accessing resources
```

**When Not to Use MUST:**

- ❌ Stylistic preferences: "You MUST use single quotes"
- ❌ Minor optimizations: "You MUST use const instead of let"
- ✅ Use SHOULD instead for preferences

### Using MUST NOT

**MUST NOT** indicates absolute prohibitions. Use for:

- Security violations
- Data corruption risks
- Breaking changes without migration
- Actions that violate invariants

```markdown
## Steps

1. You MUST NOT commit secrets to version control
2. You MUST NOT modify production data without backup
3. You MUST NOT skip type checking before deployment
4. You MUST NOT proceed if validation fails
```

**Examples:**

```markdown
## Security Requirements

- You MUST NOT log sensitive user data (passwords, tokens, PII)
- You MUST NOT disable security features in production
- You MUST NOT expose internal error details to users
- You MUST NOT use user input directly in SQL queries

## Data Integrity

- You MUST NOT delete data without backup verification
- You MUST NOT modify schema without migration path
- You MUST NOT skip transaction rollback on errors
- You MUST NOT cache data without expiration
```

### Using SHOULD

**SHOULD** indicates strong recommendations. Use for:

- Best practices that improve quality
- Performance optimizations
- Code style preferences
- Recommended but not required steps

```markdown
## Steps

1. You SHOULD add logging for debugging
2. You SHOULD include usage examples in documentation
3. You SHOULD run linter before committing
4. You SHOULD use meaningful variable names
```

**SHOULD vs. MUST:**

```markdown
## Type Safety (MUST - affects correctness)
- You MUST add type annotations to public APIs
- You MUST validate types at runtime boundaries

## Code Quality (SHOULD - improves maintainability)
- You SHOULD add type annotations to internal functions
- You SHOULD use strict TypeScript configuration
```

### Using SHOULD NOT

**SHOULD NOT** indicates discouragement. Use for:

- Anti-patterns to avoid
- Suboptimal but sometimes necessary approaches
- Deprecated patterns being phased out

```markdown
## Steps

1. You SHOULD NOT use global variables (use dependency injection)
2. You SHOULD NOT catch all errors (catch specific exceptions)
3. You SHOULD NOT use magic numbers (define constants)
4. You SHOULD NOT nest callbacks deeply (use async/await)
```

**With Justification:**

```markdown
## Code Patterns

- You SHOULD NOT use eval() for parsing (security risk)
  - Exception: If you MUST use eval(), sanitize input and run in sandbox

- You SHOULD NOT use var (use const or let)
  - Exception: Supporting legacy browsers may require var

- You SHOULD NOT use any type in TypeScript (defeats type safety)
  - Exception: Interfacing with untyped libraries may require any
```

### Using MAY

**MAY** indicates truly optional actions. Use for:

- Optional enhancements
- User preferences
- Non-critical additions
- Context-dependent choices

```markdown
## Steps

1. You MAY add code comments for complex logic
2. You MAY include performance benchmarks
3. You MAY use helper utilities for common operations
4. You MAY add additional test cases beyond minimum coverage
```

**MAY vs. SHOULD:**

```markdown
## Documentation (SHOULD - recommended)
- You SHOULD document public APIs
- You SHOULD include README with setup instructions

## Additional Documentation (MAY - optional)
- You MAY add architecture diagrams
- You MAY include design decision records
- You MAY create video tutorials
```

## Examples

### Example 1: Code Review SOP with RFC 2119

```markdown
# Review Pull Request for Security

## Steps

1. Analyze authentication and authorization
   - You MUST verify authentication is required for protected routes
   - You MUST check authorization logic prevents privilege escalation
   - You SHOULD use role-based access control (RBAC)
   - You MAY suggest additional security layers

2. Review input validation
   - You MUST verify all user input is validated
   - You MUST confirm SQL queries use parameterization
   - You MUST NOT allow unescaped user input in templates
   - You SHOULD validate input both client and server side

3. Check secret management
   - You MUST NOT approve code with hardcoded secrets
   - You MUST verify secrets use environment variables
   - You SHOULD check secrets are not logged
   - You MAY recommend secret rotation policies

4. Assess error handling
   - You MUST verify errors don't expose sensitive information
   - You SHOULD check errors are logged appropriately
   - You SHOULD NOT allow generic catch-all error handlers
   - You MAY suggest specific error recovery strategies
```

### Example 2: TDD Implementation SOP with RFC 2119

```markdown
# Implement Feature Using Test-Driven Development

## Steps

1. Write failing test (RED)
   - You MUST write test before implementation code
   - You MUST run test to verify it fails
   - You MUST confirm failure message describes expected behavior
   - You SHOULD use descriptive test names
   - You MAY add multiple test cases for edge cases

2. Write minimal implementation (GREEN)
   - You MUST write simplest code to pass test
   - You MUST run test to verify it passes
   - You MUST NOT add functionality beyond test requirements
   - You SHOULD NOT optimize prematurely
   - You MAY add code comments for complex logic

3. Refactor (REFACTOR)
   - You MUST keep all tests passing during refactoring
   - You MUST run tests after each refactoring step
   - You SHOULD extract duplicated code
   - You SHOULD improve naming and structure
   - You SHOULD NOT change test behavior
   - You MAY add performance optimizations if needed

4. Repeat cycle
   - You MUST complete red-green-refactor for each requirement
   - You SHOULD commit after each complete cycle
   - You MAY combine related test cases
```

### Example 3: Deployment SOP with RFC 2119

```markdown
# Deploy Application to Production

## Prerequisites

- You MUST have production credentials configured
- You MUST verify all tests passed on staging
- You SHOULD have reviewed recent changes
- You MAY have notified team of deployment

## Steps

1. Pre-deployment verification
   - You MUST verify staging deployment is healthy
   - You MUST check database migrations are ready
   - You MUST confirm rollback plan is documented
   - You SHOULD review monitoring dashboards
   - You MAY run additional smoke tests

2. Execute deployment
   - You MUST backup production database
   - You MUST apply database migrations before code deployment
   - You MUST NOT skip health checks during rollout
   - You SHOULD deploy during low-traffic window
   - You MAY use canary deployment strategy

3. Post-deployment verification
   - You MUST run smoke tests on production
   - You MUST monitor error rates for 15 minutes
   - You MUST verify critical user flows work
   - You SHOULD check performance metrics
   - You SHOULD NOT close deployment until verification complete
   - You MAY run additional integration tests

4. Error handling
   - You MUST execute rollback if error rate exceeds threshold
   - You MUST NOT ignore failing health checks
   - You SHOULD capture logs for debugging
   - You MAY attempt targeted fixes if safe
```

## Common Patterns

### Combining Requirements

```markdown
## Validation Steps

1. Input validation
   - You MUST validate all required fields are present
   - You MUST check data types match schema
   - You SHOULD validate format (email, phone, etc.)
   - You SHOULD NOT accept malformed input
   - You MAY provide user-friendly error messages

2. If validation fails:
   - You MUST return validation errors to user
   - You MUST NOT proceed to next step
   - You SHOULD log validation failures
   - You MAY suggest corrections
```

### Conditional Requirements

```markdown
## Conditional Steps

1. Check feature flag state
   - If feature flag is enabled:
     - You MUST use new implementation
     - You SHOULD monitor adoption metrics
   - If feature flag is disabled:
     - You MUST use legacy implementation
     - You MUST NOT access new feature code paths
```

### Progressive Enhancement

```markdown
## Implementation Levels

### Minimum Viable (MUST)
- You MUST implement core functionality
- You MUST add error handling
- You MUST include basic tests

### Recommended (SHOULD)
- You SHOULD add logging
- You SHOULD document public APIs
- You SHOULD optimize common paths

### Optional (MAY)
- You MAY add performance monitoring
- You MAY include usage analytics
- You MAY create detailed examples
```

## Anti-Patterns

**Avoid These RFC 2119 Mistakes:**

1. **Overusing MUST**
   - ❌ "You MUST use 2 spaces for indentation"
   - ✅ "You SHOULD follow project code style"

2. **Weak MUST Statements**
   - ❌ "You MUST try to write good code"
   - ✅ "You MUST pass all linter checks"

3. **Missing Negative Forms**
   - ❌ "You SHOULD avoid using eval()"
   - ✅ "You SHOULD NOT use eval() except in sandboxed contexts"

4. **Vague MAY Statements**
   - ❌ "You MAY improve the code"
   - ✅ "You MAY add performance optimizations if metrics show bottlenecks"

5. **Conflicting Requirements**
   - ❌ "You MUST validate input" + "You MAY skip validation for performance"
   - ✅ "You MUST validate untrusted input" + "You MAY cache validation results"

## Keyword Selection Guide

### Use MUST when

- ✅ Skipping the step causes errors or data corruption
- ✅ Security or privacy is at stake
- ✅ Step is prerequisite for subsequent steps
- ✅ Violating requirement breaks system invariants

### Use SHOULD when

- ✅ Following guideline improves quality or maintainability
- ✅ Best practice but alternatives exist
- ✅ Strongly recommended but context may vary
- ✅ Performance or readability benefit

### Use MAY when

- ✅ Truly optional enhancement
- ✅ User preference or style choice
- ✅ Context-dependent decision
- ✅ No impact on correctness or quality

## Related Skills

- **sop-authoring**: Learn to write effective SOP instructions
- **sop-structure**: Organize SOPs with proper sections
- **sop-maintenance**: Keep SOPs accurate and current
