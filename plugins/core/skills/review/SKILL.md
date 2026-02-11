---
name: review
user-invocable: false
description: Multi-agent code review with confidence-based filtering
---

# Code Review Workflow

## Name

han-core:review - Multi-agent code review with confidence-based filtering

## Synopsis

```
/review [arguments]
```

## Description

Multi-agent code review with confidence-based filtering

## Implementation

Automated multi-agent code review with confidence-based filtering. Runs parallel specialized review agents to identify high-confidence issues across quality, security, and discipline-specific concerns.

## Overview

This command orchestrates multiple review agents in parallel to provide comprehensive code review:

- **General Quality**: Code correctness, maintainability, testing
- **Security**: Vulnerabilities, auth/authz, input validation
- **Discipline-Specific**: Frontend, backend, or specialized concerns

**Key Features**:

- ✅ Parallel agent execution for speed
- ✅ Confidence scoring (0-100) with ≥80% threshold
- ✅ False positive filtering
- ✅ Automatic de-duplication
- ✅ Consolidated findings report

---

## How It Works

### 1. Preparation

Gathers context about the changes:

```bash
# Review scope of changes
git diff --stat main...HEAD

# Get full diff
git diff main...HEAD

# Check recent commits
git log main...HEAD --oneline
```

### 2. Parallel Review Agents

Launches multiple independent agents **in parallel** (single message, multiple Task calls):

#### Core Reviewer (Always Runs)

- **Agent**: `han-core:code-reviewer` skill
- **Focus**: General quality, correctness, maintainability, testing
- **Filters**: Confidence ≥80%, false positive filtering
- **Output**: Categorized issues (Critical ≥90%, Important ≥80%)

#### Security Reviewer (Always Runs)

- **Agent**: `security:security-engineer`
- **Focus**: Security vulnerabilities, auth patterns, input validation
- **Checks**: SQL injection, XSS, CSRF, auth bypass, secrets exposure
- **Output**: Security issues with severity and confidence scores

#### Discipline-Specific Reviewer (Auto-Selected)

**Auto-detection based on changed files**:

| File Pattern | Agent | Focus |
|-------------|-------|-------|
| `*.tsx`, `*.jsx`, `*.css` | `frontend:presentation-engineer` | UI/UX, accessibility, responsiveness |
| `**/api/**`, `**/controllers/**` | `backend:backend-architect` | API design, scalability, error handling |
| `**/db/**`, `**/*schema*` | `databases:database-designer` | Query optimization, migrations, indexes |
| `**/test/**`, `**/*.test.*` | `quality:test-architect` | Test quality, coverage, patterns |
| `**/infra/**`, `*.tf` | `infrastructure:devops-engineer` | Infrastructure, deployment, configuration |

**Manual override**: Specify agent explicitly if auto-detection is incorrect.

### 3. Consolidation

Merges findings from all agents:

1. **Collect** all issues from parallel agents
2. **De-duplicate** identical findings
3. **Filter** for confidence ≥80%
4. **Categorize** by severity:
   - 🔴 **Critical** (confidence ≥90%): Must fix before merge
   - 🟡 **Important** (confidence ≥80%): Should fix before merge
5. **Format** with file:line references

### 4. Report

Presents consolidated findings:

```markdown
## Review Summary

Total files changed: X
Lines added: +X, removed: -X
Review agents: 3 (Core, Security, Frontend)

---

## Findings

### 🔴 Critical Issues (Must Fix)

**[Issue]** - `file.ts:42` - **Confidence: 95%**
- Problem: ...
- Impact: ...
- Fix: ...

### 🟡 Important Issues (Should Fix)

**[Issue]** - `file.ts:89` - **Confidence: 85%**
- Problem: ...
- Impact: ...
- Suggestion: ...

---

## Verification Status

- [ ] All automated checks passed
- [ ] Security review: 1 critical issue
- [ ] Quality review: 0 issues
- [ ] Frontend review: 2 important issues

---

## Decision: REQUEST CHANGES

Critical issues must be resolved before approval.

---

## Next Actions

1. Fix SQL injection vulnerability at `services/user.ts:42`
2. Add error handling to `components/UserForm.tsx:89`
3. Re-run /review after fixes
```

---

## Usage

### Review current branch

```
/review
```

Reviews all changes from main branch to HEAD.

### Review specific PR

```
/review pr 123
```

Uses `gh` CLI to fetch PR #123 and review changes.

### Review with specific agents

```
/review --agents security,performance
```

Override auto-detection and run only specified agents.

### Review specific files

```
/review src/services/payment.ts
```

Review only specified files instead of entire diff.

---

## Confidence Scoring

All findings include confidence scores to reduce noise:

| Score | Meaning | Action |
|-------|---------|--------|
| 100% | Absolutely certain | Always report (linter errors, type errors, failing tests) |
| 90-99% | Very high confidence | Always report (clear violations, obvious bugs) |
| 80-89% | High confidence | Report (pattern violations, missing tests) |
| <80% | Medium-low confidence | **Do not report** (speculative, subjective) |

**Filtering rules**:

