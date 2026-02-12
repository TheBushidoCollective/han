---
name: investigate-errors
description: Investigate recent errors and exceptions in your Sentry projects
---

# Investigate Recent Errors

## Name

sentry:investigate-errors - Investigate recent errors and exceptions in your Sentry projects

## Synopsis

```
/investigate-errors [arguments]
```

## Description

Investigate recent errors and exceptions in your Sentry projects to identify issues, patterns, and root causes.

## Implementation

This command helps you quickly triage and investigate errors captured by Sentry across your projects.

## Usage

```
/investigate-errors [project-name] [timeframe]
```

## What This Command Does

1. Asks for the Sentry project name (or lists available projects)
2. Requests timeframe (e.g., last 24h, last 7d, custom)
3. Fetches recent error issues using Sentry MCP tools
4. Analyzes error patterns and trends
5. Provides insights on:
   - Most frequent errors
   - Recent error spikes
   - Affected users/sessions
   - Error distribution by release/environment
   - Stack traces and context
6. Suggests next steps for investigation

## Prerequisites

- Sentry MCP server must be installed and configured
- OAuth authentication with Sentry must be completed
- Access to the target Sentry project(s)

## Example Interaction

```
User: /investigate-errors my-web-app 24h

Claude: Investigating errors in my-web-app for the last 24 hours...

## Error Investigation Report

### Overview
- **Total Issues**: 12 error issues
- **Total Events**: 347 error events
- **Affected Users**: 89 unique users
- **Time Range**: Last 24 hours

### Top Issues

1. **TypeError: Cannot read property 'id' of undefined**
   - Events: 156
   - Users: 45
   - First Seen: 23h ago
   - Last Seen: 12m ago
   - Environment: production
   - Release: v2.3.1
   - Trend: Increasing (spike in last 6 hours)

2. **NetworkError: Failed to fetch user data**
   - Events: 89
   - Users: 23
   - First Seen: 18h ago
   - Last Seen: 1h ago
   - Environment: production
   - Release: v2.3.1

3. **ReferenceError: localStorage is not defined**
   - Events: 67
   - Users: 34
   - First Seen: 22h ago
   - Last Seen: 3h ago
   - Environment: production, staging

### Key Patterns

- 45% of errors correlate with v2.3.1 deployment 23h ago
- TypeError spike began 6 hours after deployment
- NetworkError appears to be intermittent (API flakiness?)
- localStorage errors isolated to server-side rendering context

### Recommendations

1. **Immediate**: Investigate TypeError in v2.3.1 - likely regression in user data handling
2. **High Priority**: Check API stability for fetch failures
3. **Medium Priority**: Add server-side rendering guards for localStorage access

Would you like me to dive deeper into any specific error?
```

## Arguments

- `project-name` (optional): Sentry project slug
- `timeframe` (optional): Time range (1h, 24h, 7d, 30d, or custom)

## Tips

- Start with shorter timeframes for faster investigation
- Look for error spikes that correlate with deployments
- Use error grouping to identify patterns
- Check release and environment tags for correlation
- Review stack traces for common code paths
- Use Seer AI for automated root cause analysis

## Related Commands

- `/analyze-performance`: Investigate performance issues
- `/check-releases`: Review recent release health
- `/query-events`: Run custom Sentry queries
