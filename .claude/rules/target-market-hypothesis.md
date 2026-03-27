# Target Market Hypothesis

## Context

This document captures the working hypothesis for Han's target market, value propositions, data gaps, and go-to-market strategy. It is a living document intended to guide product decisions, not a final business plan. All assumptions should be validated against real user behavior and willingness to pay.

## 1. Primary Market Segments

### Segment A: Individual Power Users (Claude Code Max/Pro subscribers)

**Who:** Software engineers spending $100-200/month on Claude Code subscriptions, working on multiple projects, using Han locally for personal productivity visibility.

**Why they would pay:** They already pay for AI coding. Han's cost analysis card shows subscription utilization, value multiplier, and break-even calculations. These users want to know whether their Max subscription is justified. The dashboard answers "am I actually getting $200/month of value?" with real data. They also benefit from hook health monitoring, session effectiveness scoring, and memory search across sessions.

**Current evidence:** The CostAnalysisCard already shows subscription tier comparisons, API-equivalent cost, and value multiplier. This is the data a power user opens the dashboard to see.

**Willingness to pay:** Low to moderate as individuals. Most value here is as free-tier adoption that feeds bottom-up growth into teams.

### Segment B: Tech Leads Managing 3-8 AI-Augmented Engineers

**Who:** Senior engineers or tech leads responsible for a team's output quality. They adopted Claude Code, got their team on it, and now need to understand whether it is actually helping.

**Why they would pay:** The team dashboard shows sessions by project, task completion rates, token usage aggregation, and activity timelines across contributors. But what they really need (and what currently has gaps) is the ability to answer: "Are my engineers using Claude Code effectively, or are they burning tokens on sessions that go nowhere?"

**Current evidence:** TeamDashboardContent already shows total sessions, total tasks, success rate, estimated cost, sessions by project, task outcomes (success/partial/failure), and top contributors with success rates. The ExportButton enables data extraction for reporting.

**Willingness to pay:** Moderate. This is the segment most likely to convert from free to paid. They need justification data for their engineering manager.

### Segment C: Engineering Managers and Directors (Budget Holders)

**Who:** People managing 20-100+ engineers, responsible for engineering budget and productivity metrics. They report to a VP/CTO on whether AI tooling investment is paying off.

**Why they would pay:** They need to justify $200/seat/month * N engineers to finance. That is $2,400/engineer/year. For a 50-person team, that is $120K/year in AI tooling spend. They need data proving ROI, not just token counts. Han's existing metrics (cost per session, cost per completed task, cache hit rates, subscription utilization) are the raw ingredients, but these managers need them aggregated across teams with trend lines and exportable reports.

**Willingness to pay:** High, if the data answers the ROI question convincingly. This is the enterprise buyer.

### Segment D: DevOps/Platform Engineering Teams

**Who:** Teams responsible for developer tooling and infrastructure. They manage Claude Code deployment across the organization, configure MCP servers, maintain hooks, and ensure the development environment is healthy.

**Why they would pay:** Hook health monitoring (pass/fail rates, average durations), compaction health (context window management), slot coordination, and plugin management across scopes (user/project/local). They need operational health data for the AI development infrastructure.

**Current evidence:** HookHealthCard shows per-hook pass rates, failure counts, and average durations. CompactionHealthCard tracks auto/manual compactions and sessions hitting context limits. Plugin stats show total/enabled/scoped plugin counts.

**Willingness to pay:** Moderate, bundled with team/enterprise tier.

## 2. User Personas by Role

### Individual Developer

**What they open the dashboard for:**
- "How much am I spending?" (CostAnalysisCard: daily/weekly trends, subscription utilization)
- "What did I work on this week?" (Activity heatmap, session list, task history)
- "Which sessions were productive?" (SessionEffectivenessCard: top/bottom sessions by score)
- "What tools am I using most?" (ToolUsageChart, SubagentUsageChart)
- "What time am I most productive?" (TimeOfDayChart)

**Dashboard consumption pattern:** Glances at it once or twice a day. Cares about personal streaks, cost efficiency, and session history. Wants drill-down into specific sessions.

**What they ignore:** Team metrics, organizational views, export buttons.

### Tech Lead

