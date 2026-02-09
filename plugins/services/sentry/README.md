# Hashi: Sentry

Connect Claude Code to Sentry for AI-native error tracking, performance monitoring, and incident response in your engineering workflows.

**OAuth Enabled**: Seamlessly authenticate with your Sentry organization using OAuth - no manual token management required!

## What This Hashi Provides

### MCP Server: sentry

This hashi uses the official [Sentry MCP Server](https://github.com/getsentry/sentry-mcp-stdio) to provide direct access to Sentry's observability platform with 16+ tools for:

- **Error Tracking**: Search, investigate, and resolve errors and exceptions
- **Performance Monitoring**: Analyze transaction performance and identify bottlenecks
- **Release Health**: Track crash-free rates and deployment quality
- **Incident Response**: Coordinate response to production issues with Seer AI assistance
- **Project Management**: Manage organizations, projects, and teams
- **Custom Queries**: Advanced filtering and analysis of events

## Available Tools

Once installed, Claude Code gains access to these tool categories:

### Core Management

- `list_organizations`: List Sentry organizations you have access to
- `list_projects`: List projects within an organization
- `list_teams`: List teams in your organization
- `get_project_details`: Get detailed information about a project
- `get_dsn`: Retrieve Data Source Name for SDK configuration

### Error Investigation

- `search_issues`: Search for issues with advanced filtering
- `get_issue_details`: Get comprehensive details about a specific issue
- `resolve_issue`: Mark an issue as resolved
- `assign_issue`: Assign an issue to a team member
- `update_issue_status`: Update issue status (resolved, ignored, etc.)

### Performance Analysis

- `query_performance`: Query performance monitoring data
- `get_transaction_details`: Analyze specific transaction performance
- `get_span_details`: Investigate span-level performance

### Release Management

- `list_releases`: List releases for a project
- `get_release_details`: Get release health metrics
- `create_release`: Create a new release

### AI-Powered Analysis

- `seer_analyze`: Use Sentry's Seer AI for automated root cause analysis and suggested fixes

## Installation

Install with npx (no installation required):

```bash
han plugin install sentry
```

## Authentication

### Sentry Cloud (Default)

The Sentry MCP server uses OAuth for authentication:

1. Install the plugin (authentication happens automatically)
2. On first use, you'll be prompted to authorize Claude Code
3. Login to Sentry with your existing credentials
4. Grant the necessary permissions
5. Start using Sentry tools immediately

**Note**: If you join new Sentry organizations, you'll need to re-authenticate to access those organizations.

### Self-Hosted Sentry

For self-hosted Sentry instances, set the `SENTRY_MCP_URL` environment variable:

```bash
export SENTRY_MCP_URL=https://sentry.example.com/mcp
```

The plugin defaults to `https://mcp.sentry.dev/mcp` (Sentry cloud) when the variable is not set. OAuth authentication is handled by Claude Code automatically.

## Available Slash Commands

This plugin provides workflow-focused commands for common observability tasks:

### `/investigate-errors`

Investigate recent errors and exceptions in your Sentry projects. Analyzes error patterns, trends, affected users, and provides actionable insights.

**Example:**

```
/investigate-errors my-web-app 24h
```

### `/analyze-performance`

Analyze performance metrics and identify slow transactions. Reviews latency percentiles, throughput, bottlenecks, and suggests optimizations.

**Example:**

```
/analyze-performance backend-api 7d
```

### `/check-releases`

Check release health and compare error rates across deployments. Tracks crash-free rates, new issues, and helps identify problematic releases.

**Example:**

```
/check-releases frontend-app v2.4.0
```

### `/query-events`

Run custom queries on Sentry events with advanced filtering. Supports complex queries by environment, release, user, tags, and more.

**Example:**

```
/query-events api-service Find all errors in production for enterprise users
```

### `/incident-response`

Manage incident response workflow with Sentry alerts. Coordinates detection, triage, mitigation, and post-incident analysis.

**Example:**

```
/incident-response
```

## Usage Examples

### Example 1: Investigate Recent Errors

```
User: I'm seeing error reports from users. Can you check Sentry?

Claude: [Uses search_issues to find recent errors]

I found 3 significant error spikes in the last hour:

1. TypeError: Cannot read property 'id' of undefined (156 events, 45 users)
2. NetworkError: API timeout (89 events, 23 users)
3. ValidationError: Invalid email format (34 events, 12 users)

The TypeError appears to be a regression from the v2.3.1 deployment 2 hours ago.
Would you like me to investigate the TypeError in detail?
```

### Example 2: Analyze Performance Degradation

```
User: Users are reporting the app is slow. What's going on?

Claude: [Uses query_performance to analyze transaction data]

I've identified a performance regression:

- POST /api/users/search is 300% slower than last week (P95: 3.2s vs 0.8s)
- Root cause: Database query scanning full users table
- Affected users: 234 in the last 24 hours

Recommendation: Add an index on users.email to optimize the search query.
```

### Example 3: Check Release Health

```
User: How is the v3.0.0 release performing?

Claude: [Uses get_release_details to fetch health metrics]

Release v3.0.0 health report:
- Crash-free sessions: 97.2% (↓ 1.9% vs v2.9.5)
- Crash-free users: 98.1%
- New issues: 5
- Adoption: 78% of active users

⚠️ Quality concern: The crash-free rate is below your 99% target.
Top issue: TypeError in UserProfile component (478 events, 234 users)

Should I investigate the TypeError or would you like to consider a rollback?
```

### Example 4: Use Seer AI for Root Cause Analysis

```
User: What's causing issue PROJ-1234?

Claude: [Uses get_issue_details and seer_analyze]

Analyzing issue PROJ-1234 with Seer AI...

Root Cause: Null pointer exception in payment processing
- Trigger: Payment amount field is null when user cancels during checkout
- Code location: src/payments/processor.ts:145
- Introduced in: v3.2.1

Suggested Fix:
Add null check before accessing payment.amount:
```typescript
if (!payment || payment.amount === null) {
  throw new PaymentCancelledException();
}
```

Would you like me to create a fix branch?

```

### Example 5: Respond to Production Incident

```

User: We have a production outage! Error rate is through the roof!

Claude: [Uses search_issues and incident-response workflow]

🚨 Critical Incident Detected:

Service: payment-processor
Error Rate: 45% (normal: 0.2%)
Affected Users: ~2,300
Duration: 23 minutes

Primary Issue: TypeError in payment amount processing
Correlation: v3.2.1 deployment 25 minutes ago

Immediate Recommendation: Rollback to v3.2.0

Would you like me to:

1. Guide the rollback process
2. Investigate the root cause
3. Draft an incident communication?

```

## Tool Reference

### `search_issues`

**Purpose**: Search for issues with advanced filtering

**Parameters**:
- `project` (required): Project slug
- `query` (optional): Search query expression
- `status` (optional): resolved, unresolved, ignored
- `environment` (optional): production, staging, etc.

### `get_issue_details`

**Purpose**: Get comprehensive details about a specific issue

**Parameters**:
- `issue_id` (required): Issue identifier
- `include_events` (optional): Include recent event samples

### `query_performance`

**Purpose**: Query performance monitoring data

**Parameters**:
- `project` (required): Project slug
- `query` (required): Performance query expression
- `timeframe` (optional): Time range for analysis

### `seer_analyze`

**Purpose**: Use Sentry's AI for automated root cause analysis

**Parameters**:
- `issue_id` (required): Issue to analyze
- `include_fix_suggestions` (optional): Request fix suggestions

## Integration with SDLC

The hashi-sentry plugin supports the **Deploy & Maintain** phase:

- **Monitoring**: Continuous error and performance tracking
- **Alerting**: Proactive incident detection
- **Investigation**: AI-powered root cause analysis
- **Response**: Structured incident management
- **Learning**: Post-incident analysis and prevention

## Security Considerations

- **OAuth Security**: Uses Sentry's OAuth flow - no tokens stored locally
- **Revoke Access**: Manage OAuth apps at Sentry Settings → Account → API → Authorized Applications
- **Minimal Privileges**: Only requests permissions needed for operations
- **HTTP Transport Only**: All connections use remote HTTP endpoints (cloud or self-hosted)

## Limitations

- Requires Sentry account and project setup
- Rate limits apply based on your Sentry plan
- OAuth re-authentication required when joining new organizations
- Some advanced features require Sentry Business or Enterprise plans
- Seer AI availability depends on your Sentry plan

## Troubleshooting

### Issue: OAuth authentication fails

**Solution**: Ensure you have:
- A valid Sentry account
- Access to at least one Sentry organization
- Not blocked Sentry OAuth in browser/firewall

### Issue: "Project not found" errors

**Solution**: Verify:
- You have access to the project in Sentry
- The project slug is correct (case-sensitive)
- You've re-authenticated if you recently joined the organization

### Issue: Seer AI not available

**Solution**: Seer AI requires:
- Sentry Business or Enterprise plan
- Feature enabled for your organization
- Contact Sentry support to enable if needed

### Issue: Rate limiting

**Solution**:
- Rate limits vary by Sentry plan
- Upgrade plan for higher limits
- Reduce query frequency if hitting limits

## Related Plugins

- **hashi-github**: Integrate error tracking with code and PRs
- **hashi-datadog**: Complementary APM and infrastructure monitoring
- **bushido**: Quality principles for incident response and monitoring
