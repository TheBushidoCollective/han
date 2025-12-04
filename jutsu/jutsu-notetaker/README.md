# Jutsu: Notetaker

Structured note-taking and code annotation patterns for AI-assisted development. Helps AI assistants leave meaningful notes, TODO comments, and documentation links in codebases.

## What This Jutsu Provides

### Skills

This jutsu provides the following skills for AI-assisted note-taking and code annotation:

- **notetaker-fundamentals**: Structured note-taking patterns including AI-DEV-NOTE format, enhanced TODO comments, decision records, and context preservation for leaving development breadcrumbs
- **code-annotation-patterns**: Advanced annotation patterns with semantic tags for technical debt, security, performance, accessibility, testing, and change impact tracking
- **documentation-linking**: Bidirectional linking between code and documentation, maintaining synchronization between artifacts, and creating navigable documentation networks

## Philosophy

When AI assistants make changes to code, they should leave breadcrumbs for future AI assistants and human developers. This jutsu provides standardized patterns for:

- **Preserving context** about implementation decisions
- **Signaling uncertainty** where alternatives exist
- **Marking incomplete work** that needs follow-up
- **Linking to relevant context** (issues, PRs, docs)
- **Explaining non-obvious patterns** that might confuse readers

## Installation

Install via the Han marketplace:

```bash
npx @thebushidocollective/han plugin install jutsu-notetaker
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install jutsu-notetaker@han
```

## Core Patterns

### AI Development Notes

Special comment format for AI-to-AI communication:

```typescript
// AI-DEV-NOTE: This function uses a cache-first strategy because
// the data rarely changes and network calls were causing performance
// issues. See performance profiling in PR #123.
```

```python
# AI-DEV-NOTE: The validation order matters here - we must check
# authentication before authorization to avoid leaking user existence.
```

### Structured TODO Comments

Enhanced TODO format with context and actionable information:

```javascript
// TODO(ai/performance): This O(n²) loop should be optimized.
// Profiling shows 45% of request time spent here when n > 100.
// Consider: hash map lookup or binary search after sorting.
// Impact: High - affects main user flow
// Effort: Medium - 2-3 hours estimated
```

### Decision Records

Inline decision records for significant architectural choices:

```rust
// DECISION: Using Arc<RwLock<T>> instead of Mutex<T>
// RATIONALE: Read-heavy workload (95% reads, 5% writes) benefits
// from RwLock's concurrent read access. Benchmarks showed 3x throughput
// improvement with RwLock under typical load patterns.
// ALTERNATIVES_CONSIDERED:
//   - Mutex<T>: Simpler but slower for read-heavy workload
//   - atomic types: Not suitable for complex state
// DATE: 2025-12-04
// AUTHOR: Claude (AI Assistant)
```

### Code Annotations

Structured metadata for tracking technical debt, security, performance:

```typescript
/**
 * @ai-tech-debt
 * @category: Architecture
 * @severity: High
 * @effort: 2-3 days
 * @impact: Maintainability, Performance
 *
 * This service class has grown to 1500+ lines and violates Single
 * Responsibility Principle. Should be split into separate services.
 */
```

### Documentation Links

Bidirectional links between code and documentation:

```python
# @doc docs/architecture/authentication.md#oauth-flow
# @api-spec api/openapi.yaml#/components/securitySchemes/oauth2
# @decision-record docs/decisions/003-oauth-provider.md
#
# Implements the authentication flow described in architecture docs.
```

## Note Categories

### TODO Categories

- `ai/refactor` - Code structure improvements
- `ai/performance` - Optimization opportunities
- `ai/security` - Security considerations
- `ai/accessibility` - A11y improvements
- `ai/testing` - Test coverage gaps
- `ai/docs` - Documentation needs
- `ai/context` - Context preservation
- `ai/edge-case` - Unhandled edge cases

### Annotation Tags

- `@ai-tech-debt` - Technical debt tracking
- `@ai-security` - Security concerns
- `@ai-performance` - Performance issues
- `@ai-a11y` - Accessibility gaps
- `@ai-testing` - Test coverage
- `@ai-pattern` - Design pattern usage
- `@ai-uncertain` - Areas needing review

## Best Practices

### Do

✅ Provide specific, actionable context

