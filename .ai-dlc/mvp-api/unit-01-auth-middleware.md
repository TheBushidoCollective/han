---
status: pending
depends_on: []
branch: ai-dlc/mvp-api/01-auth-middleware
discipline: backend
---

# unit-01-auth-middleware

## Description

Implement JWT authentication middleware and standardized error handling for the API. This is the foundation that all protected routes will use.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `AuthService` class with `signAccessToken(userId)` and `signRefreshToken(userId)` methods
- [ ] `verifyToken(token)` validates JWT and returns payload or throws
- [ ] Access tokens expire in 24 hours, refresh tokens in 30 days
- [ ] `authMiddleware` Hono middleware extracts and validates Bearer token
- [ ] Middleware sets `c.set('user', { id, email })` for downstream handlers
- [ ] Invalid tokens return `{ error: 'unauthorized', message: '...' }` with 401
- [ ] Expired tokens return `{ error: 'token_expired', message: '...' }` with 401
- [ ] Missing tokens return `{ error: 'missing_token', message: '...' }` with 401
- [ ] `POST /api/v1/auth/refresh` exchanges refresh token for new access token
- [ ] Standardized error response format across all endpoints
- [ ] Unit tests for token signing, verification, and middleware

## Notes

**File structure:**
```
lib/
  auth/
    auth-service.ts      # JWT signing/verification
    auth-middleware.ts   # Hono middleware
    types.ts             # Auth-related types
  middleware/
    error-handler.ts     # Global error handler
```

**Token payload:**
```typescript
interface TokenPayload {
  sub: string;        // User ID
  email: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}
```

**Error response format:**
```typescript
interface ErrorResponse {
  error: string;      // Machine-readable error code
  message: string;    // Human-readable message
  details?: unknown;  // Optional additional info
}
```

Use `jose` library (already in deps) for JWT operations.
