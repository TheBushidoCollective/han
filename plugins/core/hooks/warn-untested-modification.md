# CRITICAL: Modifying Untested Code

<important priority="critical">

## DANGER: Are You About to Change Code Without Tests?

**STOP.** Before modifying, deleting, or refactoring existing code:

### Pre-Modification Checklist

- [ ] **Check test coverage** - Does this code have tests?
- [ ] **Run existing tests** - Are they passing?
- [ ] **Identify behaviors** - What does this code currently do?
- [ ] **Check language type** - Dynamic language = EXTREME CAUTION

### High-Risk Languages

**Python, JavaScript, Ruby, PHP:**

- NO compiler safety net
- NO type checking
- Tests are your ONLY protection
- Mistakes appear at runtime, not compile time

### Required Workflow: RGR (Red-Green-Refactor)

**If code lacks tests, you MUST:**

1. **RED**: Write characterization tests for current behavior
2. **GREEN**: Verify all tests pass (proves you captured reality)
3. **REFACTOR**: NOW you can safely modify with protection

**This is NOT optional.** Changing untested code is like surgery blindfolded.

### Invoke the Skill

For detailed guidance on characterization testing and the RGR workflow:

**Use the `legacy-code-safety` skill IMMEDIATELY.**

### No Shortcuts

NEVER think:

- "It's just a small change"
- "I'll add tests later"
- "The code is too complex to test"
- "We don't have time for tests"

These are rationalizations for dangerous behavior.

### Remember

**Untested code + Changes = Hidden bugs**

**Tests first, changes second. No exceptions.**

</important>
