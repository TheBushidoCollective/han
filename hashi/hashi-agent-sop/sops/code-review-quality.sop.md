# Review Code Changes for Quality and Maintainability

## Overview

This SOP guides systematic code review focusing on quality, maintainability, and adherence to project standards. Use this when reviewing pull requests or code changes to ensure consistent quality across the codebase. This process ensures comprehensive review coverage and reduces regression risk.

## Parameters

- **Pull Request URL**: {pr_url} - URL of the pull request to review
- **Review Depth**: {review_depth} - Level of review detail (quick, standard, thorough)
- **Focus Areas**: {focus_areas} - Specific areas to emphasize (security, performance, architecture, all)
- **Project Standards**: {standards_doc} - Path to project coding standards (optional)

## Prerequisites

### Required Tools

- Git (v2.30 or higher)
- Code analysis tools appropriate for the language
- Access to the repository and pull request

### Required Knowledge

- Understanding of the project architecture
- Familiarity with the programming language and frameworks used
- Knowledge of SOLID principles and design patterns

### Required Setup

- Repository cloned locally
- Development environment configured
- Access to CI/CD pipeline results

## Steps

1. Fetch and analyze pull request context
   - Read the pull request description and linked issues
   - You MUST understand the intended changes before reviewing code
   - Identify the scope and purpose of changes
   - Note any breaking changes or migration requirements
   - **Validation**: PR description clearly explains what and why

2. Review code structure and organization
   - You MUST verify changes follow Single Responsibility Principle
   - You SHOULD check for proper separation of concerns
   - You SHOULD NOT approve code with excessive function complexity
   - Check for code duplication and opportunities for extraction
   - Verify naming conventions are clear and consistent
   - **Validation**: Each module/class has a clear, focused responsibility

3. Assess code quality and maintainability
   - You MUST verify proper error handling exists
   - You MUST check that edge cases are considered
   - You SHOULD verify code follows DRY principle
   - You SHOULD check for magic numbers and hardcoded values
   - You MAY suggest performance optimizations if relevant
   - Review code comments for clarity (not what, but why)
   - **Validation**: Code is self-documenting with meaningful names

4. Verify test coverage and quality
   - You MUST ensure new code has test coverage
   - You MUST verify tests actually test the intended behavior
   - You SHOULD check for both positive and negative test cases
   - You SHOULD NOT approve code with only happy-path tests
   - You MAY suggest additional edge case tests
   - Verify test names clearly describe what is being tested
   - **Validation**: Test coverage meets project standards (typically ≥ 80%)

5. Check architectural consistency
   - You MUST verify patterns match existing codebase
   - You MUST NOT approve architectural changes without discussion
   - You SHOULD check dependency injection is used appropriately
   - You SHOULD verify new dependencies are justified
   - Ensure changes don't introduce circular dependencies
   - Review impact on system boundaries and interfaces
   - **Validation**: Changes integrate cleanly with existing architecture

6. Review documentation updates
   - You MUST verify public API changes are documented
   - You SHOULD check README updates if user-facing changes exist
   - You SHOULD verify inline documentation for complex logic
   - You MAY suggest additional documentation for clarity
   - **Validation**: Documentation reflects all public API changes

7. Generate structured review feedback
   - You MUST categorize issues by severity (critical, major, minor)
   - You MUST provide specific, actionable feedback
   - You SHOULD include code suggestions where helpful
   - You SHOULD highlight positive changes and good practices
   - You MAY provide learning resources for improvement
   - **Validation**: Each comment includes specific location and suggestion

## Success Criteria

- [ ] All code changes are reviewed thoroughly
- [ ] Critical and major issues are identified and documented
- [ ] Feedback is specific, actionable, and respectful
- [ ] Architectural consistency is verified
- [ ] Test coverage meets project standards
- [ ] Documentation updates are complete
- [ ] Review comments are submitted to pull request

## Error Handling

### Error: Unable to Access Pull Request

**Symptoms**: Cannot fetch PR details, authentication failures, or repository access denied

**Cause**: Invalid PR URL, insufficient permissions, or network issues

**Resolution**:

1. Verify the {pr_url} is correct and accessible
2. Check authentication credentials are current
3. Confirm you have read access to the repository
4. If issue persists, request access from repository maintainer

### Error: Insufficient Context to Review

**Symptoms**: PR description is empty or unclear, no linked issues, unclear intent

**Cause**: Poor PR documentation or communication

**Resolution**:

1. You MUST request clarification from PR author before proceeding
2. Ask specific questions about intent and scope
3. Request linking to relevant issues or documentation
4. You MUST NOT approve PRs with insufficient context

### Error: Breaking Changes Without Migration Path

**Symptoms**: API changes that break existing consumers, schema changes without migrations

**Cause**: Incomplete implementation or lack of backward compatibility consideration

**Resolution**:

1. You MUST NOT approve breaking changes without migration strategy
2. Request deprecation warnings for gradual migration
3. Ensure backward compatibility layer if possible
4. Verify migration documentation exists
5. If critical, escalate to architecture review

### Error: Code Quality Below Standards

**Symptoms**: Multiple violations of coding standards, excessive complexity, poor test coverage

**Cause**: Rushed implementation, lack of familiarity with standards, or technical debt

**Resolution**:

1. You SHOULD provide specific examples of issues
2. Link to project coding standards documentation
3. Suggest incremental improvements if complete rewrite is impractical
4. You MUST NOT approve code significantly below standards
5. Offer to pair program or provide mentoring if needed

## Related SOPs

- **implement-feature-tdd**: Recommend to PR author for test-driven development approach
- **refactor-for-maintainability**: Use when code quality issues require significant refactoring
- **api-design-review**: Escalate to this SOP for significant API changes
- **debug-production-issue**: Reference if reviewing hotfix or production incident response
