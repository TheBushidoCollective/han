---
status: completed
depends_on: ["01-core-backend"]
branch: ai-dlc/han-team-platform/02-authentication
---

# unit-02-authentication

## Description

Implement authentication system supporting multiple Git providers and email fallback. Handle OAuth flows, session management, and API authentication.

## Success Criteria

- [ ] GitHub OAuth integration (login/signup)
- [ ] GitLab OAuth integration (login/signup)
- [ ] Email + magic link authentication
- [ ] JWT-based API authentication
- [ ] Session management (create, refresh, revoke)
- [ ] Account linking (connect multiple providers to one account)
- [ ] Secure token storage and refresh
- [ ] Rate limiting on auth endpoints

## Technical Notes

### OAuth Flow
1. User clicks "Sign in with GitHub/GitLab"
2. Redirect to provider with scopes: `read:user`, `read:org`, `repo` (for permissions)
3. Callback receives code, exchange for access token
4. Fetch user info, create/update user record
5. Issue JWT for API access
6. Store provider tokens for later permission checks

### Email Flow
1. User enters email
2. Generate magic link token (expires in 15 min)
3. Send email with link
4. User clicks link, token validated
5. Issue JWT for API access

### Security Considerations
- Tokens encrypted at rest
- Short JWT expiry (1 hour) with refresh tokens
- PKCE for OAuth flows
- Secure cookie settings for web sessions
