---
name: sdlc-coverage
summary: AI-native engineering workflow alignment with OpenAI's framework
---

# SDLC Coverage

AI-native engineering workflows aligned with OpenAI's Codex SDLC framework.

## Overview

Han provides comprehensive coverage across all seven phases of the Software Development Lifecycle (SDLC), enabling AI-native engineering teams to automate repetitive work while engineers focus on strategic decisions.

This blueprint documents how Han's plugin ecosystem maps to the [OpenAI Codex SDLC framework](https://developers.openai.com/codex/guides/build-ai-native-engineering-team/).

## The Seven SDLC Phases

| Phase | Agent Role | Engineer Focus | Han Support |
|-------|-----------|----------------|-------------|
| **1. Plan** | Analyze requirements, map dependencies, estimate difficulty | Strategic decisions, architectural scoping | bushido, do-* agents |
| **2. Design** | Convert mockups to components, implement design tokens | Refine UX and architecture | **hashi-figma** |
| **3. Build** | Draft features with models, APIs, tests, docs | Review domain logic and patterns | jutsu-*, do-*, bushido |
| **4. Test** | Generate test suites, identify edge cases | Ensure coverage strategy | jutsu-tdd, hashi-playwright-mcp |
| **5. Review** | Execute initial code review, identify patterns | Architectural alignment | bushido, do-* agents |
| **6. Document** | Generate docs, update system diagrams | Shape standards and structure | hashi-blueprints |
| **7. Deploy & Maintain** | Parse logs, correlate errors, propose fixes | Validate diagnostics, approve changes | **hashi-sentry** |

## Phase-by-Phase Breakdown

### Phase 1: Plan

**Agent Capabilities:**

- Read specifications and map dependencies
- Flag ambiguities and estimate difficulty
- Decompose features into tasks
- Create implementation plans

**Han Plugins:**

- `bushido` - `/plan` command for tactical planning
- `bushido` - `/architect` command for system design
- `do-*` agents - Specialized planning expertise

**Workflow:**

```bash
# User provides requirements
User: "Add user authentication with OAuth"

# Bushido creates implementation plan
/bushido:plan

# Specialized agents provide domain expertise
Agent: do-backend-development:backend-architect
```

**Engineer Ownership:**

- Final architectural decisions
- Technology selection
- Security model approval
- Long-term tradeoff assessment

---

### Phase 2: Design

**Agent Capabilities:**

- Convert Figma frames to production code
- Extract design tokens and variables
- Sync component libraries
- Analyze accessibility and responsive behavior

**Han Plugins:**

- **`hashi-figma`** (NEW) - Figma MCP integration
  - `/figma:generate-component` - Frame-to-code generation
  - `/figma:extract-tokens` - Design token extraction
  - `/figma:sync-design-system` - Component sync
  - `/figma:analyze-frame` - Implementation guidance

**Workflow:**

```bash
# Designer creates Figma frames
# Engineer connects design to code

/figma:generate-component
# Select frame in Figma or provide URL
# Agent generates production-ready code

/figma:sync-design-system
# Agent identifies component gaps and mismatches
```

**Engineer Ownership:**

- Component architecture patterns
- Design system conventions
- Accessibility strategy
- Framework integration decisions

---

### Phase 3: Build

**Agent Capabilities:**

- Draft end-to-end features
- Implement design patterns
- Follow established conventions
- Generate tests alongside implementation

**Han Plugins:**

- `jutsu-*` - Language/framework expertise (TypeScript, Python, Elixir, etc.)
- `bushido` - `/develop` command (7-phase workflow)
- `do-*` agents - Domain-specific implementation
- `hashi-context7` - Up-to-date library documentation

**Workflow:**

```bash
# Agent follows TDD cycle
/bushido:develop

# Phases:
# 1. Understand - Analyze requirements
# 2. Plan - Break down implementation
# 3. Implement - Write code + tests
# 4. Test - Verify functionality
# 5. Review - Self-review code quality
# 6. Document - Update blueprints
# 7. Verify - Final quality checks
```

**Engineer Ownership:**

- Core domain logic
- Architectural patterns
- Complex algorithm design
- Novel problem solving

---

### Phase 4: Test

**Agent Capabilities:**

- Generate comprehensive test suites
- Identify edge cases
- Maintain tests as code evolves
- Run test frameworks and report results

**Han Plugins:**

- `jutsu-tdd` - Test-driven development enforcement
- `hashi-playwright-mcp` - Browser automation and E2E testing
- Framework-specific jutsu (pytest, jest, etc.)
- Hooks for automatic test execution

**Workflow:**

```bash
# TDD enforcement via hooks
# Tests written BEFORE implementation

# E2E testing
/playwright:test
# Agent generates and runs browser tests

# Hook execution on Stop
jutsu-tdd: Run tests automatically
jutsu-pytest: Validate Python tests
```

**Engineer Ownership:**

- Test coverage strategy
- Test quality and clarity
- Integration test scenarios
- Performance test criteria

---

### Phase 5: Review

**Agent Capabilities:**

- Execute multi-agent code review
- Identify logic errors and anti-patterns
- Check architectural alignment
- Surface security vulnerabilities

**Han Plugins:**

- `bushido` - `/review` command (multi-agent review)
- `bushido` - `code-reviewer` skill
- `do-*` agents - Domain-specific review
- `hashi-github` - PR integration

**Workflow:**

```bash
# Multi-agent review with confidence scoring
/bushido:review

# Agents:
# - Code Reviewer (general quality)
# - Security Analyst (vulnerabilities)
# - Performance Expert (bottlenecks)
# - Domain Expert (do-* agent)

# Only issues ≥80% confidence reported
```

