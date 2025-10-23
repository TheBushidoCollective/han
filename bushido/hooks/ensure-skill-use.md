# Ensure Proper Skill Usage

Before implementing features or making decisions, consider if
existing Bushido skills can guide your approach.

## Available Bushido Skills

The `bushido` plugin provides these core skills:

### Quality & Testing

**`bushido:proof-of-work`**

- Enforce concrete evidence when making claims
- Show actual command output, not assertions
- Verify before claiming completion
- Use when: Making claims about tests, builds, or validations

**`bushido:test-driven-development`**

- Write failing tests before implementation
- Red-Green-Refactor cycle
- Use when: Implementing new features or fixing bugs

**`bushido:code-reviewer`**

- Systematic code review process
- Quality inspection framework
- Use when: After writing significant code

### Design Principles

**`bushido:solid-principles`**

- Single Responsibility, Open/Closed, Liskov Substitution,
  Interface Segregation, Dependency Inversion
- Use when: Designing classes and modules

**`bushido:simplicity-principles`**

- KISS (Keep It Simple), YAGNI (You Aren't Gonna Need It)
- Use when: Avoiding over-engineering

**`bushido:structural-design-principles`**

- Composition Over Inheritance, Law of Demeter, Tell Don't Ask
- Use when: Designing object interactions

**`bushido:orthogonality-principle`**

- Create independent, composable components
- Reduce coupling, increase cohesion
- Use when: Designing system architecture

### Process

**`bushido:professional-honesty`**

- Prioritize technical accuracy over validation
- Disagree when necessary
- Use when: Reviewing user assumptions or design decisions

**`bushido:baseline-restorer`**

- Restore to working baseline instead of debugging further
- Use when: Stuck in debugging rabbit holes

**`bushido:boy-scout-rule`**

- Leave code better than you found it
- Use when: Making changes to existing code

## When to Invoke Skills

**Before Implementation:**
Announce which principles/skills apply to the current task.

**During Implementation:**
Reference skills when making design decisions.

**After Implementation:**
Use code-reviewer skill for quality inspection.

## Example

```text
User: "Add user authentication"
Assistant: "Applicable skills: solid-principles, test-driven-development"
```
