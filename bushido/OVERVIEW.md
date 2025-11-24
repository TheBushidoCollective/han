# Bushido Plugin Overview

A comprehensive collection of development commands and skills for Claude Code, following the Bushido code philosophy.

## Architecture

The bushido plugin follows the **Commands + Skills** pattern:

- **Commands** (`bushido/commands/`): Quick, frequently-used prompts that orchestrate workflows
- **Skills** (`bushido/skills/`): Comprehensive capabilities with systematic processes and patterns

Commands invoke skills to provide structured, consistent approaches to common development tasks.

## Commands

### Development Workflow

| Command | Purpose | Primary Skill |
|---------|---------|---------------|
| `/develop` | General-purpose feature development | multiple |
| `/fix` | Bug fixing workflow (reproduce → investigate → fix → verify → prevent) | debugging |
| `/debug` | Investigation and diagnosis (separate from fixing) | debugging |
| `/refactor` | Safe code restructuring with tests as safety net | refactoring |
| `/test` | Test-driven development (Red-Green-Refactor) | test-driven-development |

### Planning & Architecture

| Command | Purpose | Primary Skill |
|---------|---------|---------------|
| `/plan` | Tactical implementation planning (tasks, dependencies, estimates) | technical-planning |
| `/architect` | Strategic architecture design (components, patterns, ADRs) | architecture-design |

### Quality & Understanding

| Command | Purpose | Primary Skill |
|---------|---------|---------------|
| `/code-review` | Multi-agent PR review with proof-of-work verification | code-reviewer |
| `/optimize` | Measurement-driven performance optimization | performance-optimization |
| `/explain` | Create clear, audience-appropriate explanations | explainer |
| `/document` | Generate documentation (READMEs, API docs, guides) | documentation |

### Legacy Command

| Command | Purpose | Notes |
|---------|---------|-------|
| `/review` | Original review command | Consider if this should be removed or if it serves a different purpose than `/code-review` |

## Skills

### Development Practices

