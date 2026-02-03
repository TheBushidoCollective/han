---
description: Check release health and compare error rates across deployments
---

# Check Release Health

## Name

hashi-sentry:check-releases - Check release health and compare error rates across deployments

## Synopsis

```
/check-releases [arguments]
```

## Description

Check the health of recent releases in Sentry to identify problematic deployments, track adoption rates, and compare error rates.

## Implementation

This command helps you monitor release quality and quickly identify if a new deployment introduced regressions.

## Usage

```
/check-releases [project-name] [release-version]
```

## What This Command Does

1. Lists recent releases for the specified project
2. Fetches release health metrics using Sentry MCP tools
3. Analyzes release data including:
   - Crash-free session rate
   - Crash-free user rate
   - Total sessions/users
   - New error issues introduced
   - Adoption rate over time
4. Compares current release with previous releases
5. Identifies problematic releases
6. Provides recommendations for rollback or monitoring

## Prerequisites

- Sentry MCP server must be installed and configured
- OAuth authentication with Sentry must be completed
- Release tracking configured in Sentry
- Access to the target Sentry project

## Example Interaction

```
User: /check-releases frontend-app v2.4.0

Claude: Checking release health for frontend-app v2.4.0...

## Release Health Report

### Release: v2.4.0
- **Deployed**: 2 days ago
- **Total Sessions**: 45,320
- **Unique Users**: 12,450
- **Adoption**: 78% of active users

### Health Metrics

**Current Release (v2.4.0):**
- Crash-Free Sessions: 97.2%
- Crash-Free Users: 98.1%
- New Issues: 5
- Total Events: 1,247

**Previous Release (v2.3.9):**
- Crash-Free Sessions: 99.1%
- Crash-Free Users: 99.4%
- New Issues: 1
- Total Events: 423

**Change:** 🔴 -1.9% crash-free sessions, -1.3% crash-free users

### New Issues Introduced in v2.4.0

1. **TypeError: Cannot access 'setState' before initialization**
   - Events: 478
   - Users: 234
   - Severity: High
   - Component: UserProfile

2. **NetworkError: Request timeout on /api/analytics**
   - Events: 356
   - Users: 178
   - Severity: Medium

3. **Warning: Each child should have unique 'key' prop**
   - Events: 289
   - Users: 145
   - Severity: Low

4. **Error: Failed to parse JSON response**
   - Events: 89
   - Users: 45
   - Severity: Medium

5. **Unhandled Promise Rejection in data loader**
   - Events: 35
   - Users: 12
   - Severity: Low

### Release Comparison

| Metric | v2.4.0 | v2.3.9 | v2.3.8 | Trend |
|--------|--------|--------|--------|-------|
| Crash-Free Sessions | 97.2% | 99.1% | 99.0% | 🔴 Down |
| Error Events | 1,247 | 423 | 456 | 🔴 Up |
| Performance (P95) | 2.1s | 1.8s | 1.9s | 🔴 Slower |

### Assessment

🔴 **Release Quality: Poor**

This release has significantly higher error rates compared to previous versions.
The TypeError affecting UserProfile is the primary contributor to degraded health.

### Recommendations

1. **Immediate**: Investigate TypeError in UserProfile component
2. **Consider**: Rollback to v2.3.9 if issue persists
3. **Monitor**: NetworkError timeout - may be infrastructure-related
4. **Track**: Performance regression (300ms slower P95)

Would you like me to:
- Investigate the UserProfile TypeError in detail?
- Compare performance metrics across releases?
- Check if any users are reporting issues?
```

## Arguments

- `project-name` (optional): Sentry project slug
- `release-version` (optional): Specific release to check (defaults to latest)

## Tips

- Monitor crash-free rates closely after deployments
- Compare new releases with previous stable versions
- Track new issues introduced per release
- Set up release health alerts
- Use release tags consistently in your deployment pipeline
- Roll back quickly if crash-free rate drops significantly

## Related Commands

- `/investigate-errors`: Dive deeper into release-specific errors
- `/analyze-performance`: Check performance changes across releases
- `/query-events`: Custom queries filtered by release
