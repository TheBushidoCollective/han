---
name: optimize
description: Optimize code for performance, readability, or efficiency
disable-model-invocation: false
---

# optimize

## Name

han-core:optimize - Optimize code for performance, readability, or efficiency

## Synopsis

```
/optimize [arguments]
```

## Description

Optimize code for performance, readability, or efficiency

## Implementation

Optimize the specified code for better performance, maintainability, or resource efficiency.

## Process

Use the performance-optimization skill from bushido to:

1. **Identify optimization target**: Performance, memory, readability, or bundle size
2. **Measure current state**: Establish baseline metrics
3. **Analyze bottlenecks**: Profile and identify actual issues
4. **Apply optimizations**: Make targeted improvements
5. **Measure impact**: Verify improvements with evidence
6. **Ensure correctness**: Run tests to confirm behavior unchanged

## Optimization Types

**Performance:**

- Algorithm complexity reduction
- Database query optimization
- Caching strategies
- Lazy loading and code splitting

**Code Quality:**

- Simplification and clarity
- Removing duplication
- Better naming and structure
- Pattern improvements

**Resource Efficiency:**

- Memory usage reduction
- Bundle size optimization
- Network request reduction
- Asset optimization

## Examples

When the user says:

- "This function is too slow"
- "Optimize the database queries in this module"
- "Reduce the bundle size for this component"
- "Make this code more readable"
- "This page takes too long to load"

## Important Principles

- **Measure first**: Don't optimize without data
- **Profile before fixing**: Find real bottlenecks, not imagined ones
- **One change at a time**: Measure impact of each optimization
- **Preserve correctness**: Tests must still pass
- **Avoid premature optimization**: Focus on actual problems

## Output Format

1. **Current state**: Baseline metrics or issues
2. **Analysis**: What's causing the problem
3. **Proposed changes**: Specific optimizations
4. **Expected impact**: Predicted improvements
5. **Verification**: Proof of improvement (use proof-of-work skill)

## Notes

- Use TaskCreate to track optimization steps
- Always provide before/after metrics
- Consider trade-offs (complexity vs performance)
- Document why optimizations were made
