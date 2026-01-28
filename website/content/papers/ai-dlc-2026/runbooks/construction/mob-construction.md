# Mob Construction

> **Construction Phase** | Parallel execution of multiple Units with coordination

## System Prompt

```markdown

You are participating in Mob Construction for AI-DLC 2026.

## Your Unit

${UNIT_SPECIFICATION}

## Your Completion Criteria

${COMPLETION_CRITERIA}

## Integration Contracts

### You Depend On (Upstream)

${UPSTREAM_CONTRACTS}

### Others Depend On You (Downstream)

${DOWNSTREAM_CONTRACTS}

## Relevant Principles

- **Units are independently deployable**: Your work shouldn't block others
- **Integration contracts are boundaries**: Honor them; changes require coordination
- **Parallel execution**: Other Units are being built simultaneously

## Operating Mode

${SELECTED_MODE} (Supervised/Observed/Autonomous)

## Coordination Protocol

### Contract Changes

If you need to change an integration contract:

1. STOP work
2. Document the proposed change and rationale
3. Output: `CONTRACT_CHANGE_REQUEST: ${contract_name}`
4. Wait for human coordination
5. Resume only after contract change is agreed

### Dependency Waiting

If upstream contract isn't ready:

1. Build against the contract specification (mock/stub if needed)
2. Note the dependency in `.agent/dependencies.md`
3. Continue with your work
4. Integration tests will validate when upstream is ready

### Contract Fulfillment

When you complete a contract others depend on:

1. Output: `CONTRACT_READY: ${contract_name}`
2. Ensure integration tests exist for the contract
3. Continue with remaining work

## Process

1. Read your Unit spec and integration contracts
2. Identify upstream dependencies
3. Build against contracts (mock if needed)
4. Implement your Unit per selected mode
5. Signal contract readiness for downstream
6. Complete remaining criteria
7. Output completion signal

## Constraints

- Honor integration contracts exactly
- Contract changes require coordination checkpoint
- Your Unit must be independently testable
- Commit frequently for visibility

```

---

## Entry Criteria

You have:

- **Multiple Units** ready for parallel construction
- **Integration contracts** defined between Units
- **Teams/agents** assigned to each Unit
- **Mode selected** for each Unit
- Coordination mechanism in place (shared channel, checkpoint ritual)

## When to Use Mob Construction

| Scenario | Why Mob Construction |
|----------|----------------------|
| Large feature with multiple components | Parallel work reduces total time |
| Cross-functional teams | FE, BE, data can work simultaneously |
| Time-sensitive delivery | Can't afford sequential execution |
| Independent Units identified | Mob Elaboration produced clean boundaries |

## The Activity

### Parallel Execution Model

```
        ┌─────────────────────────────────────────────┐
        │           Mob Construction                   │
        ├─────────────────────────────────────────────┤
        │                                             │
        │   Unit A          Unit B          Unit C    │
        │   (Team 1)        (Team 2)        (Team 3)  │
        │      │               │               │      │
        │      ▼               ▼               ▼      │
        │   ┌─────┐        ┌─────┐        ┌─────┐    │
        │   │Bolt │        │Bolt │        │Bolt │    │
        │   │ A.1 │        │ B.1 │        │ C.1 │    │
        │   └──┬──┘        └──┬──┘        └──┬──┘    │
        │      │               │               │      │
        │      ▼               ▼               ▼      │
        │   ┌─────┐        ┌─────┐        ┌─────┐    │
        │   │Bolt │        │Bolt │        │Bolt │    │
        │   │ A.2 │        │ B.2 │        │ C.2 │    │
        │   └─────┘        └─────┘        └─────┘    │
        │                                             │
        │      │               │               │      │
        │      └───────────────┼───────────────┘      │
        │                      ▼                      │
        │            Integration Checkpoint           │
        │                                             │
        └─────────────────────────────────────────────┘
```

### Integration Contracts

Contracts define boundaries between Units:

```markdown

## Contract: RecommendationAPI

### Provider: Backend Unit

### Consumer: Frontend Unit

### Specification

```graphql
type Query {
  recommendations(userId: ID!): [Product!]!
}

type Product {
  id: ID!
  name: String!
  price: Float!
  relevanceScore: Float!
}
```

### Guarantees

- Response time: <100ms p99
- Availability: Contract stable until integration checkpoint

### Consumer Expectations

- Will call with valid userId
- Will handle empty array response
- Will handle network errors gracefully

```

### Working Against Contracts

When your upstream isn't ready:

```typescript

// Build against the contract, not the implementation
// Use mocks/stubs until real service is ready

const mockRecommendations = [
  { id: "1", name: "Product A", price: 29.99, relevanceScore: 0.95 },
  { id: "2", name: "Product B", price: 19.99, relevanceScore: 0.87 },
];

// Your tests run against this mock
// Integration tests will run against real service later

```

### Contract Change Protocol

```
Developer discovers contract needs to change
           ↓
STOP: Don't make the change unilaterally
           ↓
Document: What change? Why? Impact?
           ↓
Signal: CONTRACT_CHANGE_REQUEST
           ↓
Coordinate: Human facilitates discussion
           ↓
Agree: All affected Units accept change
           ↓
Update: Contract spec updated
           ↓
Resume: All Units continue with new contract
```

### Checkpoint Ritual

Periodic synchronization (daily or milestone-based):

```markdown

## Mob Construction Checkpoint

### Unit Status

| Unit | Status | Blocker | Contract Status |
|------|--------|---------|-----------------|
| Data Collection | 80% | None | ✅ Ready |
| Recommendation Model | 60% | Waiting on data format | ⏳ In Progress |
| API Integration | 40% | None | ⏳ In Progress |
| Frontend | 30% | Waiting on API | 🔲 Not Started |

### Contract Changes Proposed

- [ ] Add `category` field to Product type (API → FE)

### Decisions Needed

- Approve category field addition?
- Adjust timeline for Model Unit?

### Next Checkpoint

Tomorrow 10am or when API contract ready

```

## Exit Criteria

- All **Units complete** their criteria
- All **contracts fulfilled** and tested
- **Integration tests pass** across Unit boundaries
- No **pending contract changes**

## Handoff Artifacts

| Artifact | Purpose |
|----------|---------|
| Completed Units | Ready for integration |
| Integration test results | Proof contracts work |
| Contract documentation | Reference for future work |

## Common Failure Modes

### 1. Uncoordinated Contract Changes

**Symptom:** One team changes contract, breaks others.
**Impact:** Rework, frustration, integration failures.
**Fix:** Contract changes require checkpoint. No unilateral changes.

### 2. Blocking on Upstream

**Symptom:** Team waits for real service instead of mocking.
**Impact:** Parallel work becomes sequential.
**Fix:** Build against contracts, not implementations. Mock freely.

### 3. Integration Discovered Late

**Symptom:** Units work in isolation, fail at integration.
**Impact:** Last-minute chaos, deadline slip.
**Fix:** Regular checkpoints. Integration tests early.

### 4. Scope Creep Across Units

**Symptom:** Unit A starts doing Unit B's work.
**Impact:** Duplication, conflicts, unclear ownership.
**Fix:** Strict Unit boundaries. Contracts define interfaces.

### 5. No Contract Tests

**Symptom:** Contracts defined but not tested.
**Impact:** Drift between contract and implementation.
**Fix:** Contract tests are completion criteria for both provider and consumer.
