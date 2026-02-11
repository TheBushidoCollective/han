---
name: develop
user-invocable: false
description: Comprehensive 8-phase workflow for developing new features with quality enforcement
---

# Feature Development Workflow

## Name

han-core:develop - Comprehensive 8-phase workflow for developing new features with quality enforcement

## Synopsis

```
/develop [arguments]
```

## Description

Comprehensive 8-phase workflow for developing new features with quality enforcement

## Implementation

A comprehensive, structured 8-phase workflow for developing new features with quality enforcement and quality principles.

## Overview

This command guides you through a systematic feature development process:

1. **Discover** - Understand requirements and context
2. **Explore** - Analyze existing codebase patterns
3. **Clarify** - Resolve ambiguities with user input
4. **Design** - Create architecture with specialized agents
5. **Implement** - Build with TDD and quality practices
6. **Review** - Multi-agent quality review with confidence scoring
7. **Validate** - Run all verification hooks and summarize
8. **Document** - Write blog post announcing the feature

---

## Phase 1: Discover

### Understand requirements and gather context

**Objective**: Establish clear understanding of what needs to be built and why.

1. **Review the feature request**:
   - What is the user-facing goal?
   - What problem does this solve?
   - What are the acceptance criteria?

2. **Identify impacted areas**:
   - Which parts of the codebase will change?
   - What existing features might be affected?
   - Are there related issues or PRs?

3. **Check for similar features**:

   ```bash
   # Search for similar implementations
   grep -r "similar_feature_name" .
   ```

4. **Review project documentation**:
   - Check CLAUDE.md, CONTRIBUTING.md for standards
   - Review architecture docs if available
   - Identify any constraints or requirements

**Output**: Clear problem statement and high-level approach.

---

## Phase 2: Explore (Parallel Agent Execution)

### Analyze codebase with specialized agents

**Objective**: Understand existing patterns and identify integration points.

**Launch multiple Explore agents in PARALLEL** (single message with multiple Task calls):

1. **Code Explorer**: Map existing features
   - Find entry points and call chains
   - Identify data flow and transformations
   - Document current architecture

2. **Pattern Analyzer**: Identify conventions
   - How are similar features implemented?
   - What testing patterns are used?
   - What naming conventions exist?

3. **Dependency Mapper**: Understand relationships
   - What modules will be affected?
   - What are the integration points?
   - Are there circular dependencies to avoid?

**Consolidation**: Synthesize findings from all agents into a cohesive understanding.

**Output**: Comprehensive map of existing codebase patterns and integration points.

---

## Phase 3: Clarify (Human Decision Point)

### Resolve ambiguities before implementation

**Objective**: Get user input on unclear requirements and design choices.

**Use AskUserQuestion tool** to resolve:

1. **Architecture decisions**:
   - Which approach should we take? (if multiple valid options)
   - What are the trade-offs? (performance vs. simplicity)

2. **Scope clarifications**:
   - Should this include X feature?
   - What's the priority if time is limited?

3. **Integration choices**:
   - Should we extend existing module or create new one?
   - How should this integrate with system Y?

**IMPORTANT**: Do not proceed with assumptions. Get explicit user answers.

**Output**: Clear, unambiguous requirements with user-approved approach.

---

## Phase 4: Design (Parallel Agent Execution)

### Create architecture with specialized agents

**Objective**: Design the implementation before coding.

**Select appropriate specialized agent(s)** based on feature type:

- **Frontend feature?** → `frontend:presentation-engineer`
- **Backend API?** → `backend:api-designer`
- **Database changes?** → `databases:database-designer`
- **Complex system?** → `architecture:solution-architect`

**Launch agents in PARALLEL** for multi-disciplinary features:

- Frontend + Backend agents simultaneously
- Include `security:security-engineer` for sensitive features
- Include `performance:performance-engineer` for high-traffic features

**Agent responsibilities**:

- Define module structure and file organization
- Specify interfaces and contracts
- Identify testing strategy
- Document key decisions and trade-offs

**Consolidation**: Review all design proposals, resolve conflicts, select final approach.

**Output**: Detailed implementation plan with module structure and interfaces.

---

## Phase 5: Implement (TDD with Quality Enforcement)

### Build the feature using test-driven development

**Objective**: Implement the designed solution with quality practices.

**Apply TDD cycle** (use `tdd:test-driven-development` skill):

```
For each component:
1. Write failing test (Red)
2. Implement minimum code to pass (Green)
3. Refactor for quality (Refactor)
4. Repeat
```

**Implementation guidelines**:

- ✅ Start with tests, not implementation
- ✅ Follow existing codebase patterns (from Phase 2)
- ✅ Apply SOLID principles (`han-core:solid-principles` skill)
- ✅ Keep it simple (KISS, YAGNI)
- ✅ Apply Boy Scout Rule - leave code better than found
- ❌ Don't over-engineer
- ❌ Don't skip tests
- ❌ Don't ignore linter/type errors

**Integration**:

- Integrate incrementally (don't build everything then integrate)
- Test integration points early
- Validate against acceptance criteria continuously

**Output**: Working implementation with comprehensive tests.

---

## Phase 6: Review (Parallel Multi-Agent Review)

### Quality review with confidence-based filtering

**Objective**: Identify high-confidence issues before final validation.

**Launch review agents in PARALLEL** (single message with multiple Task calls):

1. **Code Reviewer** (han-core:code-reviewer skill):
   - General quality assessment
   - Confidence scoring ≥80%
   - False positive filtering

2. **Security Engineer** (security:security-engineer):
   - Security vulnerability scan
   - Auth/authz pattern verification
   - Input validation review

3. **Discipline-Specific Agent**:
   - Frontend: `frontend:presentation-engineer` (accessibility, UX)
   - Backend: `backend:backend-architect` (API design, scalability)
   - etc.

**Review consolidation**:

- Merge findings from all agents
- De-duplicate issues
- Filter for confidence ≥80%
- Organize by: Critical (≥90%) → Important (≥80%)

**Present findings to user with options**:

```
Found 3 critical and 5 important issues.

Options:
1. Fix all issues now (recommended)
2. Fix critical only, defer important
3. Review findings and decide per-issue
```

**Output**: Consolidated review with high-confidence issues only.

---

## Phase 7: Validate & Summarize

### Final verification and change summary

**Objective**: Ensure all quality gates pass and document the change.

**Run all validation hooks**:

```bash
# All validation plugins automatically run on Stop
# Verify: tests, linting, type checking, etc.
```

**Validation checklist**:

- [ ] All tests pass
- [ ] Linting passes
- [ ] Type checking passes
- [ ] No security vulnerabilities introduced
- [ ] Documentation updated
- [ ] No breaking changes (or properly coordinated)

**Generate change summary**:

1. **What changed**: Files modified and why
2. **How to test**: Steps to verify functionality
3. **Breaking changes**: None, or list with migration guide
4. **Follow-up tasks**: Any deferred work or tech debt

**Create TODO list** (using TaskCreate tool):

- Document any follow-up tasks
- Track deferred improvements
- Note any tech debt introduced

**Output**: Ready-to-commit feature with comprehensive documentation.

---

## Phase 8: Document (Blog Post)

### Write a blog post announcing the feature

**Objective**: Share the new feature with the community and explain its value.

**Blog post creation**:

1. **Research context** (optional):
   - Use `reddit` to find related community discussions
   - Identify pain points the feature addresses
   - Understand how users talk about this problem

2. **Write the blog post**:

   Location: `website/content/blog/{feature-slug}.md`

   ```markdown
   ---
   title: "{Feature Name}: {Compelling subtitle}"
   description: "{One-line description of what problem this solves}"
   date: "{YYYY-MM-DD}"
   author: "The Bushido Collective"
   tags: ["{relevant}", "{tags}"]
   category: "Feature"
   ---

   {Opening hook - what problem does this solve?}

   ## The Problem

   {Describe the pain point this feature addresses}

   ## The Solution

   {Explain how the feature works}

   ### Key Capabilities

   {List main features with examples}

   ## Getting Started

   {How to use the feature}

   ## What's Next

   {Future improvements or related features}
   ```

3. **Writing guidelines**:
   - Technical but accessible
   - 500-1000 words for feature announcements
   - Include working code examples
   - Be honest about limitations
   - Make it actionable

**IMPORTANT**: Every significant feature should have a blog post. This is not optional.

**Output**: Published blog post in `website/content/blog/`.

---

## Usage

### Basic usage

```
/feature-dev
```

Then describe the feature you want to build.

### With feature description

```
/feature-dev Add user authentication with JWT tokens
```

---

## Best Practices

### DO

- ✅ Follow all 8 phases in order
- ✅ Launch agents in parallel when independent
- ✅ Use AskUserQuestion to resolve ambiguities
- ✅ Apply confidence scoring to all reviews
- ✅ Run TDD cycle for all new code
- ✅ Pause for user input at decision points
- ✅ Write a blog post for every significant feature

### DON'T

- ❌ Skip phases (especially Explore, Review, and Document)
- ❌ Start coding before design (Phases 1-4)
- ❌ Implement without tests
- ❌ Report low-confidence review findings
- ❌ Make architectural decisions without user input
- ❌ Commit without running validation hooks
- ❌ Ship features without documentation

---

## Example Workflow

```
User: /feature-dev Add pagination to user list API

Phase 1: Discover
- Feature: Add pagination to GET /api/users
- Acceptance: Support page/limit query params, return total count
- Impact: Backend API, database queries

Phase 2: Explore (parallel agents)
- Found existing pagination in products API
- Pattern: Uses offset/limit with total count in response
- Testing: Integration tests verify pagination logic

Phase 3: Clarify
Q: Should we use cursor-based or offset-based pagination?
A: [User selects offset-based for consistency]

Phase 4: Design
- Agent: backend:api-designer
- Design: Extend existing UserService with pagination
- Interface: getUsersPaginated(page, limit) -> { users, total }

Phase 5: Implement
- Write test for pagination
- Implement pagination logic
- Test passes ✅

Phase 6: Review (parallel agents)
- Code reviewer: No issues (confidence N/A)
- Security engineer: No issues (confidence N/A)
- Backend architect: No issues (confidence N/A)

Phase 7: Validate
- Tests: ✅ Pass
- Linting: ✅ Pass
- Types: ✅ Pass
- Ready to commit

Phase 8: Document
- Blog post: website/content/blog/user-list-pagination.md
- Title: "Pagination: Handling Large Data Sets Gracefully"
- Tags: [api, pagination, performance]

Summary: Added pagination to user list API
Files: services/user.service.ts, tests/user.service.test.ts, website/content/blog/user-list-pagination.md
Testing: Run GET /api/users?page=1&limit=10
```

---

## See Also

- `/review` - Run multi-agent review only
- `/commit` - Smart commit workflow
- `/create-blog-post` - Research and write blog posts
- `tdd:test-driven-development` - TDD skill
- `han-core:code-reviewer` - Review skill