**What they open the dashboard for:**
- "Are my team members actually using Claude Code?" (Team dashboard: contributor activity)
- "Which projects are getting the most AI assistance?" (SessionsByProjectChart)
- "Are tasks being completed successfully?" (TaskOutcomesChart: success/partial/failure breakdown)
- "Where is the budget going?" (Cost per project breakdown via configDirBreakdowns)
- "Are hooks passing?" (HookHealthCard: CI validation hooks failing = bad code getting through)

**Dashboard consumption pattern:** Weekly review. Compares team members' usage patterns. Exports data for sprint retrospectives. Drills into specific contributors or projects when something looks off.

**What they need that is missing:** See Data Gaps section below.

### Engineering Manager

**What they open the dashboard for:**
- "What is our AI tooling ROI?" (Cost analysis across organization)
- "Are we getting faster?" (Trend lines over months, not just 30-day snapshots)
- "Which teams are adopting effectively?" (Cross-team comparison)
- "Should we increase/decrease seat count?" (Utilization data)
- Monthly/quarterly executive reports

**Dashboard consumption pattern:** Monthly or quarterly. Wants pre-built reports, PDF exports, and trend comparisons. Does not want to navigate session-level details.

**What they need that is missing:** See Data Gaps section below.

### VP of Engineering / CTO

**What they open the dashboard for:**
- "Is our AI investment paying off at the org level?" (Single number: ROI multiplier)
- "How does our usage compare to industry?" (Benchmarks)
- "What is the total cost of AI tooling?" (Aggregated across all teams)
- Board-ready slides showing AI adoption impact

**Dashboard consumption pattern:** Quarterly. Receives a report, not a dashboard. Needs 3-5 metrics with clear directional arrows (up/down/flat). Does not log in to Han.

**What they need that is missing:** See Data Gaps section below.

### DevOps / Platform Engineer

**What they open the dashboard for:**
- "Are hooks healthy across all projects?" (HookHealthCard)
- "Are any MCP servers failing?" (Currently not tracked)
- "How often are sessions hitting context limits?" (CompactionHealthCard)
- "What plugins are installed and where?" (Plugin stats by scope)
- "Is the coordinator daemon healthy?" (Live status)

**Dashboard consumption pattern:** Operational monitoring. Wants alerts, not dashboards. Checks when something breaks.

**What they need that is missing:** Alerting, MCP server health, coordinator uptime metrics.

## 3. Value Propositions

### Unique to Han (No Alternative Exists)

1. **Claude Code session-level observability.** No other tool indexes Claude Code JSONL transcripts and provides session replay, message timelines, tool usage, and subagent tracking. This is Han's core moat. Anthropic's own console shows API usage, not session-level developer experience data.

2. **Hook system health monitoring.** Han's hook architecture (PreToolUse, PostToolUse, Stop, SessionStart) is unique. The dashboard showing hook pass/fail rates with timing data is infrastructure observability that only applies to Han-managed Claude Code environments.

3. **Cost analysis with subscription intelligence.** The CostAnalysisCard does not just show token costs. It calculates subscription utilization percentage, value multiplier (API-equivalent vs subscription price), break-even daily spend, and tier comparison recommendations. No other tool does this for Claude Code.

4. **Plugin ecosystem management.** Visibility into which plugins are installed at which scope (user/project/local), with category breakdowns. This matters for organizations standardizing their Claude Code configuration.

### Differentiated (Alternatives Exist but Are Weaker)

1. **AI coding activity heatmaps.** GitHub Copilot has usage dashboards, but they show acceptance rates, not session-level productivity. Han's activity heatmap shows daily engagement patterns with token and code change breakdowns.

2. **Task completion tracking.** LinearB and Jellyfish track PR cycle time and DORA metrics. Han tracks AI-assisted task completion with success/partial/failure outcomes and confidence calibration scores. Different signal, different granularity.

3. **Model usage analysis.** The ModelUsageChart shows which models (Opus, Sonnet, Haiku) are being used across sessions with per-model token and cost breakdowns. Anthropic's console shows this at the API key level, not at the developer/project level.

## 4. Data Gaps to Fill

### Critical (Blocks Enterprise Sales)