- **test-driven-development**: Red-Green-Refactor cycle, write tests first
- **refactoring**: Safe code restructuring (one change at a time, tests as safety net)
- **debugging**: Scientific method for bug investigation (observe → hypothesis → test → analyze)
- **boy-scout-rule**: Leave code better than you found it
- **proof-of-work**: Evidence-based verification (show, don't tell)

### Design Principles

- **solid-principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **simplicity-principles**: KISS, YAGNI, Principle of Least Astonishment
- **orthogonality-principle**: Independent components where changes don't ripple
- **structural-design-principles**: Composition over Inheritance, Law of Demeter, Tell Don't Ask, Encapsulation

### Planning & Architecture

- **technical-planning**: Tactical execution planning (requirements → tasks → dependencies → estimates)
- **architecture-design**: Strategic system design (context → alternatives → design → ADRs)

### Quality & Communication

- **code-reviewer**: Systematic code review process
- **performance-optimization**: Measurement-driven optimization (profile → identify → optimize → measure)
- **explainer**: Clear explanation techniques (start broad → narrow)
- **documentation**: Documentation types and templates (READMEs, API docs, guides, ADRs)
- **professional-honesty**: Direct, objective technical communication

### Recovery

- **baseline-restorer**: Systematic restoration to working baseline after multiple failed fix attempts

## Command → Skill Mapping

### Single Skill Commands

- `/test` → test-driven-development
- `/debug` → debugging
- `/fix` → debugging
- `/refactor` → refactoring
- `/plan` → technical-planning
- `/architect` → architecture-design
- `/explain` → explainer
- `/optimize` → performance-optimization
- `/document` → documentation
- `/code-review` → code-reviewer

### Multi-Skill Commands

- `/develop` uses:
  - test-driven-development (write tests)
  - simplicity-principles (keep it simple)
  - solid-principles (good design)
  - boy-scout-rule (improve as you go)
  - proof-of-work (verify it works)

## Skill Cross-References

Skills reference each other to create a knowledge network:

```
documentation
  └─→ explainer (clear explanations)
  └─→ proof-of-work (verify examples work)
  └─→ architecture-design (architecture docs)
  └─→ technical-planning (implementation guides)

architecture-design
  └─→ solid-principles (component design)
  └─→ simplicity-principles (KISS, YAGNI)
  └─→ orthogonality-principle (independent components)
  └─→ structural-design-principles (composition patterns)
  └─→ technical-planning (implementation after design)

refactoring
  └─→ boy-scout-rule (leave code better)
  └─→ simplicity-principles (keep it simple)
  └─→ solid-principles (single responsibility)
  └─→ structural-design-principles (composition, encapsulation)
  └─→ test-driven-development (add tests if missing)
  └─→ proof-of-work (verify tests still pass)
  └─→ code-reviewer (review refactored code)

debugging
  └─→ proof-of-work (document evidence)
  └─→ test-driven-development (add regression test)
  └─→ explainer (explain bug to others)
  └─→ boy-scout-rule (improve while fixing)

technical-planning
  └─→ simplicity-principles (keep plan simple)
  └─→ architecture-design (high-level structure)
  └─→ test-driven-development (include testing)
  └─→ solid-principles, structural-design-principles (implementation guidance)
```

## Key Patterns

### Evidence-Based Development

The bushido plugin emphasizes **proof-of-work**:
- Don't claim tests pass without showing output
- Don't say you analyzed code without specific findings
- Show file paths, line numbers, concrete examples
- Verify agent work before proceeding

### Incremental Improvement

Many skills embody the **boy scout rule**:
- Leave code better than you found it
- Small improvements accumulate
- Fix obvious issues while working
- Add missing tests

### Safety Through Testing

Multiple skills emphasize **tests as safety net**:
- Refactoring: tests must pass before and after
- Debugging: add regression tests after fixing
- TDD: write tests first
- Optimization: tests ensure correctness preserved

### Simplicity First

Several skills reinforce **simplicity principles**:
- Start simple, add complexity when needed
- YAGNI: You Aren't Gonna Need It
- Don't over-engineer
- Simple is easier to maintain

### Measurement Over Guessing

Performance and debugging skills emphasize **data-driven decisions**:
- Profile before optimizing
- Measure impact of changes
- Gather evidence systematically
- Question assumptions with data

## Usage Examples

### Feature Development
```bash
# Plan the feature
/plan [describe feature]

# Implement with TDD
/develop [start implementing]

# Optimize if needed
/optimize [specific performance issue]

# Document
/document [what needs documenting]

# Review
/code-review
```

### Bug Fixing
```bash
# Investigate
/debug [describe issue]

# Fix with verification
/fix [implement solution]

# Add regression test
/test [create test for bug]
```

### Architecture Work
```bash
# Design system
/architect [describe system needs]

# Plan implementation
/plan [based on architecture]

# Document decisions
/document [create ADR]
```

### Code Quality
```bash
# Refactor safely
/refactor [what to improve]

# Review changes
/code-review

# Explain complex parts
/explain [what needs explanation]
```

## Principles Summary

The bushido plugin embodies these core principles:

1. **Evidence over claims** (proof-of-work)
2. **Tests as safety net** (TDD, refactoring)
3. **Simplicity first** (KISS, YAGNI)
4. **Measurement over guessing** (profiling, debugging)
5. **Incremental improvement** (boy scout rule)
6. **Strategic thinking** (architecture before implementation)
7. **Clear communication** (explainer, documentation)
8. **Design principles** (SOLID, orthogonality, composition)

## File Structure

```
bushido/
├── PLUGIN.md                          # Plugin metadata
├── OVERVIEW.md                        # This file
├── commands/                          # Slash commands (orchestration)
│   ├── architect.md                   # Strategic architecture design
│   ├── code-review.md                 # Multi-agent PR review
│   ├── debug.md                       # Investigation and diagnosis
│   ├── develop.md                     # General feature development
│   ├── document.md                    # Documentation generation
│   ├── explain.md                     # Clear explanations
│   ├── fix.md                         # Bug fixing workflow
│   ├── optimize.md                    # Performance optimization
│   ├── plan.md                        # Implementation planning
│   ├── refactor.md                    # Code restructuring
│   ├── review.md                      # Legacy review command
│   └── test.md                        # Test-driven development
└── skills/                            # Skills (systematic processes)
    ├── architecture-design/
    │   └── SKILL.md                   # System design methodology
    ├── baseline-restorer/
    │   └── SKILL.md                   # Recovery from failed fixes
    ├── boy-scout-rule/
    │   └── SKILL.md                   # Leave code better
    ├── code-reviewer/
    │   └── SKILL.md                   # Code review process
    ├── debugging/
    │   └── SKILL.md                   # Bug investigation
    ├── documentation/
    │   └── SKILL.md                   # Documentation creation
    ├── explainer/
    │   └── SKILL.md                   # Clear explanations
    ├── orthogonality-principle/
    │   └── SKILL.md                   # Independent components
    ├── performance-optimization/
    │   └── SKILL.md                   # Optimization methodology
    ├── professional-honesty/
    │   └── SKILL.md                   # Direct communication
    ├── proof-of-work/
    │   └── SKILL.md                   # Evidence-based verification
    ├── refactoring/
    │   └── SKILL.md                   # Safe restructuring
    ├── simplicity-principles/
    │   └── SKILL.md                   # KISS, YAGNI
    ├── solid-principles/
    │   └── SKILL.md                   # SOLID design
    ├── structural-design-principles/
    │   └── SKILL.md                   # Composition, encapsulation
    ├── technical-planning/
    │   └── SKILL.md                   # Implementation planning
    └── test-driven-development/
        └── SKILL.md                   # Red-Green-Refactor
```

## Next Steps

Consider:

1. **Remove or clarify `/review` command**: Is it redundant with `/code-review`?
2. **Add examples directory**: Real-world examples of command usage
3. **Create integration tests**: Verify commands properly invoke skills
4. **Document hook integration**: How bushido integrates with Claude Code hooks
5. **Add templates**: Starter templates for common scenarios (ADRs, etc.)
