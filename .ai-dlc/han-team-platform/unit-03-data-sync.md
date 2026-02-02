---
status: completed
depends_on: ["01-core-backend", "02-authentication"]
branch: ai-dlc/han-team-platform/03-data-sync
---

# unit-03-data-sync

## Description

Implement the data synchronization system that transfers session data from local han instances to the hosted platform. Must be resilient, efficient, and privacy-aware.

## Success Criteria

- [ ] Sync protocol defined (what data, in what format)
- [ ] Local han sync client (opt-in configuration)
- [ ] Server-side sync receiver with validation
- [ ] Incremental sync (only new/changed data)
- [ ] Conflict resolution strategy
- [ ] Sync status tracking and retry logic
- [ ] Personal repo detection and exclusion
- [ ] Bandwidth-efficient transfer (compression, deltas)

## Technical Notes

### Sync Protocol
- HTTPS POST to `/api/sync` endpoint
- Payload: sessions, messages, tasks, metrics
- Chunked for large sessions
- Signed with user API key

### Local Client Changes
- New config: `han.yml` → `sync.enabled`, `sync.endpoint`, `sync.apiKey`
- Background sync service (not blocking main operations)
- Queue-based with exponential backoff on failures
- Sync on session end + periodic catch-up

### Privacy Filtering
- Check repo ownership before sync
- Personal repos (not in any org) excluded
- User can override to force-include specific repos
- Sensitive data detection (optional, future)

### Server Receiver
- Validate API key and user permissions
- Map session to correct organization/project
- Deduplicate on session_id + message_id
- Update aggregated metrics after sync