**4.1. PR/Commit Correlation**
- **Gap:** No connection between Claude Code sessions and actual Git outcomes (PRs merged, commits landed, review cycles).
- **Why it matters:** Engineering managers cannot prove AI ROI without tying sessions to shipped code. "We spent $10K on Claude Code last month" means nothing without "and it contributed to 45 merged PRs."
- **Data source:** Git log correlation via session worktree detection, `gh pr list` data, PR linkage (`--from-pr` is already supported in Claude Code 2.1.27+).
- **Who needs it:** Engineering managers, VPs, CTOs.

**4.2. Time Savings Estimation**
- **Gap:** No metric for "time saved" or "time-to-completion comparison."
- **Why it matters:** The single most requested metric from budget holders. "Claude Code saves each engineer X hours per week" is the ROI story.
- **Approach:** Cannot measure counterfactual directly. Proxy metrics: (a) lines of code per session hour, (b) task completion rate trends over time, (c) session duration vs task complexity. Could also survey users for perceived time savings and aggregate.
- **Who needs it:** Engineering managers, VPs, CTOs.

**4.3. Per-User Analytics in Team Dashboard**
- **Gap:** Team dashboard shows "top contributors" but lacks per-user drill-down with individual cost, session count, success rate, and usage patterns.
- **Why it matters:** Tech leads need to identify who needs help or coaching. Managers need per-user cost allocation.
- **Privacy consideration:** Must be opt-in and role-gated. Individual developers should not see each other's metrics. Only leads/managers see team member details.
- **Who needs it:** Tech leads, engineering managers.

**4.4. Trend Lines and Period Comparisons**
- **Gap:** Dashboard shows 30-day snapshots. No week-over-week, month-over-month, or quarter-over-quarter trend comparisons.
- **Why it matters:** "Are we getting better?" requires trends, not snapshots. Executive reports need directional indicators.
- **Implementation:** The `activity(days: 730)` query already fetches up to 2 years of daily data. Need computed period comparisons and trend arrows.
- **Who needs it:** All personas above individual developer.

### Important (Improves Retention and Expansion)

**4.5. Session Quality Scoring Explanation**
- **Gap:** SessionEffectivenessCard shows a score, sentiment trend, focus score, and compaction count, but does not explain what makes a "good" session. Users see numbers without understanding what to change.
- **Why it matters:** Actionable insights drive engagement. "Your session scored 72 because you had 3 context compactions and low task completion" gives the user something to improve.
- **Who needs it:** Individual developers, tech leads.

**4.6. MCP Server Health and Usage**
- **Gap:** No visibility into MCP server uptime, response times, error rates, or which MCP tools are being used most.
- **Why it matters:** Organizations deploying multiple MCP servers (GitHub, GitLab, Playwright, context7) need operational health data.
- **Data source:** McpToolCallMessage and McpToolResultMessage are already indexed. Need to extract timing, errors, and aggregate by server.
- **Who needs it:** DevOps/platform engineers.

**4.7. Code Quality Correlation**
- **Gap:** No connection between AI-assisted sessions and downstream code quality (test pass rates, lint violations, PR review comments).
- **Why it matters:** If AI-generated code produces more bugs, the ROI story falls apart. Need to prove code quality is maintained or improved.
- **Data source:** Hook health (Stop hooks running linters/tests) partially covers this. Could correlate hook pass rates with specific sessions.
- **Who needs it:** Engineering managers, security leads.

**4.8. Context Window Efficiency**
- **Gap:** CompactionHealthCard shows compaction counts but not context utilization efficiency. How much of the context window is being used productively vs filled with irrelevant content?
- **Why it matters:** Power users want to optimize their prompting strategy. High compaction rates may indicate inefficient context usage.
- **Who needs it:** Individual developers, tech leads.

### Nice to Have (Differentiation and Delight)

**4.9. Industry Benchmarks**
- **Gap:** No comparison to "how other teams use Claude Code." Users see their metrics in isolation.
- **Why it matters:** Engineering leaders want to know if their adoption is typical, behind, or ahead. "Your team uses 2.3x more sessions than the median team of your size" is powerful.
- **Requires:** Anonymous aggregate data from opt-in users. Significant user base needed.
- **Who needs it:** Engineering managers, VPs.

