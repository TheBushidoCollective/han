---
status: completed
depends_on: []
branch: ai-dlc/browse-dashboard-overhaul/01-session-detail-overview
discipline: frontend
ticket: ""
---

# unit-01: Session Detail Overview Enrichment

## Description

Transform the Session Detail Overview tab from 5 basic stat cards and a file impact count into a rich session summary. The Overview tab should answer at a glance: "How much did this session cost?", "Was it effective?", and "What did it do?"

## Discipline

frontend - This unit will be executed by `do-frontend-development` specialized agents.

## Domain Entities

- **Session**: estimatedCostUsd, turnCount, compactionCount, duration, hookStats, fileChangeCount
- **AssistantMessage**: model, inputTokens, outputTokens, cachedTokens (for per-model aggregation)
- **NativeTask**: status, completedAt (for task completion rate)
- **HookExecution**: hookName, passed, durationMs (for hook health summary)
- **ContentBlock**: ToolUseBlock.name (for tool usage breakdown)

## Data Sources

The data comes from the existing GraphQL API. The `OverviewTab_session` Relay fragment in `packages/browse-client/src/components/pages/SessionDetailPage/OverviewTab.tsx` already queries some of this data. Key fields to add:

**Already available on Session type (just need to query):**
- `estimatedCostUsd` - Float, estimated session cost
- `turnCount` - Int, number of user-initiated turns
- `compactionCount` - Int, context window compactions
- `duration` - Int, session duration in seconds
- `hookStats()` - Object with totalHooks, passedHooks, failHooks, passRate, byHookType array

**Available via DashboardAnalytics (need session-scoped query or compute client-side):**
- `costAnalysis` - Has cacheHitRate, costPerSession, billingType, configDirBreakdowns
- `sessionEffectiveness` - Has score, sentimentTrend, focusScore, taskCompletionRate

**Available via existing fragment data (already queried, may need rendering):**
- `nativeTasks` connection - Task count, completed count for completion rate
- `frustrationSummary` - Already queried in OverviewTab but may not render fully
- `hookStats` - Already queried, check if rendered

## Technical Specification

### File: `packages/browse-client/src/components/pages/SessionDetailPage/OverviewTab.tsx`

**Extend the Relay fragment** (`OverviewTab_session`) to include:
```graphql
fragment OverviewTab_session on Session {
  # existing fields...
  estimatedCostUsd
  turnCount
  compactionCount
  duration
  hookStats {
    totalHooks
    passedHooks
    failHooks
    passRate
    byHookType {
      hookType
      count
      passCount
      failCount
      passRate
      avgDurationMs
    }
  }
  # ...existing nativeTasks, frustrationSummary, etc.
}
```

**Add three new card sections** below the existing stat cards:

1. **Cost Breakdown Card** (SectionCard organism):
   - Estimated cost (formatted as currency)
   - Cache hit rate (if available from messages with cachedTokens)
   - Per-model token usage summary (aggregate from assistant messages)
   - Use green/red coloring for cost vs savings

2. **Effectiveness Card** (SectionCard organism):
   - Turn count (number of user interactions)
   - Task completion: completed / total native tasks (computed from nativeTasks connection)
   - Compaction count with severity indicator (0 = green, 1-2 = yellow, 3+ = red)
   - Frustration level (from existing frustrationSummary data)
   - Hook pass rate (from hookStats.passRate)

3. **Activity Summary Card** (SectionCard organism):
   - Duration (formatted as human-readable: "2h 15m", "3d 4h")
   - Model used (extract from assistant messages or session-level field)
   - Top 5 tools by usage count (from tool use blocks in messages, or aggregate if available)
   - File impact count (already exists, keep it)

**Component pattern**: Use existing atoms (`Box`, `HStack`, `VStack`, `Text`, `Heading`) and molecules (`StatItem`). Follow the existing card pattern in DashboardPage for visual consistency. Import from `@/components/atoms` and `@/components/molecules`.

**Layout**: Two-column grid below the existing stat row, matching the dashboard card layout.

### What the user sees

Before: 5 stat cards (Messages, Turns, Duration, Cost, Compactions) + File Impact count = sparse page with whitespace

After: 5 stat cards + Cost Breakdown card + Effectiveness card + Activity Summary card = rich overview answering "was this session worth it?"

## Success Criteria

- [ ] Overview tab shows cost breakdown (estimated cost, cache metrics if available)
- [ ] Overview tab shows effectiveness metrics (turns, tasks completed/total, compactions, frustration, hook pass rate)
- [ ] Overview tab shows activity summary (duration, model, top tools, file impact)
- [ ] New cards use existing atom/molecule/organism components (no HTML tags)
- [ ] No TypeScript errors (`bun run typecheck` passes)

## Risks

- **Per-model aggregation**: The Session type may not expose per-model token aggregation directly. Mitigation: Check if `ActivityData.modelUsage` can be queried with a session filter, or compute from the messages connection.
- **Cache hit rate**: May not be a session-level field. Mitigation: Check if it's in the existing `costAnalysis` data or computable from message-level cachedTokens.

## Boundaries

This unit does NOT:
- Modify the Messages tab, Tasks tab, or Files tab
- Add new backend GraphQL resolvers or fields
- Modify the Dashboard home page or Repo Detail page
- Handle Project Detail enrichment (unit-02)
- Fix bugs (unit-03)

## Notes

- Check the existing `OverviewTab_session` fragment first — it may already query some of these fields but not render them
- The `DashboardPage` and `RepoDetailPage` have similar card patterns — use them as visual reference
- Follow the atomic design hierarchy: atoms for primitives, molecules for stat items, organisms for section cards
- Ensure all text content is wrapped in `<Text>` components (react-native-web requirement)

