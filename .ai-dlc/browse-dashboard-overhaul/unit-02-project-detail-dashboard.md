---
status: completed
depends_on: []
branch: ai-dlc/browse-dashboard-overhaul/02-project-detail-dashboard
discipline: frontend
ticket: ""
---

# unit-02: Project Detail Dashboard Enrichment

## Description

Transform the Project Detail page from 3 stat cards and 4 quick-access links into a full dashboard view matching the treatment the Repo Detail page already receives. The Project Detail page should answer: "What's happening in this project?" with the same widget density as the dashboard home and repo detail pages.

## Discipline

frontend - This unit will be executed by `do-frontend-development` specialized agents.

## Domain Entities

- **Project**: id, slug, name, sessions (connection), worktrees, repoId
- **DashboardAnalytics**: costAnalysis, sessionEffectiveness, compactionStats, hookHealthStats, subagentUsage, toolUsage (scoped to project via filter)
- **Session**: estimatedCostUsd, turnCount, duration (for project-scoped aggregation)

## Data Sources

The data comes from the existing GraphQL API. The `DashboardAnalytics` type already supports scoping via the GreenFairy filter pattern. Key queries:

**Already available (need to add to Project Detail page):**
- `dashboardAnalytics(filter: { session: { projectId: { _eq: $projectId } } })` - Returns all analytics scoped to the project
  - `costAnalysis` - Cost trends, cache hit rate, subscription comparisons
  - `sessionEffectiveness` - Score, sentiment, focus, task completion
  - `compactionStats` - Compaction frequency and severity
  - `hookHealthStats` - Hook pass rates scoped to project sessions
  - `subagentUsage` - Subagent spawn patterns
  - `toolUsage` - Tool usage breakdown

**Reference implementation:**
- `packages/browse-client/src/components/pages/RepoDetailPage/index.tsx` - Already renders dashboard widgets scoped to a repo. The Project Detail page should follow the same pattern but scoped to a project.
- `packages/browse-client/src/components/pages/DashboardPage/index.tsx` - Main dashboard with all widget types.

## Technical Specification

### File: `packages/browse-client/src/components/pages/ProjectDetailPage/index.tsx`

**Current state:** Renders 3 stat cards (Sessions count, Worktrees count, Repo link) and 4 quick-access links (Sessions, Worktrees, Repo, Settings). Most of the page is whitespace.

**Target state:** A full dashboard layout matching RepoDetailPage, with:

1. **Keep existing header** with project name, slug, and metadata
2. **Keep the quick-access links** row
3. **Add dashboard widgets below**, following the RepoDetailPage pattern:

**Widgets to add (matching RepoDetailPage/DashboardPage):**

1. **Activity Heatmap** - Daily session activity for the project
2. **Code Changes Chart** - File modifications over time
3. **Model Usage Chart** - Per-model token and cost breakdown
4. **Cost Analysis Card** - Cost trends, cache hit rate, subscription utilization
5. **Session Effectiveness Card** - Score distribution, sentiment trends
6. **Recent Sessions List** - Last 10 sessions with key metrics

**Query pattern:** Add a `dashboardAnalytics` query to the page's Relay fragment or use a separate `useLazyLoadQuery` call with the project's ID as a filter parameter:

```graphql
query ProjectDetailDashboardQuery($projectId: String!) {
  dashboardAnalytics(filter: { session: { projectId: { _eq: $projectId } } }) {
    costAnalysis {
      estimatedCostUsd
      cacheHitRate
      cacheSavingsUsd
      costPerSession
      dailyCostTrend { date value }
      weeklyCostTrend { date value }
    }
    sessionEffectiveness {
      score
      sentimentTrend
      focusScore
      taskCompletionRate
    }
    compactionStats {
      totalCompactions
      autoCompactions
      manualCompactions
    }
    toolUsage {
      toolName
      count
      avgDurationMs
    }
    subagentUsage {
      agentType
      count
      avgTurns
    }
  }
}
```

**Component reuse:** Import and reuse existing dashboard widget components from the DashboardPage or RepoDetailPage. These components already exist as organisms:
- `ActivityHeatmap` or equivalent chart component
- `CostAnalysisCard` (SectionCard organism)
- `SessionEffectivenessCard` (SectionCard organism)
- `ModelUsageChart`
- `ToolUsageChart`
- `SubagentUsageChart`

If these are currently tightly coupled to their parent pages via Relay fragments, extract them into reusable organisms that accept data as props, or create project-specific versions that query their own data.

**Layout:** Two-column grid matching the dashboard and repo detail pages. Use `HStack` wrapping to `VStack` on narrow viewports if the existing pattern supports it.

### What the user sees

Before: Project name + 3 stat cards + 4 links = mostly empty page with no insight into project health

After: Project name + stat cards + links + Activity Heatmap + Code Changes + Model Usage + Cost Analysis + Session Effectiveness + Recent Sessions = rich project overview answering "what's happening in this project?"

## Success Criteria

- [ ] Project Detail page renders project-scoped dashboard widgets (activity, code changes, model usage, cost analysis)
- [ ] Dashboard widgets use existing atom/molecule/organism components (no HTML tags)
- [ ] Data is correctly scoped to the project (not showing global data)
- [ ] No TypeScript errors (`bun run typecheck` passes)

## Risks

- **Widget component coupling**: Dashboard widgets may be tightly coupled to DashboardPage via Relay fragments. Mitigation: Check if they accept data props or need fragment extraction. Worst case, create project-specific versions.
- **DashboardAnalytics filter support**: The `dashboardAnalytics` query may not support filtering by project directly. Mitigation: Check the GraphQL schema for the exact filter input type. If not available, use sessions connection filtered by projectId and compute aggregates client-side.
- **Empty state**: New projects with zero sessions should show a meaningful empty state, not broken charts. Mitigation: Add conditional rendering for each widget when data is empty.

## Boundaries

This unit does NOT:
- Modify the Dashboard home page or Repo Detail page
- Add new backend GraphQL resolvers or fields
- Modify the Session Detail page (unit-01)
- Fix bugs (unit-03)
- Add new widget types not already present on the dashboard home or repo detail pages

## Notes

- Start by reading `RepoDetailPage/index.tsx` — it's the closest reference for what this page should look like
- Check how `DashboardPage` passes data to its widget components — follow the same pattern
- The GreenFairy filter pattern means all connection queries accept structured `filter` inputs
- Follow the atomic design hierarchy: reuse existing organisms, don't create new ones unless unavoidable
- Ensure all text content is wrapped in `<Text>` components (react-native-web requirement)
