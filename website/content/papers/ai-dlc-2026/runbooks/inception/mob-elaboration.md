# Mob Elaboration

> **Inception Phase** | Collaborative requirements elaboration and decomposition

## System Prompt

````markdown

You are facilitating a Mob Elaboration session for AI-DLC 2026.

## Intent

${INTENT}

## Relevant Principles

- **Reimagine rather than retrofit**: We're not doing waterfall with AI assistance
- **Completion criteria enable autonomy**: Every criterion must be programmatically verifiable
- **Backpressure over prescription**: Define WHAT success looks like, not HOW to achieve it

## Your Role

Guide the team through structured requirements elaboration:

1. **Clarify** — Ask questions to resolve ambiguities in the Intent
2. **Decompose** — Break the Intent into cohesive Units
3. **Specify** — Generate programmatically verifiable Completion Criteria
4. **Plan** — Recommend Bolt modes for each Unit

## Process

### Phase 1: Clarification (DO NOT SKIP)

Ask 3-7 clarifying questions before proposing anything:

- Who are the primary users?
- What are the key success metrics?
- What constraints exist (technical, compliance, timeline)?
- What's explicitly in scope vs out of scope?
- What existing systems must this integrate with?
- What are the non-functional requirements (performance, security, accessibility)?

**Wait for answers before proceeding.**

### Phase 2: Decomposition

Propose Units that are:

- **Cohesive** — Related stories grouped together
- **Loosely coupled** — Minimal dependencies between Units
- **Independently deployable** — Can ship without other Units

For each Unit, provide:

- Clear description of scope and boundaries
- User stories in "As a [user], I want [goal], so that [benefit]" format
- Dependencies on other Units via `depends_on` field

**Unit Naming Convention:**

Units use a numerical index prefix followed by a meaningful slug:

- `unit-01-data-collection.md`
- `unit-02-model.md`
- `unit-03-api.md`
- `unit-04-frontend.md`

**Unit Dependencies form a DAG:**

```
unit-01-data-collection ──→ unit-02-model ──┐
                                            ├──→ unit-04-frontend
                       unit-03-api ─────────┘
```

- **Fan-out:** Units with no shared dependencies execute in parallel
- **Fan-in:** Units wait for ALL their upstream dependencies to complete
- **Ready check:** A unit is ready when all its `depends_on` units have status `completed`

### Phase 3: Completion Criteria

For each Unit, generate criteria that are:

- **Specific** — Unambiguous and precise
- **Measurable** — Quantifiable or binary
- **Verifiable** — Checkable by machine (tests, types, benchmarks)
- **Implementation-independent** — Define WHAT, not HOW

Bad: "Code is well-tested"
Good: "All tests pass with >80% coverage for src/[unit]/"

Bad: "API is performant"
Good: "API responds in <200ms p95 under 1000 req/s"

### Phase 4: Mode Recommendation

For each Unit, recommend one of:

| Mode | When to Use |
|------|-------------|
| **Supervised (HITL)** | Novel domain, high risk, architectural decisions, judgment required |
| **Observed (OHOTL)** | Subjective quality, creative/UX work, training scenarios |
| **Autonomous (AHOTL)** | Clear criteria, programmatic verification, established patterns |

Provide rationale for each recommendation.

## Output Artifacts

Save to `.ai-dlc/{intent-slug}/`:

- `INTENT.md` — Intent definition with business context
- `unit-01-{slug}.md` — Unit 1 with frontmatter (status, depends_on, branch)
- `unit-02-{slug}.md` — Unit 2 with frontmatter
- `...`

Each unit file contains:
- YAML frontmatter with `status`, `depends_on`, and `branch`
- Description of scope
- Completion criteria (verifiable conditions)

## Constraints

- Do NOT propose implementation details (no ERDs, no API schemas, no flowcharts)
- Do NOT skip clarification phase
- Every criterion must answer: "How would a machine verify this?"
- Integration boundaries between Units should be minimal contracts, not detailed specs

## Glossary

- **Intent**: High-level statement of purpose that serves as starting point
- **Unit**: Cohesive, independently deployable work element; named with numerical prefix + slug (e.g., `unit-01-data-collection`); can declare dependencies via `depends_on` forming a DAG
- **Unit DAG**: Directed Acyclic Graph of unit dependencies enabling parallel execution (fan-out) and convergence (fan-in)
- **Completion Criteria**: Programmatically verifiable conditions defining success
- **Bolt**: Smallest iteration cycle (supervised, observed, or autonomous)

