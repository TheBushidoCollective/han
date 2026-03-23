---
name: develop
description: >-
  Guides end-to-end feature development through 8 phases: discover requirements,
  explore codebase patterns, clarify ambiguities with the user, design architecture,
  implement with TDD, run multi-agent code review, validate all quality gates, and
  write a blog post. Use when asked to add a feature, implement a new capability,
  build functionality, or develop a feature end-to-end.
---

# Feature Development Workflow

Structured 8-phase process for building new features from requirement gathering through documentation. Each phase produces a concrete output that feeds the next.

## Overview

1. **Discover** - Gather requirements, acceptance criteria, and impacted areas
2. **Explore** - Map codebase patterns and integration points with parallel agents
3. **Clarify** - Resolve ambiguities with the user before writing code
4. **Design** - Architect the solution with domain-specific agents
5. **Implement** - Build with TDD using `tdd:test-driven-development`
6. **Review** - Multi-agent code review with confidence-based filtering
7. **Validate** - Run tests, linting, and type checking; generate change summary
8. **Document** - Write a blog post announcing the feature

---

## Phase 1: Discover

**Objective**: Establish what needs to be built and why.

1. **Parse the feature request** - Identify the user-facing goal, the problem it solves, and acceptance criteria.
2. **Identify impacted areas** - Which modules, APIs, or UI surfaces will change? Are there related issues or PRs?
3. **Search for prior art**:

   ```bash
   # Find existing implementations of similar patterns
   grep -rn "pagination\|paginate" --include="*.ts" src/
   ```

4. **Review project standards** - Read CLAUDE.md, CONTRIBUTING.md, and any architecture docs for constraints.

**Output**: Problem statement, acceptance criteria, and list of affected modules.

---

## Phase 2: Explore (Parallel Agents)

**Objective**: Understand existing patterns so the new feature fits naturally.

Launch these agents in **parallel** (single message, multiple Task calls):

| Agent | Focus |
|-------|-------|
| Code Explorer | Entry points, call chains, data flow |
| Pattern Analyzer | Naming conventions, test patterns, module structure |
| Dependency Mapper | Module relationships, integration points, circular-dependency risks |

**Output**: Consolidated map of codebase conventions and integration points.

---

## Phase 3: Clarify (Human Decision Point)

**Objective**: Get explicit user answers before writing any code.

Use **AskUserQuestion** to resolve:

- **Architecture trade-offs** - e.g., "Cursor-based or offset-based pagination?"
- **Scope boundaries** - e.g., "Should this include admin-only filtering?"
- **Integration approach** - e.g., "Extend UserService or create PaginationService?"

Do not proceed with assumptions. Every ambiguity must have a user-approved answer.

**Output**: Unambiguous requirements with chosen approach.

---

## Phase 4: Design (Parallel Agents)

**Objective**: Define module structure, interfaces, and testing strategy before coding.

Select agents by feature type and launch in **parallel** for multi-disciplinary work:

- Frontend feature -> `frontend:presentation-engineer`
- Backend API -> `backend:api-designer`
- Database changes -> `databases:database-designer`
- Security-sensitive -> add `security:security-engineer`

Each agent produces: file organization, interface contracts, and testing strategy.

**Output**: Implementation plan with module layout and interface definitions.

---

## Phase 5: Implement (TDD)

**Objective**: Build the feature using the `tdd:test-driven-development` skill.

For each component, follow the Red-Green-Refactor cycle:

```typescript
// 1. RED - Write a failing test
describe("getUsersPaginated", () => {
  it("returns paginated results with total count", async () => {
    const result = await userService.getUsersPaginated({ page: 1, limit: 10 });
    expect(result.users).toHaveLength(10);
    expect(result.total).toBe(25);
  });
});

// 2. GREEN - Write minimum code to pass
// 3. REFACTOR - Improve structure while keeping tests green
```

**Guidelines**:

- Follow codebase patterns discovered in Phase 2
- Apply SOLID principles (`han-core:solid-principles`)
- Integrate incrementally -- test integration points as you go
- Keep it simple (KISS, YAGNI); do not over-engineer
- Never skip tests or ignore linter/type errors

**Output**: Working implementation with passing tests.

---

## Phase 6: Review (Parallel Multi-Agent)

**Objective**: Surface high-confidence issues only.

Launch review agents in **parallel**:

1. **Code Reviewer** (`han-core:code-reviewer`) - Quality assessment with confidence scoring
2. **Security Engineer** (`security:security-engineer`) - Vulnerability scan, auth pattern verification
3. **Domain Agent** - Frontend, backend, or other discipline-specific reviewer

**Consolidation rules**:

- De-duplicate findings across agents
- Discard issues below 80% confidence
- Classify remaining as Critical (>=90%) or Important (>=80%)

Present results to the user with fix options:

```
Found 3 critical and 5 important issues.

1. Fix all issues now (recommended)
2. Fix critical only, defer important
3. Review findings per-issue
```

**Output**: Actionable issue list filtered to high-confidence findings.

---

## Phase 7: Validate and Summarize

**Objective**: Confirm all quality gates pass and document the change.

**Run validations**:

```bash
# Tests
npm test            # or the project's test command

# Linting and formatting
npm run lint

# Type checking
npx tsc --noEmit
```

**Checklist** (all must pass before commit):

- [ ] All tests pass
- [ ] Linting passes
- [ ] Type checking passes
- [ ] No security vulnerabilities introduced
- [ ] Documentation updated
- [ ] No uncoordinated breaking changes

**Generate change summary** covering: files changed and why, how to test, breaking changes (if any), and follow-up tasks.

**Output**: Commit-ready feature with change summary.

---

## Phase 8: Document (Blog Post)

**Objective**: Announce the feature with a blog post.

Write to `website/content/blog/{feature-slug}.md`:

```markdown
---
title: "{Feature Name}: {Subtitle}"
description: "{One-line problem statement}"
date: "{YYYY-MM-DD}"
author: "The Bushido Collective"
tags: ["{relevant}", "{tags}"]
category: "Feature"
---

## The Problem
{Pain point this feature addresses}

## The Solution
{How the feature works, with code examples}

## Getting Started
{Steps to use the feature}

## What's Next
{Future improvements}
```

Keep it 500-1000 words, technically accurate, and actionable.

**Output**: Published blog post.

---

## Example

```
User: /develop Add pagination to user list API

Phase 1 - Discover
  Goal: GET /api/users supports page/limit params, returns total count
  Impact: UserService, user routes, integration tests

Phase 2 - Explore (parallel)
  Found: Products API uses offset/limit with { items, total } response shape
  Convention: Services return { data, meta } objects
  Tests: Integration tests use supertest with database fixtures

Phase 3 - Clarify
  Q: Cursor-based or offset-based pagination?
  A: Offset-based (consistent with products API)

Phase 4 - Design
  Agent: backend:api-designer
  Plan: Add getUsersPaginated(page, limit) to UserService
  Interface: { users: User[], total: number }

Phase 5 - Implement (TDD)
  Red:   test for getUsersPaginated with fixtures
  Green: implement in UserService + route handler
  Refactor: extract shared pagination helper

Phase 6 - Review (parallel)
  Code reviewer: no issues
  Security: validated input sanitization for page/limit params

Phase 7 - Validate
  Tests: PASS | Lint: PASS | Types: PASS
  Summary: 3 files changed, no breaking changes

Phase 8 - Document
  Blog: website/content/blog/user-list-pagination.md
```

---

## See Also

- `/review` - Run multi-agent review only
- `/commit` - Smart commit workflow
- `/create-blog-post` - Research and write blog posts
- `tdd:test-driven-development` - TDD skill
- `han-core:code-reviewer` - Review skill