**4.10. Custom Alerts and Thresholds**
- **Gap:** No alerting when hook failure rates spike, costs exceed budget, or session quality drops.
- **Why it matters:** DevOps teams need proactive monitoring, not reactive dashboard checking.
- **Who needs it:** DevOps/platform engineers, tech leads.

**4.11. Integration with Existing BI Tools**
- **Gap:** ExportButton exists but only exports raw JSON. No integration with Datadog, Grafana, or existing engineering analytics platforms.
- **Why it matters:** Enterprise teams will not adopt another dashboard. They want Han data flowing into their existing observability stack.
- **Who needs it:** Enterprise platform teams.

## 5. Pricing Hypothesis

### Free Tier (Individual / Community)

**Target:** Individual developers, open-source contributors.

**Includes:**
- Local dashboard (runs on your machine via `han browse`)
- Personal session history, cost analysis, activity heatmaps
- Plugin marketplace and installation
- Hook system and validation
- Memory system (local vector search)
- Unlimited local data retention

**Why free:** Bottom-up adoption. Every paying team starts with individual developers who fell in love with the tool for free. The local-first architecture means there is near-zero marginal cost per free user.

### Team Tier ($15-25/user/month)

**Target:** Tech leads and small teams (3-20 engineers).

**Includes everything in Free, plus:**
- Team dashboard with cross-contributor views
- Per-project cost allocation and breakdowns
- Data sync to hosted coordinator (aggregated team data)
- Exportable reports (PDF, CSV)
- Trend comparisons (week-over-week, month-over-month)
- Session quality coaching (actionable improvement suggestions)
- PR/commit correlation (once built)
- Role-based access (admin/member/viewer roles already exist in auth types)
- Organization management (Org/TeamMember types already scaffolded)

**Why this price:** Below the threshold that requires procurement approval at most companies. Comparable to LinearB starter pricing. At $20/user/month for a 10-person team, that is $200/month, which is the cost of a single Claude Code Max subscription. The value proposition: "Spend 1 extra seat-equivalent to understand whether the other 10 seats are worth it."

### Enterprise Tier ($40-60/user/month, or custom)

**Target:** Engineering organizations with 50+ Claude Code users.

**Includes everything in Team, plus:**
- SSO/SAML integration
- Custom data retention policies
- Industry benchmarks (anonymized aggregate comparisons)
- Custom alerting and thresholds
- API access for BI tool integration (Datadog, Grafana, Tableau)
- Dedicated support
- Time savings estimation model
- Compliance and audit logging
- Multi-organization support
- On-premises coordinator option

**Why this price:** At scale, AI tooling spend becomes a significant budget line. A 100-engineer team on Claude Code Max spends $240K/year. An enterprise Han license at $50/user/month ($60K/year) is 25% of the AI tool spend, which is reasonable if it provides the ROI data to justify (or optimize) the other $240K.

## 6. Competitive Positioning

### vs GitHub Copilot Metrics Dashboard

GitHub Copilot's built-in analytics show acceptance rates, lines of code suggested, and active users. This is input-focused ("how much did the AI suggest?") not output-focused ("did the AI help ship working code?"). Han's session-level observability, task completion tracking, and cost analysis provide fundamentally different signal. Han also works with Claude Code specifically, which means it understands the agentic workflow (tool use, subagents, hooks, MCP calls) that Copilot's chat-only model does not have.

**Positioning:** Han is to Claude Code what Datadog is to infrastructure. Copilot metrics is a simple counter; Han is observability.

### vs LinearB / Jellyfish / Pluralsight Flow

These tools focus on engineering productivity using Git data: PR cycle time, DORA metrics, sprint velocity. They do not understand AI coding sessions at all. They cannot tell you whether Claude Code helped or hurt. Han's data starts from the AI session and works outward toward Git outcomes. These tools start from Git and have no visibility into the AI interaction.

**Positioning:** Complementary, not competitive. Han feeds data that these tools cannot access. The PR/commit correlation gap (section 4.1) is the bridge: once Han connects sessions to PRs, it becomes a data source for existing engineering analytics, not a replacement.

### vs Anthropic Console / API Dashboard

