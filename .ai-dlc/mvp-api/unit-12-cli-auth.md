---
status: pending
depends_on:
  - unit-02-github-oauth
  - unit-03-session-sync
branch: ai-dlc/mvp-api/12-cli-auth
discipline: backend
---

# unit-12-cli-auth

## Description

Update the han CLI to support browser-based authentication and session syncing to the han-team-server.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `han auth login` opens browser for GitHub OAuth
- [ ] CLI starts local HTTP server on random port for callback
- [ ] Receives token from server callback redirect
- [ ] Token stored securely in `~/.config/han/credentials.json`
- [ ] `han auth logout` clears stored credentials
- [ ] `han auth status` shows current auth state and user info
- [ ] `han sync` command syncs current session to server
- [ ] Sync uses stored auth token for API calls
- [ ] `han sync --watch` continuously syncs on session changes
- [ ] Clear error messages for auth failures
- [ ] Handles token refresh automatically
- [ ] `han config set server-url` for self-hosted servers

## Notes

**Auth flow:**
```
1. User runs: han auth login
2. CLI starts localhost:PORT server
3. CLI opens browser to: https://app.han.guru/auth/cli?port=PORT
4. User authenticates with GitHub OAuth
5. Server redirects to: http://localhost:PORT/callback?token=...
6. CLI receives token, stores in credentials file
7. CLI prints success message with username
```

Note: OAuth redirects require REST endpoints. The auth flow uses:
- `GET /auth/cli` - Start CLI auth flow (REST)
- `GET /auth/github/callback` - GitHub OAuth callback (REST)
- GraphQL mutations for token refresh

**Credentials file:**
```json
{
  "server_url": "https://api.han.guru",
  "access_token": "...",
  "refresh_token": "...",
  "user": {
    "id": "...",
    "email": "...",
    "github_username": "..."
  },
  "expires_at": "2026-02-01T00:00:00Z"
}
```

**Sync implementation:**
```typescript
async function syncSession(sessionId: string) {
  const session = await readSessionFromJsonl(sessionId);
  const response = await fetch(`${serverUrl}/graphql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `mutation SyncSession($input: SyncSessionInput!) {
        syncSession(input: $input) {
          session { id }
          secretsRedacted
        }
      }`,
      variables: { input: session }
    }),
  });
  // Handle response
}
```

**File structure:**
```
packages/han/lib/
  commands/
    auth/
      login.ts
      logout.ts
      status.ts
    sync/
      index.ts
      watch.ts
  services/
    auth-service.ts      # Token management
    sync-service.ts      # Session sync logic
    credentials.ts       # Credential storage
```

**Configuration:**
```
~/.config/han/
  credentials.json       # Auth tokens
  config.json           # CLI settings (server_url, etc.)
```
