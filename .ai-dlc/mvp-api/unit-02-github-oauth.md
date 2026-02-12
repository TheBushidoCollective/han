---
status: completed
depends_on:
  - unit-01-auth-middleware
branch: ai-dlc/mvp-api/02-github-oauth
discipline: backend
---

# unit-02-github-oauth

## Description

Implement GitHub OAuth authentication flow, including a browser-based flow for CLI authentication that redirects back to a localhost callback.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `GET /auth/github` redirects to GitHub OAuth authorize URL (REST - browser redirect)
- [ ] `GET /auth/github/callback` exchanges code for access token (REST - browser redirect)
- [ ] Callback fetches GitHub user info and creates/updates user record
- [ ] User record includes `github_id`, `github_username`, `email`, `avatar_url`
- [ ] Returns JWT access + refresh tokens on successful auth
- [ ] CLI flow: `GET /auth/cli` initiates auth with callback port (REST)
- [ ] CLI flow: After OAuth, redirects to `http://localhost:{port}/callback?token=...`
- [ ] `refreshToken` mutation exchanges refresh token for new access token (GraphQL)
- [ ] State parameter prevents CSRF attacks
- [ ] Handles OAuth errors gracefully with user-friendly messages
- [ ] Creates Stripe customer on first user signup
- [ ] Unit tests for OAuth flow (mocked GitHub API)

## Notes

**CLI Auth Flow:**
```
1. CLI starts localhost server on random port
2. CLI opens browser to: https://app.han.guru/auth/cli?port=9999
3. Server redirects to GitHub OAuth
4. User authenticates with GitHub
5. GitHub redirects to /auth/github/callback
6. Server creates user, generates tokens
7. Server redirects to http://localhost:9999/callback?token=...&refresh=...
8. CLI receives tokens, stores securely
```

Note: OAuth requires REST endpoints for browser redirects. Only `refreshToken` is a GraphQL mutation.

**Environment variables (already in config):**
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

**File structure:**
```
lib/
  auth/
    github-oauth.ts     # OAuth flow handlers
    cli-auth.ts         # CLI-specific auth endpoints
  routes/
    auth.ts             # Auth route definitions
```

**GitHub API endpoints:**
- Authorize: `https://github.com/login/oauth/authorize`
- Token: `https://github.com/login/oauth/access_token`
- User: `https://api.github.com/user`
