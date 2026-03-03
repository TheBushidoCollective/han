---
workflow: default
git:
  change_strategy: unit
  auto_merge: true
  auto_squash: false
announcements: []
created: 2026-03-02
status: active
epic: ""
---

# Browse Dashboard Overhaul

## Problem

The Han browse dashboard has significant gaps in functionality and data presentation, discovered through systematic Playwright-based exploration. The Session Detail Overview tab shows only 5 stat cards despite the GraphQL schema having rich computed fields for cost, effectiveness, and activity. The Project Detail page is nearly empty (3 stat cards + 4 quick links). Multiple bugs degrade the experience: a connection overlay flashes on every page navigation, react-native-web text node violations produce console errors, invalid routes show blank pages, and the sessions list lacks sorting.

## Solution

Enrich the core dashboard flow (Dashboard -> Sessions -> Session Detail) by querying existing GraphQL fields that the frontend doesn't currently use. Fill the Project Detail page with the same dashboard widget treatment the Repo Detail page already has. Fix the 5 identified bugs and add session list sorting. All work is frontend-only — the GraphQL schema already exposes the necessary data.

## Domain Model

### Entities
- **Session** - Core entity with 449+ sessions. Fields: id, sessionId, slug, name, projectId, estimatedCostUsd, turnCount, compactionCount, duration, hookStats, fileChanges, nativeTasks, messages, status, gitBranch, prNumber, prUrl
- **Message** - 27 variants (RegularUserMessage, AssistantMessage, HookRunMessage, etc.). AssistantMessage has: model, inputTokens, outputTokens, cachedTokens, hasThinking, toolUseCount
- **NativeTask** - Claude Code TaskCreate/TaskUpdate events. Fields: id, subject, status, activeForm, owner, blocks, blockedBy
- **Project** - Config directory grouping. Fields: id, slug, name, sessions, worktrees, repoId
- **Repo** - Git repository. Fields: id, name, url, sessions
- **DashboardAnalytics** - Computed aggregates: costAnalysis, sessionEffectiveness, compactionStats, hookHealthStats, subagentUsage, toolUsage
- **HookExecution** - Plugin hook runs. Fields: hookType, hookName, passed, durationMs, exitCode
- **FileChange** - File modifications. Fields: filePath, action, toolName

### Relationships
- Session belongs to Project (via projectId)
- Project belongs to Repo (via repoId)
- Session has many Messages, NativeTasks, FileChanges, HookExecutions
- AssistantMessage has many ContentBlocks (TextBlock, ThinkingBlock, ToolUseBlock)

### Data Sources
- **GraphQL API** (Rust, async-graphql via han-rs on port 41957): All session data, computed analytics. Supports GreenFairy filter pattern with association filtering.
- **SQLite** (via han-native Rust NAPI-RS): JSONL transcript indexing, FTS5 search, DataLoader-compatible batch queries.
- **Relay** (frontend): Fragment-based data fetching, @refetchable pagination, GraphQL subscriptions for real-time updates.

### Data Gaps
- No backend gaps — the GraphQL schema has all needed fields already implemented
- Frontend gap: Session Detail Overview queries only basic stats, not cost/effectiveness/activity fields
- Frontend gap: Project Detail page queries only metadata, not dashboard analytics scoped to project

## Success Criteria
- [ ] Session Detail Overview tab renders cost breakdown (per-model tokens, estimated cost, cache hit rate)
- [ ] Session Detail Overview tab renders effectiveness metrics (turn count, task completion rate, compaction count, focus score, sentiment trend)
- [ ] Session Detail Overview tab renders activity summary (model used, duration, tool usage breakdown)
- [ ] Project Detail page renders project-scoped dashboard widgets (activity heatmap, code changes, model usage, cost analysis)
- [ ] Connection overlay does not flash/appear on page navigations when coordinator is already connected
- [ ] No "Unexpected text node" console errors from react-native-web
- [ ] Invalid routes display a 404 Not Found page with navigation back to dashboard
- [ ] PluginListPageToggleMutation relay artifact is regenerated (no stale definition warning)
- [ ] Sessions list page supports sorting (by date, cost, turns, duration)
- [ ] All existing Playwright BDD tests continue to pass

## Context
- Dashboard accessible via `han browse --local` on port 41956 (local) or `dashboard.local.han.guru` (remote)
- Coordinator runs on port 41957 with TLS
- Frontend uses react-native-web with Gluestack UI — NO HTML tags allowed
- Atomic design structure: atoms -> molecules -> organisms -> templates -> pages
- VirtualList (FlashList) required for paginated data, inverted for chat logs
- GreenFairy filter pattern: all connection fields use structured filter input types
- All GraphQL filters are macro-generated via `#[derive(EntityFilter)]`