Anthropic's console shows API-level usage: tokens consumed, models used, costs by API key. This is infrastructure-level billing data, not developer-level productivity data. Han operates at the session level: which developer, which project, which task, what was the outcome, how efficient was the context window usage.

**Positioning:** Anthropic's console is for the CTO who pays the API bill. Han is for the engineering manager who needs to know if the money is well spent.

### vs Build-Your-Own (Querying JSONL Files Directly)

Some teams will attempt to build their own analytics by parsing Claude Code's JSONL transcripts. This is exactly what Han's Rust-native indexer does, but with FTS5 search, proper message correlation (tool calls to results, hooks to outcomes), and a GraphQL API. Building this from scratch takes significant engineering effort and ongoing maintenance as Claude Code's message format evolves.

**Positioning:** "We already built the hard part. You do not need a data engineering sprint to understand your Claude Code usage."

## 7. Go-to-Market Strategy

### Phase 1: Developer Adoption (Bottom-Up)

**Tactic:** The free local dashboard. Developers install Han for the plugin marketplace, get the dashboard as a bonus, and start understanding their own Claude Code usage. The activity heatmap, cost analysis, and session effectiveness cards create habitual dashboard checking.

**Distribution:** Already happening via `claude plugin install core@han` which installs the hooks and coordinator. The `han browse` command launches the dashboard. npm distribution (`npx -y @thebushidocollective/han browse`) means zero global install needed.

**Conversion trigger:** Developer shows dashboard to their tech lead. Tech lead wants to see team-level data. Team-level data requires the Team tier.

### Phase 2: Team Adoption (Tech Lead as Champion)

**Tactic:** Tech lead enables team data sync, sees aggregate metrics, and starts using the team dashboard for sprint reviews. The export button creates shareable reports.

**Conversion trigger:** Engineering manager asks "can we get this for the whole org?" or "can we track AI ROI for budget review?" This requires the Enterprise tier.

### Phase 3: Enterprise Expansion (Manager as Buyer)

**Tactic:** Engineering manager needs to justify AI tooling spend to VP/CTO. Han provides the data. The ROI report becomes the sales tool.

**Conversion trigger:** VP asks for quarterly AI impact reports. Han's Enterprise tier provides automated reports with trend comparisons and benchmarks.

### Content Marketing Focus

1. **"Is your Claude Code Max subscription worth it?"** - Blog post showing the cost analysis dashboard, subscription utilization, and value multiplier. Targets individual developers considering the $200/month plan.

2. **"How to measure AI coding ROI for your engineering team"** - Targets engineering managers. Shows what metrics matter and how Han provides them.

3. **"The Claude Code observability gap"** - Targets DevOps/platform teams. Makes the case that AI coding tools need the same operational monitoring as any other production infrastructure.

### Key Metrics to Track for Go-to-Market Validation

- Free-to-team conversion rate (target: 5-10% of active free users within 6 months)
- Dashboard daily active users (leading indicator of habit formation)
- Export button usage (leading indicator of team sharing)
- Team dashboard page views vs individual dashboard (indicates team interest)
- Session count per user per week (engagement depth)
- Feature requests mentioning "team," "org," "manager," or "report" (demand signal for paid tiers)

## 8. Risks and Open Questions

1. **Anthropic builds this in.** If Claude Code ships native analytics that cover Han's dashboard capabilities, the observability value proposition weakens. Mitigation: Han's plugin ecosystem, hook system, and memory layer provide value beyond pure analytics.

2. **Privacy concerns with team visibility.** Developers may resist their sessions being visible to managers. Mitigation: Role-based access, opt-in team sync, and clear data ownership policies.

3. **Free tier too generous.** If the local dashboard solves 90% of the use case, teams may not convert. Mitigation: Team aggregation, trend comparisons, and PR correlation are genuinely multi-user features that do not work locally.

4. **Market size uncertainty.** Claude Code's user base is growing but the total addressable market of "teams with 5+ Claude Code users who want analytics" is not yet proven at scale.

5. **Data accuracy.** The dashboard shows estimated costs based on token counts and published pricing. If estimates diverge significantly from actual Anthropic bills, trust erodes. The `isEstimated` badge (already shown in CostAnalysisCard) partially addresses this, but accuracy improvements are needed.
