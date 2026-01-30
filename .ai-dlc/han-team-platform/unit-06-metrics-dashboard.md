---
status: pending
depends_on: ["01-core-backend", "02-authentication", "03-data-sync"]
branch: ai-dlc/han-team-platform/06-metrics-dashboard
---

# unit-06-metrics-dashboard

## Description

Build team-level metrics dashboard showing aggregated data across the organization. Provides visibility into AI usage patterns without exposing individual session details.

## Success Criteria

- [ ] Team dashboard page with key metrics
- [ ] Session count by user/project/time period
- [ ] Task completion metrics (success rate, outcomes)
- [ ] Token usage aggregation
- [ ] Activity timeline (sessions over time)
- [ ] Top contributors widget
- [ ] Drill-down from aggregate to filtered session list
- [ ] Export metrics as CSV/JSON

## Technical Notes

### Metrics to Track
- Sessions: count, duration, by user/project
- Tasks: created, completed, success rate
- Tokens: input, output, cache hits
- Activity: daily/weekly/monthly trends
- Outcomes: success, partial, failure distribution

### Aggregation Strategy
- Pre-compute daily rollups for performance
- Real-time aggregation for current day
- Materialized views or dedicated metrics tables

### Dashboard Components
- `MetricCard` - Single stat with trend
- `ActivityChart` - Time series visualization
- `LeaderboardWidget` - Top users by metric
- `FilterBar` - Date range, team, project filters

### Privacy Note
- Aggregated metrics visible to all team members
- No individual session details on dashboard
- Click-through to session list respects permissions
