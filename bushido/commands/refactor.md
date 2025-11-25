---
description: Restructure code to improve quality without changing behavior
disable-model-invocation: false
---

Improve code structure, readability, and maintainability without changing external behavior.

## Process

Use the refactoring skill from bushido to:

1. **Ensure tests exist**: Must have tests before refactoring (if not, add them first)
2. **Identify code smell**: What needs improvement?
3. **Plan refactoring**: What pattern/structure would be better?
4. **Make one change**: Small, focused refactorings
5. **Run tests**: Verify behavior unchanged
6. **Repeat**: Continue with next improvement
7. **Review**: Apply code-reviewer skill to final result

## Refactoring Golden Rules

**Safety first:**

- ✅ Tests exist and pass before starting
- ✅ Make one change at a time
- ✅ Run tests after each change
- ✅ Behavior must remain unchanged
- ✅ Commit after each successful refactoring

**When to refactor:**

- Code is hard to understand
- Duplication exists
- Functions are too long
- Classes have too many responsibilities
- Complexity is high

**When NOT to refactor:**

- No tests exist (add tests first)
- Under time pressure (defer to later)
- External behavior needs to change (that's not refactoring)

## Common Refactorings

**Extract Function:**

```typescript
// Before
function processOrder(order) {
  const tax = order.subtotal * 0.08
  const shipping = order.items.length > 5 ? 0 : 9.99
  const total = order.subtotal + tax + shipping
  return total
}

// After
function processOrder(order) {
  const tax = calculateTax(order.subtotal)
  const shipping = calculateShipping(order.items)
  return order.subtotal + tax + shipping
}

function calculateTax(subtotal) {
  return subtotal * 0.08
}

function calculateShipping(items) {
  return items.length > 5 ? 0 : 9.99
}
```

**Eliminate Duplication:**

```typescript
// Before
function formatUserName(user) {
  return `${user.firstName} ${user.lastName}`
}

function formatAuthorName(author) {
  return `${author.firstName} ${author.lastName}`
}

// After
function formatFullName(person) {
  return `${person.firstName} ${person.lastName}`
}
```

**Simplify Conditionals:**

```typescript
// Before
if (user.role === 'admin' || user.role === 'moderator' || user.role === 'super_admin') {
  // ...
}

// After
const PRIVILEGED_ROLES = ['admin', 'moderator', 'super_admin']

if (PRIVILEGED_ROLES.includes(user.role)) {
  // ...
}
```

## Examples

When the user says:

- "This function is too long and hard to understand"
- "Clean up this messy code"
- "Remove duplication between these modules"
- "Simplify this nested if/else logic"
- "Break this god class into smaller pieces"

## Refactoring Workflow

```bash
# 1. Ensure tests pass
npm test

# 2. Make ONE refactoring change
# (extract function, rename, remove duplication, etc.)

# 3. Run tests again
npm test

# 4. Commit
git add .
git commit -m "refactor: extract calculateTax function"

# 5. Repeat for next change
```

## Output Format

After refactoring:

```markdown
## Refactoring: [Brief description]

### Before
[Description of code smell or issue]

### Changes Made
- [Change 1 with reasoning]
- [Change 2 with reasoning]
- [Change 3 with reasoning]

### After
[How the code is better now]

### Verification
[Evidence that behavior unchanged - use proof-of-work skill]
- All tests pass: [test output]
- No functionality changed
- Code is more [readable/maintainable/simple]
```

## Notes

- Use TodoWrite to track refactoring steps
- Apply boy-scout-rule skill (leave code better than found)
- Apply simplicity-principles skill (KISS, YAGNI)
- Apply structural-design-principles as appropriate
- Use proof-of-work skill to verify tests still pass
- Commit after each successful refactoring
- If tests don't exist, use /test command first