See the [AI-DLC 2026 paper glossary](/papers/ai-dlc-2026#glossary) for complete terminology reference.

````

---

## Entry Criteria

You have:

- An **Intent** (high-level statement of purpose with business context)
- Access to stakeholders (Product Owner, developers, QA)
- AI agent available for facilitation

## The Activity

Mob Elaboration condenses weeks of sequential requirements work into hours through structured AI-human collaboration.

### Participants

| Role | Responsibility |
|------|----------------|
| Product Owner | Articulates intent, validates business alignment, approves scope |
| Developers | Refine technical aspects, validate feasibility, identify risks |
| QA/Stakeholders | Refine edge cases, risk scenarios, acceptance criteria |
| AI Agent | Asks clarifying questions, proposes structure, generates criteria |

### Flow

```

1. Human provides Intent
       ↓
2. AI asks clarifying questions
       ↓
3. Team provides context & answers
       ↓
4. AI proposes User Stories with acceptance criteria
       ↓
5. Developers refine technical aspects
       ↓
6. AI composes Units (cohesive groupings)
       ↓
7. Product Owner validates scope, adjusts boundaries
       ↓
8. AI generates Completion Criteria
       ↓
9. Team validates criteria are verifiable and complete
       ↓
10. AI proposes test scenarios
       ↓
11. QA refines edge cases
       ↓
12. AI outputs final plan with Bolt mode recommendations

```

### Example Intent

```markdown

## Intent: Product Recommendation Engine

Build a recommendation engine that suggests complementary
products based on purchase history and browsing behavior.

### Business Context

- E-commerce platform with 50,000 products
- 1 million monthly active users
- Need real-time recommendations (<100ms)
- Must integrate with existing product catalog API
- GDPR compliance required for EU users

```

### Example Clarifying Questions

> "Who are the primary users — all customers or specific segments?"
> "What recommendation approaches should we consider — collaborative filtering, content-based, or hybrid?"
> "Where should recommendations appear — product pages, cart, checkout, email?"
> "What's the cold-start strategy for new users with no history?"
> "Are there products that should never be recommended together?"
> "What's the expected click-through rate improvement target?"

### Example Unit Decomposition

| Unit | Scope | depends_on |
|------|-------|------------|
| unit-01-data-collection | Event capture, pipelines, user embeddings | [] |
| unit-02-model | ML training, inference, A/B framework | [unit-01-data-collection] |
| unit-03-api | Serving endpoint, catalog integration | [] |
| unit-04-frontend | Widget, analytics, accessibility | [unit-02-model, unit-03-api] |

```
unit-01-data-collection ──→ unit-02-model ──┐
                                            ├──→ unit-04-frontend (fan-in)
                       unit-03-api ─────────┘
```

unit-01 and unit-03 start in parallel (no dependencies). unit-02 waits for unit-01. unit-04 waits for BOTH unit-02 AND unit-03.

### Example Completion Criteria

```markdown
---
status: pending
depends_on: []
branch: ai-dlc/recommendation-engine/03-api
---
# unit-03-api

## Description
Real-time serving API integrated with product catalog.

## Completion Criteria

- [ ] GET /recommendations/{userId} returns product list
- [ ] Response includes product ID, name, price, relevance score
- [ ] Response time <100ms p99 under 1000 req/s
- [ ] Integration tests pass against catalog API
- [ ] Rate limiting: 1000 req/min/user
- [ ] Authentication via existing JWT tokens
- [ ] Coverage >80% for src/recommendations/
- [ ] Security scan: no critical/high findings
```

### Example Mode Recommendations

| Unit | Mode | Rationale |
|------|------|-----------|
| unit-01-data-collection | Autonomous | Clear criteria, established ETL patterns |
| unit-02-model | Supervised | Novel ML decisions, algorithm trade-offs |
| unit-03-api | Autonomous | Standard REST patterns, clear criteria |
| unit-04-frontend | Observed | UX decisions, accessibility judgment |

## Exit Criteria

You have:

- **Units** with clear boundaries and scope
- **User stories** with acceptance criteria
- **Completion Criteria** that are programmatically verifiable
- **Risk register** documenting concerns and mitigations
- **Bolt mode recommendations** with rationale
- **Integration boundaries** (minimal contracts between Units)
- **Stakeholder agreement** on scope

## Handoff Artifacts

| Artifact | Location | Consumer |
|----------|----------|----------|
| Intent definition | `.ai-dlc/{intent-slug}/INTENT.md` | Construction phase |
| Unit specifications | `.ai-dlc/{intent-slug}/unit-NN-{slug}.md` | Construction phase |
| Dependency graph | Embedded in unit frontmatter (`depends_on`) | Orchestrator |

## Common Failure Modes

### 1. Skipping Clarification

**Symptom:** AI produces Units from ambiguous intent without asking questions.
**Impact:** Units don't match actual needs; rework during Construction.
**Fix:** Enforce clarification phase. No decomposition without answers.

### 2. Non-Verifiable Criteria

**Symptom:** Criteria like "code is clean" or "API is fast."
**Impact:** Can't run autonomous bolts; human judgment required for everything.
**Fix:** For every criterion, ask "How would a machine check this?"

### 3. Tightly Coupled Units

**Symptom:** Units can't be built or deployed independently.
**Impact:** Parallel work blocked; integration hell.
**Fix:** Redraw boundaries until each Unit stands alone.

### 4. Over-Specification

**Symptom:** Detailed ERDs, full API schemas, implementation flowcharts.
**Impact:** Constrains Construction; prevents discovering better solutions.
**Fix:** Specify WHAT (outcomes), not HOW (implementation).

### 5. Wrong Mode Selection

**Symptom:** Autonomous bolts get stuck; Supervised bolts are unnecessarily slow.
**Impact:** Wasted time, frustrated teams.
**Fix:** Use the mode selection decision tree honestly.

### 6. Missing Integration Boundaries

**Symptom:** Units need to work together but no contract defined.
**Impact:** Integration failures discovered late; FE/BE frustration.
**Fix:** Define minimal contracts for Unit boundaries during Mob Elaboration.
