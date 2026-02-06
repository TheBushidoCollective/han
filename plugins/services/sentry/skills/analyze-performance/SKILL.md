---
name: analyze-performance
description: Analyze performance metrics and identify slow transactions in Sentry
---

# Analyze Performance Issues

## Name

hashi-sentry:analyze-performance - Analyze performance metrics and identify slow transactions in Sentry

## Synopsis

```
/analyze-performance [arguments]
```

## Description

Analyze performance monitoring data in Sentry to identify slow transactions, bottlenecks, and performance regressions.

## Implementation

This command helps you investigate performance issues and optimize application speed using Sentry's performance monitoring data.

## Usage

```
/analyze-performance [project-name] [timeframe]
```

## What This Command Does

1. Asks for the Sentry project name
2. Requests timeframe for analysis
3. Fetches performance metrics using Sentry MCP tools
4. Analyzes transaction performance data
5. Provides insights on:
   - Slowest transactions and endpoints
   - Performance trends over time
   - Transaction throughput (requests/min)
   - Apdex scores
   - P50, P95, P99 latency percentiles
   - Database query performance
   - External API call latency
6. Identifies performance regressions and anomalies
7. Suggests optimization opportunities

## Prerequisites

- Sentry MCP server must be installed and configured
- OAuth authentication with Sentry must be completed
- Performance monitoring enabled for the project
- Access to the target Sentry project

## Example Interaction

```
User: /analyze-performance backend-api 7d

Claude: Analyzing performance metrics for backend-api over the last 7 days...

## Performance Analysis Report

### Overview
- **Total Transactions**: 2.4M
- **Avg Throughput**: 4,000 req/min
- **Apdex Score**: 0.78 (Fair)
- **Time Range**: Last 7 days

### Slowest Transactions (P95 Latency)

1. **POST /api/users/search**
   - P50: 450ms
   - P95: 3,200ms
   - P99: 8,500ms
   - Throughput: 120 req/min
   - Issue: Database query scanning full table

2. **GET /api/reports/generate**
   - P50: 890ms
   - P95: 2,800ms
   - P99: 5,400ms
   - Throughput: 45 req/min
   - Issue: Large data aggregation without caching

3. **POST /api/images/upload**
   - P50: 320ms
   - P95: 2,100ms
   - P99: 4,200ms
   - Throughput: 200 req/min
   - Issue: S3 upload latency varies by region

### Performance Trends

- Overall latency increased 15% since v3.1.0 deployment (5 days ago)
- User search endpoint degraded 40% in last 3 days
- Database query time increased from 120ms to 180ms average

### Span Analysis

**Slowest Database Queries:**
1. SELECT * FROM users WHERE email LIKE '%@%' - 1,200ms avg
2. SELECT * FROM events JOIN users - 850ms avg
3. UPDATE sessions SET last_seen - 450ms avg

**Slowest External Calls:**
1. POST https://api.payment-processor.com/charge - 650ms avg
2. GET https://cdn.example.com/assets - 280ms avg

### Recommendations

1. **Critical**: Add database index on users.email for search queries
2. **High**: Implement Redis caching for report generation
3. **Medium**: Consider CDN with multi-region support for uploads
4. **Low**: Review payment processor latency (external dependency)

### Next Steps

Would you like me to:
- Investigate the v3.1.0 regression in detail?
- Analyze specific slow database queries?
- Review span performance for a specific transaction?
```

## Arguments

- `project-name` (optional): Sentry project slug
- `timeframe` (optional): Time range (1h, 24h, 7d, 30d)

## Tips

- Focus on P95/P99 latency for user experience impact
- Look for performance changes after deployments
- Monitor Apdex score for overall user satisfaction
- Investigate span-level details for bottlenecks
- Compare performance across releases and environments
- Set up performance alerts for regressions

## Related Commands

- `/investigate-errors`: Check for errors related to slow endpoints
- `/check-releases`: Compare performance across releases
- `/query-events`: Run custom performance queries
