---
name: documentation-linking
description: Use when creating bidirectional links between code and documentation. Covers link patterns, documentation references, context preservation across artifacts, and maintaining synchronization between code and docs.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Documentation Linking

Creating and maintaining bidirectional links between code and documentation for AI-assisted development.

## Bidirectional Linking

### Code → Documentation

Link from code to relevant documentation:

```typescript
/**
 * Implements the authentication flow described in:
 * @doc docs/architecture/authentication.md#oauth-flow
 * @api-spec api/openapi.yaml#/components/securitySchemes/oauth2
 * @decision-record docs/decisions/003-oauth-provider.md
 *
 * Related endpoints:
 * - POST /auth/login (login initiation)
 * - GET /auth/callback (OAuth callback)
 * - POST /auth/refresh (token refresh)
 */
export class AuthenticationService {
  // Implementation
}
```

### Documentation → Code

Link from documentation to implementing code:

```markdown
# Authentication Flow

Our OAuth 2.0 authentication flow is implemented in:

- Main logic: `src/services/AuthenticationService.ts`
- Routes: `src/routes/auth.ts:15-45`
- Middleware: `src/middleware/auth.ts:78`
- Tests: `tests/integration/auth.test.ts`

See also:
- Database schema: `migrations/003_create_users.sql`
- Configuration: `config/auth.yaml`
```

## Link Formats

### Absolute Links

```python
# @doc /docs/database/migrations.md#schema-versioning
# Full path from repository root
```

### Relative Links

```javascript
// @doc ../../../docs/api/rest-endpoints.md#user-endpoints
// Relative to current file
```

### Line-Specific Links

```go
// @impl service/user_service.go:145-178
// Links to specific line range
```

### Anchor Links

```rust
/// @doc architecture.md#data-flow-diagram
/// Links to specific section via anchor
```

## Documentation Types

### Architecture Documentation

```typescript
/**
 * @arch-doc docs/architecture/system-overview.md
 * @component-diagram docs/diagrams/user-service.svg
 * @sequence-diagram docs/diagrams/login-flow.puml
 *
 * This service is part of the user management subsystem.
 * See architecture docs for component interactions and data flow.
 */
class UserService {
  // Implementation
}
```

### API Documentation

```python
# @api-doc docs/api/rest-api.md#POST-/users
# @openapi-spec api/openapi.yaml#/paths/~1users/post
# @example docs/examples/create-user.md
#
# REST endpoint for creating users. API contract is defined in OpenAPI spec.
# Changes to request/response format must update both code and spec.

@app.post("/users")
async def create_user(user: UserCreate) -> User:
    """
    @request-example:
      POST /users
      {
        "email": "user@example.com",
        "name": "John Doe"
      }

    @response-example:
      201 Created
      {
        "id": 123,
        "email": "user@example.com",
        "name": "John Doe",
        "created_at": "2025-12-04T10:00:00Z"
      }
    """
    # Implementation
```

### Decision Records

```java
/**
 * @decision-record docs/decisions/005-caching-strategy.md
 *
 * DECISION: Using Redis for caching instead of in-memory cache
 * RATIONALE: Need distributed cache for horizontal scaling
 * DATE: 2025-11-15
 *
 * This implements the caching strategy defined in ADR-005.
 * Cache invalidation rules:
 * 1. Time-based: 5 minute TTL
 * 2. Event-based: Invalidate on user.updated event
 * 3. Manual: Admin can clear cache via /admin/cache/clear
 */
public class CacheService {
    // Implementation following decision record
}
```

### Test Documentation

```go
// @test-doc docs/testing/integration-tests.md#database-tests
// @test-data fixtures/users.json
// @test-cases tests/integration/user_test.go
//
// Integration tests use Docker containers for PostgreSQL.
// Test data is loaded from fixtures before each test.
// See test documentation for setup instructions.

func TestUserRepository(t *testing.T) {
    // Test implementation
}
```

### Runbook Links

