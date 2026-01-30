---
status: pending
depends_on: ["01-core-backend", "02-authentication"]
branch: ai-dlc/han-team-platform/04-permissions
---

# unit-04-permissions

## Description

Implement the permissions system that enforces repo-based access control, privacy rules, and configurable manager visibility. This is the core of the privacy model.

## Success Criteria

- [ ] Repo permission fetching from GitHub/GitLab APIs
- [ ] Permission caching with TTL (avoid rate limits)
- [ ] Session access check: user has repo access → can see session
- [ ] Personal repo detection (repo owner != org)
- [ ] Manager visibility configuration per org
- [ ] Aggregated metrics access (always visible to team)
- [ ] GraphQL field-level authorization
- [ ] Permission denial audit logging

## Technical Notes

### Permission Sources
1. **Git provider API** - Check if user has read access to repo
2. **Org membership** - User must be member of org to see org data
3. **Role** - Owner/Admin/Member/Viewer capabilities
4. **Manager config** - Org setting for elevated manager access

### Access Decision Flow
```
canViewSession(user, session):
  if session.repo is personal (not org-owned):
    return session.user == user  # Only owner sees
  if user not in session.org:
    return false
  if user.hasRepoAccess(session.repo):
    return true
  if org.managerCanSeeAll and user.isManager(org):
    return true
  return false
```

### Caching Strategy
- Cache repo permissions for 5 minutes
- Invalidate on webhook (if available)
- Background refresh for active users
- Fail-open vs fail-closed configurable
