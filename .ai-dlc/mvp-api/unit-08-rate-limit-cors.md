---
status: completed
depends_on: []
branch: ai-dlc/mvp-api/08-rate-limit-cors
discipline: backend
---

# unit-08-rate-limit-cors

## Description

Implement rate limiting and CORS middleware to protect the API from abuse and enable cross-origin requests from web/CLI clients.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] Rate limiting middleware using Redis for distributed state
- [ ] Default limit: 100 requests/minute per IP
- [ ] Authenticated users: 1000 requests/minute per user ID
- [ ] Billing endpoints: 10 requests/minute (prevent checkout spam)
- [ ] Webhook endpoint: No rate limit (Stripe needs reliability)
- [ ] Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] 429 response with `Retry-After` header when exceeded
- [ ] CORS allows `localhost:*` for CLI callback
- [ ] CORS allows configured production domains
- [ ] CORS credentials allowed for auth cookies
- [ ] Preflight (OPTIONS) requests handled efficiently
- [ ] Unit tests for rate limiting logic

## Notes

**Rate limit tiers:**
```typescript
const RATE_LIMITS = {
  default: { requests: 100, window: 60 },      // per minute
  authenticated: { requests: 1000, window: 60 },
  billing: { requests: 10, window: 60 },
  webhook: null,  // no limit
};
```

**Redis key format:**
```
ratelimit:{type}:{identifier}:{window}
```

**CORS configuration:**
```typescript
const CORS_CONFIG = {
  origins: [
    /^http:\/\/localhost:\d+$/,  // CLI callback
    'https://han.guru',
    'https://api.han.guru',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  headers: ['Authorization', 'Content-Type'],
};
```

**File structure:**
```
lib/
  middleware/
    rate-limiter.ts    # Rate limiting logic
    cors.ts            # CORS configuration
```

**Environment variables:**
- `RATE_LIMIT_ENABLED` - Toggle rate limiting (default: true)
- `CORS_ORIGINS` - Additional allowed origins (comma-separated)
