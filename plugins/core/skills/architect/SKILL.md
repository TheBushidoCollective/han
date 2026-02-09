---
name: architect
description: Design system architecture and high-level technical strategy
disable-model-invocation: false
---

# architect

## Name

han-core:architect - Design system architecture and high-level technical strategy

## Synopsis

```
/architect [arguments]
```

## Description

Design system architecture and high-level technical strategy

## Implementation

Design system architecture, technical strategy, and high-level structure for significant features or system changes.

## Process

Use the architecture-design skill from bushido to:

1. **Understand business goals**: What problem are we solving?
2. **Gather requirements**: Functional and non-functional requirements
3. **Analyze constraints**: Technical, time, resource limitations
4. **Research patterns**: What approaches exist? What have others done?
5. **Design architecture**: Components, interactions, data flow
6. **Document decisions**: ADRs (Architecture Decision Records)
7. **Create diagrams**: Visual representation of architecture
8. **Identify risks**: Technical debt, scalability, security concerns

## Architecture vs Planning

**Use /architect when:**

- Significant system change (new subsystem, major refactor)
- Affects multiple components or teams
- Long-term technical strategy needed
- Need to evaluate multiple approaches
- Decisions have broad impact

**Use /plan when:**

- Implementing specific feature within existing architecture
- Tactical execution planning
- Breaking down known work
- Architecture is already decided

## Architecture Principles

**Good architecture is:**

- **Simple**: Complexity only where necessary
- **Flexible**: Can adapt to changing requirements
- **Maintainable**: Others can understand and modify
- **Scalable**: Can handle growth
- **Tested**: Can be validated

**Apply these skills:**

- `solid-principles` - Single Responsibility, Open/Closed, etc.
- `simplicity-principles` - KISS, YAGNI
- `orthogonality-principle` - Independent components
- `structural-design-principles` - Composition over inheritance

## Architecture Document Structure

```markdown
# Architecture Design: [System/Feature Name]

## Context

### Problem Statement
[What business problem are we solving?]

### Goals
[What are we trying to achieve?]

### Non-Goals
[What are we explicitly NOT trying to achieve?]

### Requirements

**Functional:**
- [Requirement 1]
- [Requirement 2]

**Non-Functional:**
- Performance: [e.g., < 200ms response time]
- Scalability: [e.g., handle 10k concurrent users]
- Security: [e.g., PCI compliance]
- Maintainability: [e.g., easy to modify]

### Constraints
[Technical, time, resource, or business constraints]

## Current Architecture
[What exists today? What needs to change?]

## Proposed Architecture

### High-Level Design

[Diagram or description of system components]

```

┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Client    │────▶│   API       │────▶│  Database    │
└─────────────┘     └─────────────┘     └──────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Cache      │
                    └─────────────┘

```

### Components

#### Component A
**Responsibility:** [What it does]
**Interface:** [How others interact with it]
**Dependencies:** [What it depends on]
**Technology:** [Implementation stack]

#### Component B
[Similar structure...]

### Data Flow
[How data moves through the system]

### API Design
[Key endpoints, schemas, contracts]

### Data Model
[Database schema, key entities]

### Security Model
[Authentication, authorization, data protection]

## Alternative Approaches Considered

### Alternative 1: [Approach name]
**Pros:**
- [Advantage 1]
- [Advantage 2]

**Cons:**
- [Disadvantage 1]
- [Disadvantage 2]

**Why not chosen:** [Reasoning]

### Alternative 2: [Another approach]
[Similar structure...]

## Decision Rationale

### Why This Architecture?
[Explain the key decisions and trade-offs]

### Trade-offs Accepted
[What we gave up for what benefits]

### Assumptions
[What we're assuming to be true]

## Implementation Strategy

### Phase 1: [Foundation]
[What to build first]

### Phase 2: [Core Features]
[Next phase]

### Phase 3: [Enhancement]
[Final phase]

### Migration Strategy
[If replacing existing system, how to transition?]

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| [Risk 1] | High | Medium | [How to mitigate] |
| [Risk 2] | Medium | Low | [How to mitigate] |

## Testing Strategy
[How will we validate this architecture?]

## Monitoring & Observability
[How will we know if it's working?]

## Success Metrics
[How will we measure success?]

## Open Questions
[What still needs to be resolved?]

## References
[Links to research, related docs, RFCs]
```

## Architecture Decision Record (ADR)

For each major decision, create an ADR:

```markdown
# ADR-001: [Decision Title]

**Status:** Proposed | Accepted | Deprecated | Superseded

**Date:** YYYY-MM-DD

## Context
[What forces are at play? What needs to be decided?]

## Decision
[What was decided?]

## Consequences
**Positive:**
- [Benefit 1]
- [Benefit 2]

**Negative:**
- [Trade-off 1]
- [Trade-off 2]

## Alternatives Considered
[Other options and why they weren't chosen]
```

## Examples

When the user says:

- "Design the architecture for our multi-tenant system"
- "How should we structure our microservices?"
- "Plan the technical approach for real-time notifications"
- "Design the data model for our marketplace"
- "Create architecture for migrating from monolith to services"

## Architectural Patterns to Consider

**System Patterns:**

- Layered architecture
- Microservices vs monolith
- Event-driven architecture
- CQRS (Command Query Responsibility Segregation)
- Hexagonal architecture

**Data Patterns:**

- Database per service
- Shared database
- Event sourcing
- CQRS
- Cache-aside

**Integration Patterns:**

- API Gateway
- Service mesh
- Message queue
- Pub/sub
- GraphQL federation

## Architecture Review Checklist

- [ ] Business goals clearly defined
- [ ] Requirements (functional & non-functional) documented
- [ ] Constraints identified
- [ ] Multiple approaches considered
- [ ] Trade-offs explicitly stated
- [ ] Components and interactions clear
- [ ] Data flow documented
- [ ] Security model defined
- [ ] Scalability addressed
- [ ] Testing strategy included
- [ ] Risks identified with mitigation
- [ ] Success metrics defined
- [ ] Implementation phases outlined

## Notes

- Use TodoWrite to track architecture design steps
- Apply all relevant design principle skills
- Create diagrams (ASCII art or reference drawing tools)
- Architecture evolves - document decisions and changes
- Consider using /plan for detailed implementation after architecture is approved
- Archive decisions as ADRs for future reference