**Engineer Ownership:**

- Final approval before merge
- Architectural trade-off decisions
- Breaking change assessment
- Long-term maintenance impact

---

### Phase 6: Document

**Agent Capabilities:**

- Summarize code functionality
- Generate system diagrams
- Update implementation docs
- Create API documentation

**Han Plugins:**

- `hashi-blueprints` - Technical blueprint system
  - Maintains `blueprints/` directory
  - Updates docs alongside code changes
  - Ensures accuracy through hooks
- `bushido` - `/document` command

**Workflow:**

```bash
# Automatic blueprint updates
# Agent updates blueprints/ when modifying systems

/bushido:document
# Agent generates comprehensive documentation

# Hook enforcement
hashi-blueprints: Ensure docs updated with code
```

**Engineer Ownership:**

- Documentation structure and standards
- Audience-appropriate content
- High-level system narratives
- Documentation strategy

---

### Phase 7: Deploy & Maintain

**Agent Capabilities:**

- Parse logs and correlate errors with commits
- Analyze performance regressions
- Propose hotfixes during incidents
- Track release health metrics

**Han Plugins:**

- **`hashi-sentry`** (NEW) - Sentry MCP integration
  - `/investigate-errors` - Error triage and analysis
  - `/analyze-performance` - Performance debugging
  - `/check-releases` - Release health monitoring
  - `/incident-response` - Coordinated incident handling
  - `/query-events` - Custom event queries
- `hashi-github` - Deployment workflows

**Workflow:**

```bash
# Production error spike detected
/investigate-errors
# Agent analyzes patterns, stack traces, affected users

# Performance regression
/analyze-performance
# Agent identifies slow transactions and bottlenecks

# Release validation
/check-releases
# Agent compares error rates across deployments

# Critical incident
/incident-response
# Agent coordinates investigation with Seer AI integration
```

**Engineer Ownership:**

- Production change approval
- Incident response strategy
- Post-mortem analysis
- Prevention measures

## Universal Delegation Framework

Across all phases, Han follows a consistent responsibility model:

| Level | Responsibility | Examples |
|-------|---------------|----------|
| **Delegate** | Well-specified, repetitive work | Code generation, test writing, doc updates |
| **Review** | Quality validation, context checking | PR review, test coverage, doc accuracy |
| **Own** | Strategic decisions, novel problems | Architecture, security model, tradeoffs |

## SDLC Coverage Matrix

| Phase | Coverage | Primary Plugins | Missing Capabilities |
|-------|----------|-----------------|---------------------|
| Plan | ✅ Full | bushido, do-* | None |
| Design | ✅ Full | **hashi-figma** | None (newly added) |
| Build | ✅ Full | jutsu-*, do-*, bushido | None |
| Test | ✅ Full | jutsu-tdd, hashi-playwright-mcp | None |
| Review | ✅ Full | bushido, do-* | None |
| Document | ✅ Full | hashi-blueprints | None |
| Deploy & Maintain | ✅ Full | **hashi-sentry** | None (newly added) |

**Status**: 7/7 phases covered (100%)

## Gaps Addressed (December 2025)

Based on analysis against OpenAI's SDLC framework, two critical gaps were identified and resolved:

### 1. Design Phase (Resolved)

**Gap**: No integration with design tools

**Solution**: Created `hashi-figma` plugin

- Connects to Figma's official MCP server
- Provides frame-to-code generation
- Syncs design tokens and components
- Zero-config authentication

### 2. Deploy & Maintain Phase (Resolved)

**Gap**: No observability/monitoring integration

**Solution**: Created `hashi-sentry` plugin

- Connects to Sentry's official MCP server (remote HTTP)
- Provides error tracking and performance monitoring
- Integrates with Seer AI for root cause analysis
- OAuth authentication, 16+ tools

## Future Enhancement Opportunities

While all seven SDLC phases are now covered, potential additions include:

1. **Additional Design Tools**
   - `hashi-figma-tokens` - Design Tokens Studio integration
   - `hashi-storybook` - Component documentation sync

2. **Additional Observability**
   - `hashi-datadog` - Infrastructure monitoring
   - `hashi-pagerduty` - Incident management
   - `hashi-honeycomb` - Distributed tracing

3. **Metrics Collection**
   - Built-in tracking of agent performance
   - Quality metrics dashboard
   - Review signal-to-noise ratio measurement

## Alignment with OpenAI Framework

Han's implementation aligns with OpenAI's principles:

✅ **Unified context** - CLAUDE.md, blueprints/, skills/
✅ **Structured tool execution** - Hooks with validation
✅ **Persistent project memory** - Blueprints documentation
✅ **Evaluation loops** - Automatic hook validation
✅ **Start small** - Focused, single-purpose plugins
✅ **Establish guardrails** - CLAUDE.md + hooks.json
✅ **Create feedback loops** - Hook execution with quality gates
✅ **Invest in examples** - Skills with curated patterns
✅ **Measure quality** - hashi-han-metrics tracks success rates, calibration, and trends

## Related Blueprints

- [Plugin Types](./plugin-types.md) - Understanding plugin categories
- [Hook System](./hook-system.md) - How quality enforcement works
- [MCP Server](./mcp-server.md) - External integrations via MCP

## References

- [OpenAI Codex: Build AI-Native Engineering Teams](https://developers.openai.com/codex/guides/build-ai-native-engineering-team/)
- [Figma MCP Server Documentation](https://developers.figma.com/docs/figma-mcp-server/)
- [Sentry MCP Server Documentation](https://docs.sentry.io/product/sentry-mcp/)
