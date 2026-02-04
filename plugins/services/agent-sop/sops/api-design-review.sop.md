# Review API Design for Consistency and Usability

## Overview

This SOP guides comprehensive review of API designs (REST, GraphQL, SDK, library interfaces) focusing on consistency, usability, and long-term maintainability. Use this when designing new APIs or reviewing proposed API changes before implementation. Thorough API review prevents costly breaking changes and ensures developer-friendly interfaces.

## Parameters

- **API Specification**: {api_spec} - Path to API specification or design document
- **API Type**: {api_type} - Type of API (REST, GraphQL, SDK/library, RPC, WebSocket)
- **Target Audience**: {audience} - API consumers (internal, public, partner)
- **Versioning Strategy**: {versioning} - How API versions are managed (URL, header, none)
- **Compatibility Requirements**: {compatibility} - Backward compatibility needs (strict, flexible, breaking-allowed)

## Prerequisites

### Required Tools

- API specification format tool (OpenAPI/Swagger, GraphQL schema, etc.)
- API design linter (Spectral, GraphQL Inspector, etc.)
- Version control system access
- API documentation generator

### Required Knowledge

- Understanding of RESTful principles or relevant API paradigm
- Familiarity with HTTP semantics and status codes
- Knowledge of API versioning strategies
- Understanding of authentication and authorization patterns
- Awareness of API security best practices

### Required Setup

- API specification file exists at {api_spec}
- API type {api_type} is clearly defined
- Target {audience} is documented
- Design documentation reviewed

## Steps

1. Review API specification completeness
   - You MUST verify {api_spec} exists and is valid
   - You MUST ensure all endpoints/operations are documented
   - You SHOULD check request/response schemas are complete
   - You SHOULD verify authentication requirements are specified
   - Confirm error responses are documented
   - Check that all parameters have descriptions
   - **Validation**: Specification is complete and parseable

2. Evaluate naming and consistency
   - You MUST verify consistent naming conventions (camelCase, snake_case, etc.)
   - You MUST ensure resource names are plural for collections (REST)
   - You SHOULD verify verb usage is consistent and appropriate
   - You SHOULD check field names are clear and self-explanatory
   - You MUST NOT approve abbreviations without strong justification
   - Verify consistent use of terminology across all endpoints
   - Check for consistent date/time formats (ISO 8601 recommended)
   - **Validation**: Naming follows consistent conventions

3. Assess resource modeling and relationships
   - You MUST verify resources represent domain concepts clearly
   - You SHOULD check relationships are modeled appropriately
   - You SHOULD verify proper use of nested vs. flat structures
   - Consider if resource granularity is appropriate
   - You MUST ensure resource identifiers are consistent
   - Check that related resources are discoverable
   - **Validation**: Resource model is clear and logical

4. Review HTTP semantics (for REST APIs)
   - You MUST verify correct HTTP methods (GET, POST, PUT, PATCH, DELETE)
   - You MUST ensure GET requests are safe and idempotent
   - You MUST verify PUT and DELETE are idempotent
   - You SHOULD check status codes are semantically correct (200, 201, 204, 400, 404, 500, etc.)
   - You MUST NOT use POST for all operations
   - Verify proper use of query parameters vs. path parameters
   - Check that request/response content types are specified
   - **Validation**: HTTP semantics are correct

5. Evaluate error handling and responses
   - You MUST verify all error scenarios have defined responses
   - You MUST ensure error messages are helpful and actionable
   - You SHOULD check error responses include error codes/types
   - You SHOULD verify sensitive information is not leaked in errors
   - You MUST NOT expose stack traces or internal details
   - Check that validation errors specify which fields failed
   - Verify consistent error response structure
   - **Validation**: Error handling is comprehensive and secure

6. Review authentication and authorization
   - You MUST verify authentication mechanism is specified
   - You MUST ensure authorization is enforced on protected endpoints
   - You SHOULD check for principle of least privilege
   - You SHOULD verify API keys/tokens are transmitted securely
   - You MUST NOT allow authentication credentials in URLs
   - Check rate limiting and throttling are considered
   - Verify CORS policies are appropriate for {audience}
   - **Validation**: Security requirements are clearly defined

7. Assess versioning and evolution strategy
   - You MUST verify {versioning} strategy is documented
   - You MUST ensure backward compatibility based on {compatibility}
   - You SHOULD check deprecation policy is defined
   - You SHOULD verify migration path for breaking changes
   - Check that API version is discoverable
   - You MUST NOT break existing clients without proper deprecation
   - **Validation**: Evolution strategy protects existing consumers