```javascript
// AI-DEV-NOTE: Order validation must happen before inventory check
// to prevent race condition where items are reserved but invalid
```

✅ Explain the "why" not the "what"

```python
# AI-DEV-NOTE: Using binary search instead of linear search because
# the dataset can exceed 10k items (profiling showed 300ms avg latency)
```

✅ Include concrete next steps

```typescript
// TODO(ai/refactor): Extract duplicate validation into shared validator
// Files to update: api/users.ts, api/teams.ts, api/projects.ts
// Estimated effort: 1-2 hours
```

✅ Link to external context

```go
// AI-DEV-NOTE: Implements RFC 6749 OAuth 2.0 Authorization Framework
// https://tools.ietf.org/html/rfc6749#section-4.1
```

### Don't

❌ Leave vague notes

```javascript
// AI-DEV-NOTE: This is important
// Bad - no context about WHY it's important
```

❌ Over-explain obvious code

```python
# AI-DEV-NOTE: This increments the counter by 1
count += 1  # Obvious from code
```

❌ Leave notes without actionable information

```typescript
// TODO: Fix this
// Bad - no context on WHAT needs fixing or HOW
```

## Extracting Notes

Teams can extract AI notes for review:

```bash
# Find all AI development notes
grep -r "AI-DEV-NOTE" src/

# Find all AI TODOs
grep -r "TODO(ai/" src/

# Find uncertain areas needing review
grep -r "AI-UNCERTAIN" src/

# Extract technical debt annotations
grep -r "@ai-tech-debt" src/
```

## Integration with Workflow

### Pre-Commit Review

Before committing, AI should review notes:

1. Ensure all `AI-UNCERTAIN` notes have corresponding test coverage
2. Check that `TODO(ai/*)` notes have enough context for follow-up
3. Verify links to issues/PRs are valid
4. Remove or update outdated notes

### Note Analytics

Track note patterns to improve AI assistance:

- Density of `AI-UNCERTAIN` notes (indicates confidence)
- Categories of `TODO(ai/*)` notes (indicates common issues)
- Age of notes (indicates maintenance burden)

## Use Cases

### Context Preservation

Leave context for future developers (AI or human) about why decisions were made:

```typescript
// AI-DEV-NOTE: This weird-looking workaround is necessary because Safari
// doesn't support the standard API (as of v17.2). Filed webkit bug:
// https://bugs.webkit.org/show_bug.cgi?id=123456
// Remove this when Safari support lands (check caniuse.com)
```

### Technical Debt Tracking

Document areas that need improvement with structured metadata:

```python
# @ai-tech-debt
# @severity: High
# @effort: 3-4 hours
# @impact: Maintainability
#
# This function has grown too complex. Should be split into:
# 1. Input validation (separate function)
# 2. Business logic (current function)
# 3. Output formatting (separate function)
```

### Security Documentation

Mark security-sensitive code with context:

```java
/**
 * @ai-security
 * @risk-level: High
 * @cwe: CWE-89 (SQL Injection)
 *
 * Although input is validated with regex ^[a-zA-Z0-9_]+$,
 * parameterized queries would be safer. Migration to prepared
 * statements should be prioritized.
 */
```

### Performance Optimization

Document performance characteristics and optimization opportunities:

```go
// @ai-performance
// @complexity: O(n²)
// @bottleneck: true
// @profiling-data: 45% of request time when n > 100
//
// This nested loop should be optimized to O(n log n) using
// sort + binary search, or O(n) using a hash map approach.
```

## Resources

This jutsu is inspired by:

- [AI-Powered Documentation: Make Your Codebase Self-Explanatory](https://dev.to/yysun/ai-powered-documentation-make-your-codebase-self-explanatory-231g)
- [Top 2025 AI Documentation Tools to Boost Developer Productivity](https://max-productive.ai/ai-tools/documentation/)
- [AI for Code Documentation: Essential Tips](https://codoid.com/ai/ai-for-code-documentation-essential-tips/)
- [Chapter 14 Annotating Your Code | AI for Efficient Programming](https://hutchdatascience.org/AI_for_Efficient_Programming/annotating-your-code.html)
- [FREE AI Code Comment Generator - Enhance Code Clarity](https://workik.com/code-comment-generator)
- [GitLoop - AI Codebase Assistant](https://www.gitloop.com/)

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines on contributing to this jutsu.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