```python
# @runbook docs/runbooks/incident-response.md#database-failover
# @monitoring dashboard/database-health
# @alerts alerts/database-connection-pool
#
# Database connection pool monitoring and failover logic.
# If pool exhaustion alert fires, follow runbook for mitigation steps.

class DatabaseConnectionPool:
    """
    @metric connection_pool_active (gauge)
    @metric connection_pool_idle (gauge)
    @metric connection_pool_wait_time (histogram)

    Alert thresholds:
    - connection_pool_active > 90% of max_connections for 5min
    - connection_pool_wait_time p95 > 1000ms
    """
    # Implementation
```

## Cross-Referencing Patterns

### Issue/Ticket References

```typescript
/**
 * @issue https://github.com/org/repo/issues/1234
 * @pr https://github.com/org/repo/pull/1245
 * @jira PROJ-567
 *
 * Implements user story PROJ-567: Real-time notification system
 * See issue #1234 for requirements discussion
 * See PR #1245 for implementation review and feedback
 */
class NotificationService {
  // Implementation
}
```

### Wiki/Confluence Links

```python
# @wiki https://wiki.company.com/display/ENG/Data+Pipeline
# @confluence https://company.atlassian.net/wiki/spaces/ARCH/pages/123456
#
# Data pipeline architecture documented in company wiki.
# This implements the extraction phase of the ETL pipeline.

class DataExtractor:
    # Implementation
```

### External Resources

```rust
/// @rfc https://tools.ietf.org/html/rfc7519
/// @spec https://openid.net/specs/openid-connect-core-1_0.html
/// @tutorial https://auth0.com/docs/secure/tokens/json-web-tokens
///
/// JWT implementation following RFC 7519 specification.
/// Supports OpenID Connect extensions per OIDC Core spec.

pub struct JwtToken {
    // Implementation
}
```

## Synchronization Strategies

### Automated Link Validation

Script to validate documentation links:

```bash
#!/bin/bash
# validate-doc-links.sh

# Extract all @doc references from code
grep -r "@doc " src/ | while read -r line; do
  doc_path=$(echo "$line" | sed -n 's/.*@doc \([^[:space:]]*\).*/\1/p')
  file_path=$(echo "$doc_path" | cut -d'#' -f1)

  if [ ! -f "$file_path" ]; then
    echo "ERROR: Broken doc link: $doc_path"
    echo "  Referenced in: $line"
  fi
done
```

### Documentation Coverage

Track which code has documentation links:

```python
# doc-coverage.py
import re
from pathlib import Path

def has_doc_link(file_path):
    """Check if file contains @doc annotations"""
    with open(file_path) as f:
        content = f.read()
    return '@doc' in content or '@api-doc' in content

# Calculate coverage
source_files = list(Path('src').rglob('*.py'))
with_docs = [f for f in source_files if has_doc_link(f)]
coverage = len(with_docs) / len(source_files) * 100

print(f"Documentation link coverage: {coverage:.1f}%")
```

### Reverse Link Tracking

Maintain reverse index in documentation:

```markdown
# Authentication Documentation

## Referenced By

This document is referenced by the following code files:

- `src/services/AuthenticationService.ts:15` - Main auth logic
- `src/middleware/auth.ts:34` - Auth middleware
- `src/routes/auth.ts:8` - Auth routes

<!-- AUTO-GENERATED: Do not edit manually -->
<!-- Generated by: scripts/update-doc-references.sh -->
```

## Link Maintenance

### Automated Updates

Git pre-commit hook to check doc links:

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Validating documentation links..."

# Check for broken @doc links
broken_links=$(grep -r "@doc " src/ | while read -r line; do
  doc_path=$(echo "$line" | sed -n 's/.*@doc \([^[:space:]]*\).*/\1/p')
  file_path=$(echo "$doc_path" | cut -d'#' -f1)

  if [ ! -f "$file_path" ]; then
    echo "$line"
  fi
done)

if [ -n "$broken_links" ]; then
  echo "ERROR: Broken documentation links found:"
  echo "$broken_links"
  exit 1
fi
```

### Link Deprecation

Mark outdated links:

```typescript
/**
 * @doc docs/old-approach.md [DEPRECATED: See docs/new-approach.md]
 * @doc-current docs/new-approach.md
 *
 * This implementation is being migrated to new approach.
 * Old documentation kept for reference during transition.
 * Migration deadline: 2026-01-01
 */
```

### Versioned Documentation

Link to specific documentation versions:

```python
# @doc docs/v2/api-reference.md
# @doc-version 2.3.0
#
# This code implements API v2.3.0 specification.
# For v3.0.0 changes, see docs/v3/migration-guide.md

