---
status: completed
depends_on: ["01-core-backend", "02-authentication", "04-permissions"]
branch: ai-dlc/han-team-platform/05-session-viewer
---

# unit-05-session-viewer

## Description

Extend the existing browse UI to work in team context. Users can view their own sessions plus team sessions they have permission to see. Reuses existing browse-client components.

## Success Criteria

### Single Codebase (Critical)
- [ ] Same browse-client codebase runs in local AND hosted modes
- [ ] All existing local features work unchanged in hosted mode
- [ ] Mode detection via environment/config (not code forks)
- [ ] No regressions to local `han browse` functionality

### Team Features (Hosted Mode Only)
- [ ] Team session list showing permitted sessions
- [ ] Filter by: user, project, repo, date range
- [ ] User attribution on sessions (who ran this session)
- [ ] Real-time updates when new sessions sync
- [ ] Switch between personal view and team view

### Both Modes
- [ ] Session detail view with full message history
- [ ] Responsive design for various screen sizes
- [ ] Loading states and error handling

## Technical Notes

### UI Changes
- Add team/org selector to sidebar
- Session list shows user avatar + name
- Filter controls for team/project/user
- "My Sessions" vs "Team Sessions" toggle

### GraphQL Queries
- Extend `sessions` query with org/team/project filters
- Add `teamMembers` query for filter dropdowns
- Subscriptions for real-time session updates

### Component Reuse
- Reuse `SessionMessages`, `MessageCard`, etc.
- Add `SessionOwner` component for attribution
- Add `TeamFilter` component for filtering

### State Management
- URL-based filtering (shareable links)
- Persist view preferences
- Optimistic UI updates