8. Evaluate pagination and filtering
   - You MUST verify collection endpoints support pagination
   - You SHOULD check pagination is consistent (cursor vs. offset)
   - You SHOULD verify filter and sort parameters are available
   - Check that default page sizes are reasonable
   - You SHOULD ensure total count is available when needed
   - Verify HATEOAS links for pagination (if applicable)
   - **Validation**: Collections are properly paginated

9. Review performance and efficiency
   - You SHOULD check for N+1 query problems in design
   - You SHOULD verify field selection/projection is available
   - You MAY suggest batching endpoints for efficiency
   - Consider if caching headers are appropriate
   - Check for overfetching or underfetching issues
   - You SHOULD verify webhook/callback options for async operations
   - **Validation**: API supports efficient usage patterns

10. Assess documentation and developer experience
    - You MUST verify API documentation is complete
    - You SHOULD ensure examples are provided for all operations
    - You SHOULD check that common use cases are documented
    - You MAY suggest interactive API documentation (Swagger UI, GraphQL Playground)
    - Verify authentication flow is clearly explained
    - Check that error scenarios have examples
    - You SHOULD recommend SDK generation if appropriate
    - **Validation**: Documentation enables self-service integration

11. Validate against best practices
    - You SHOULD verify JSON:API, OpenAPI, or GraphQL best practices
    - Check compliance with company/team API standards
    - You SHOULD ensure API follows industry conventions
    - Review for common anti-patterns (chatty APIs, god endpoints)
    - Verify RESTful maturity level is appropriate
    - **Validation**: Design follows established best practices

12. Generate structured feedback
    - You MUST categorize findings (critical, major, minor)
    - You MUST provide specific recommendations with examples
    - You SHOULD suggest improvements for usability
    - You SHOULD highlight good design decisions
    - Document any {compatibility} concerns
    - Provide timeline for addressing issues
    - **Validation**: Feedback is actionable and prioritized

## Success Criteria

- [ ] API specification is complete and valid
- [ ] Naming is consistent and follows conventions
- [ ] HTTP semantics are correct (for REST)
- [ ] Error handling is comprehensive and secure
- [ ] Authentication and authorization are properly specified
- [ ] Versioning strategy aligns with {compatibility} requirements
- [ ] Pagination and filtering are implemented consistently
- [ ] Documentation is complete with examples
- [ ] Design follows best practices for {api_type}
- [ ] No critical or major issues remain unresolved
- [ ] Review feedback is documented and shared

## Error Handling

### Error: Specification Format Invalid

**Symptoms**: Cannot parse {api_spec}, validation errors in specification

**Cause**: Syntax errors, invalid schema, or malformed specification

**Resolution**:

1. You MUST validate specification using appropriate tool (Swagger validator, GraphQL validator)
2. Identify and document specific validation errors
3. Request specification be fixed before continuing review
4. You MUST NOT review invalid specifications
5. Suggest using specification linters in development workflow

### Error: Breaking Changes Without Versioning

**Symptoms**: Changes break existing contracts without version bump

**Cause**: Lack of versioning awareness or insufficient compatibility checks

**Resolution**:

1. You MUST NOT approve breaking changes without version strategy
2. Document all breaking changes clearly
3. Require migration guide for breaking changes
4. Suggest using API diff tools to detect breaking changes
5. Enforce {compatibility} requirements strictly

### Error: Inconsistent Design Patterns

**Symptoms**: Different endpoints use different conventions, mixed styles

**Cause**: Multiple authors, lack of API design guidelines, or incremental development

**Resolution**:

1. You MUST document all inconsistencies with examples
2. Recommend standardizing on single pattern
3. Suggest creating API design guidelines for team
4. You SHOULD NOT approve APIs with major inconsistencies
5. Provide specific examples of preferred patterns

### Error: Security Vulnerabilities in Design

**Symptoms**: Authentication bypasses, authorization gaps, or data exposure risks

**Cause**: Security not considered in design, insufficient security expertise

**Resolution**:

1. You MUST NOT approve APIs with security vulnerabilities
2. Document security issues as critical priority
3. Recommend security review by security team
4. Suggest following OWASP API Security Top 10
5. Require security requirements be addressed before implementation

### Error: Poor Developer Experience

**Symptoms**: API is hard to understand, inconsistent, or poorly documented

**Cause**: Lack of user-centric design, insufficient documentation, or complex patterns

**Resolution**:

1. You SHOULD provide specific usability improvements
2. Suggest creating example code for common use cases
3. Recommend developer testing (get feedback from potential users)
4. Consider if API complexity can be reduced
5. Suggest interactive documentation and sandbox environment

## Related SOPs

- **implement-feature-tdd**: Use after API design approval to implement with tests
- **code-review-quality**: Use to review API implementation code
- **refactor-for-maintainability**: Reference if existing API needs restructuring
- **debug-production-issue**: Use when API design issues surface in production