class APIv2Handler:
    # Implementation
```

## Documentation Patterns

### README Links

Link to README for module documentation:

```go
// @readme ./README.md
//
// Package userservice provides user management functionality.
// See README.md for usage examples and configuration options.

package userservice
```

### Example Code

Link to runnable examples:

```rust
/// @example examples/basic-usage.rs
/// @example-advanced examples/advanced-patterns.rs
///
/// Basic usage example shows simple CRUD operations.
/// Advanced example demonstrates batching and transactions.

pub struct Repository<T> {
    // Implementation
}
```

### Tutorial Links

```javascript
/**
 * @tutorial docs/tutorials/getting-started.md
 * @tutorial-video https://youtube.com/watch?v=abc123
 * @interactive-demo https://demo.example.com
 *
 * New to this library? Start with the getting started tutorial.
 * Video walkthrough available for visual learners.
 */
export class SDK {
  // Implementation
}
```

## Anti-Patterns

### Don't

❌ Use brittle relative links

```python
# @doc ../../../../../../../docs/guide.md
# Bad - breaks easily when files move
```

❌ Link to outdated documentation

```typescript
// @doc docs/deprecated-api.md
// Bad - should link to current docs or mark as deprecated
```

❌ Create circular documentation dependencies

```go
// file1.go
// @doc docs/file2.md

// docs/file2.md references file3.go
// file3.go references file1.go
// Bad - circular reference makes navigation confusing
```

### Do

✅ Use repository-relative paths

```python
# @doc docs/guide.md
# Good - stable even if current file moves
```

✅ Keep links current

```typescript
// @doc docs/current-api.md
// @doc-history docs/api-v1.md [DEPRECATED]
// Good - clear which is current
```

✅ Create clear navigation hierarchy

```go
// @doc-parent docs/architecture/overview.md
// @doc-current docs/architecture/auth-service.md
// @doc-related docs/architecture/user-service.md
// Good - clear hierarchy and relationships
```

## Integration Examples

### Markdown Documentation

```markdown
# User Service

## Implementation

The user service is implemented across several files:

### Core Logic

- [`src/services/UserService.ts`](../src/services/UserService.ts) - Main service class
- [`src/models/User.ts`](../src/models/User.ts) - User model
- [`src/repositories/UserRepository.ts`](../src/repositories/UserRepository.ts) - Data access

### API Layer

- [`src/routes/users.ts`](../src/routes/users.ts#L15-L45) - REST endpoints
- [`src/controllers/UserController.ts`](../src/controllers/UserController.ts) - Request handling

### Tests

- [`tests/unit/UserService.test.ts`](../tests/unit/UserService.test.ts) - Unit tests
- [`tests/integration/users.test.ts`](../tests/integration/users.test.ts) - Integration tests
```

### OpenAPI/Swagger

```yaml
# api/openapi.yaml
paths:
  /users:
    post:
      summary: Create user
      description: |
        Creates a new user in the system.

        **Implementation:**
        - Handler: `src/handlers/users.go:CreateUser`
        - Validation: `src/validators/user.go:ValidateCreate`
        - Database: `src/repositories/user_repo.go:Insert`

        **Related Documentation:**
        - [User Management Guide](../docs/user-management.md)
        - [API Authentication](../docs/api-auth.md)
```

### JSDoc/TypeDoc

```typescript
/**
 * User authentication service
 *
 * @see {@link ../docs/architecture/auth-flow.md} for authentication flow diagram
 * @see {@link ../docs/api/auth-api.md} for API documentation
 *
 * @example
 * ```typescript
 * const auth = new AuthService();
 * const token = await auth.login(username, password);
 * ```
 *
 * @example
 * See {@link ../examples/auth-flow.ts} for complete authentication example
 */
export class AuthService {
  // Implementation
}
```

## Related Skills

- notetaker-fundamentals
- code-annotation-patterns

## Resources

- [AI for Code Documentation: Essential Tips](https://codoid.com/ai/ai-for-code-documentation-essential-tips/)
- [Graphite - AI Code Documentation Automation](https://graphite.com/guides/ai-code-documentation-automation)