- ❌ Pre-existing issues (not in current diff)
- ❌ Linter-catchable issues (automated tools handle these)
- ❌ Code with lint-ignore comments
- ❌ Style preferences without documented standards
- ❌ Theoretical concerns without evidence

---

## Agent Details

### Core Reviewer (han-core:code-reviewer)

**Dimensions**:

1. Correctness - Does it solve the problem?
2. Safety - Security and data integrity
3. Maintainability - Readable, documented, follows patterns
4. Testability - Tests exist and cover edge cases
5. Performance - No obvious performance issues
6. Standards - Follows coding standards

**Red flags (never approve)**:

- Commented-out code
- Secrets/credentials in code
- Breaking changes without coordination
- Tests commented out or skipped
- No tests for new functionality

### Security Reviewer (security:security-engineer)

**Focus areas**:

- Input validation and sanitization
- SQL injection prevention
- XSS/CSRF protection
- Authentication and authorization
- Secrets management
- API security (rate limiting, CORS)
- Dependency vulnerabilities

**Severity levels**:

- Critical: Exploitable vulnerabilities
- High: Security pattern violations
- Medium: Potential security concerns

### Discipline-Specific Reviewers

Each specialized agent brings domain expertise:

**Frontend** (presentation-engineer):

- Accessibility (WCAG compliance)
- Responsive design
- Performance (bundle size, lazy loading)
- User experience
- Component patterns

**Backend** (backend-architect):

- API design (RESTful, GraphQL)
- Error handling and validation
- Database transactions
- Caching strategies
- Scalability concerns

**Database** (database-designer):

- Query optimization
- Index usage
- Migration safety
- Data integrity
- Schema design

---

## Integration with Workflows

### Part of /feature-dev workflow

```
Phase 6: Review (from /feature-dev)
  ↓
  Calls /review command
  ↓
  Reports findings
  ↓
  User fixes issues
  ↓
  Re-run /review until clean
```

### Standalone usage

```
# Make changes
git add .

# Review before commit
/review

# Fix issues

# Review again
/review

# If clean, commit
/commit
```

### PR review automation

```
# Fetch PR
gh pr checkout 123

# Review changes
/review

# Comment on PR
gh pr comment 123 --body "$(cat review-findings.md)"
```

---

## Advanced Features

### Redundant Review for Critical Code

For high-risk changes (auth, payments, security), run **redundant reviewers**:

```
/review --redundant
```

This runs:

- 2x Core reviewers (independent evaluations)
- 2x Security reviewers (double-check vulnerabilities)
- 1x Discipline-specific reviewer

**Consensus logic**: Report issue only if ≥2 reviewers agree (reduces false positives).

### Historical Context Review

Include git history analysis:

```
/review --with-history
```

Adds:

- **Blame analysis**: Who wrote original code?
- **Change patterns**: Frequently modified files (potential hot spots)
- **Regression risk**: Areas with past bugs
- **Commit context**: Related commits and their impact

### Custom Agent Teams

Define custom agent combinations:

```
/review --team security-critical
```

Uses pre-defined team from `.claude/review-teams.json`:

```json
{
  "security-critical": [
    "han-core:code-reviewer",
    "security:security-engineer",
    "security:security-engineer", // redundant
    "infrastructure:devops-engineer"
  ]
}
```

---

## Configuration

### .claude/settings.json

```json
{
  "review": {
    "confidenceThreshold": 80,
    "autoSelectAgents": true,
    "enableRedundancy": false,
    "includeHistory": false,
    "maxIssuesPerCategory": 10
  }
}
```

### Project-specific standards

Review agents check these files for project standards:

- `CLAUDE.md` - Project-specific guidelines
- `CONTRIBUTING.md` - Contribution standards
- `.github/PULL_REQUEST_TEMPLATE.md` - PR requirements

---

## Best Practices

### DO

- ✅ Run /review before creating PR
- ✅ Fix critical issues (≥90%) before requesting human review
- ✅ Re-run /review after fixing issues
- ✅ Trust agent consolidation (de-duplication)
- ✅ Let agents run in parallel for speed

### DON'T

- ❌ Ignore critical findings
- ❌ Report issues with <80% confidence
- ❌ Run agents sequentially (use parallel)
- ❌ Second-guess agent findings without evidence
- ❌ Skip re-review after fixes

---

## Troubleshooting

### "No issues found" but code has problems

**Likely causes**:

- Issues have <80% confidence (adjust threshold?)
- Pre-existing issues (not in current diff)
- Automated tools already catch them

**Solutions**:

- Check linter/type checker output
- Run with `--confidence-threshold 70` to see filtered issues
- Manually review automated tool results

### Too many low-value findings

**Likely causes**:

- Agents reporting medium-confidence issues
- No project-specific standards documented

**Solutions**:

- Verify confidence threshold is ≥80%
- Document standards in CLAUDE.md
- Use false positive filters

### Agents disagree on same issue

**Normal**: Different perspectives are valuable

**Resolution**:

- Higher confidence score wins
- Security concerns override others
- Consolidation chooses most specific finding

---

## See Also

- `/feature-dev` - Full feature development workflow (includes review)
- `/commit` - Smart commit after review passes
- `han-core:code-reviewer` - Core review skill documentation
- `security` - Security agent details
