# Hook Session ID Priority

When Claude Code triggers hooks, the session_id ALWAYS comes via stdin payload - this is the highest priority source.

The env var fallbacks (HAN_SESSION_ID, CLAUDE_SESSION_ID) are only used when running hooks directly from CLI without stdin.

```typescript
// Priority order:
// 1. stdin payload (from Claude Code) - HIGHEST
// 2. HAN_SESSION_ID env var - explicit CLI override
// 3. CLAUDE_SESSION_ID env var - CLI fallback
// 4. Database active session - project lookup
// 5. Generated CLI session ID - final fallback
```

When manually running `han hook run` from a Bash tool, there's no stdin payload, so it falls back to env vars - which may contain stale/different session IDs.
