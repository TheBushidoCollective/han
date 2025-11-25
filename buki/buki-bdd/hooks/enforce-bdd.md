# Behavior-Driven Development Enforcement

**CRITICAL: When implementing features or user-facing behavior, follow BDD principles.**

## Discovery → Development → Delivery

### 1. DISCOVERY: Understand Requirements

- Collaborate with stakeholders (Three Amigos)
- Use concrete examples to clarify requirements
- Document examples as scenarios in Gherkin
- Build shared understanding before coding

### 2. DEVELOPMENT: Implement with Examples

- Write failing scenario (acceptance test) first
- Implement using outside-in TDD
- Use scenarios as specifications
- Keep scenarios executable and up-to-date

### 3. DELIVERY: Validate Behavior

- Run scenarios to verify behavior
- Ensure living documentation stays current
- Validate against real business requirements
- Confirm value delivery to stakeholders

## When BDD Applies

✅ **ALWAYS use BDD for:**

- User-facing features
- Business rule implementation
- Integration scenarios
- API contracts
- End-to-end workflows
- Cross-team collaboration needs

❌ **Skip BDD for:**

- Internal utility functions (use TDD)
- Performance optimizations
- Infrastructure code
- Developer tools

## Gherkin Scenario Structure

```gherkin
Feature: [Feature name]
  [Feature description]

  Scenario: [Scenario name]
    Given [context/precondition]
    When [action/event]
    Then [expected outcome]
```

## Outside-In Development

1. **Write failing scenario** (acceptance test at feature level)
2. **Write failing unit test** (for layer you're implementing)
3. **Write minimum code** to make unit test pass
4. **Refactor**
5. **Repeat** until scenario passes

```
Scenario (Fails) → Unit Test (Fails) → Code → Unit Test (Passes) → Scenario (Passes)
```

## Critical Rules

1. **Start with examples** - Don't code until you have concrete examples
2. **Use ubiquitous language** - Business terms, not technical jargon
3. **Focus on behavior** - What the system does, not how it does it
4. **Collaborate early** - Involve business, dev, and QA in discovery
5. **Keep scenarios maintainable** - Clear, focused, and easy to update
6. **Scenarios are living documentation** - Keep them current

## Three Amigos Questions

Before implementing, consider:

- **Business**: What value does this provide? What are the business rules?
- **Development**: What are technical constraints? What are edge cases?
- **Testing**: What could go wrong? How do we verify this works?

## Verification Checklist

Before considering a feature complete:

- [ ] Wrote scenarios based on concrete examples
- [ ] Validated scenarios with stakeholders
- [ ] Implemented using outside-in TDD
- [ ] All scenarios pass
- [ ] Scenarios serve as living documentation

**Remember: Start with conversation and examples, not code!**
