---
name: query-events
description: Run custom queries on Sentry events and issues with advanced filtering
---

# Query Sentry Events

## Name

hashi-sentry:query-events - Run custom queries on Sentry events and issues with advanced filtering

## Synopsis

```
/query-events [arguments]
```

## Description

Run custom queries on Sentry events and issues using advanced filtering to find specific errors, analyze patterns, or extract insights.

## Implementation

This command provides flexible querying capabilities for Sentry data with support for filters on environment, release, user, tags, and more.

## Usage

```
/query-events [project-name] [query-expression]
```

## What This Command Does

1. Asks for the Sentry project name
2. Accepts a custom query expression or builds one interactively
3. Applies filters for:
   - Environment (production, staging, etc.)
   - Release version
   - User properties
   - Tags and custom attributes
   - Time range
   - Event type (error, transaction, etc.)
   - Issue status (resolved, unresolved)
4. Executes the query using Sentry MCP tools
5. Presents results with relevant context
6. Suggests follow-up investigations

## Prerequisites

- Sentry MCP server must be installed and configured
- OAuth authentication with Sentry must be completed
- Access to the target Sentry project

## Example Interaction

```
User: /query-events api-service Find all errors in production for user emails ending in @enterprise.com in the last 7 days

Claude: Running custom query on api-service...

## Query Results

**Query:** Errors in production environment for enterprise users (last 7 days)

**Filters Applied:**
- Environment: production
- User email: *@enterprise.com
- Event type: error
- Time range: Last 7 days
- Status: unresolved

### Results: 23 matching issues, 456 total events

### Top Issues for Enterprise Users

1. **API Rate Limit Exceeded**
   - Events: 189
   - Users: 12
   - Pattern: Heavy API usage from automated systems
   - Tags: tier=enterprise, api_version=v2

2. **Database Connection Timeout**
   - Events: 134
   - Users: 8
   - Pattern: Concurrent query limit reached
   - Tags: tier=enterprise, db_pool=primary

3. **Insufficient Storage Quota**
   - Events: 78
   - Users: 5
   - Pattern: Enterprise plans hitting 10GB limit
   - Tags: tier=enterprise, feature=uploads

4. **Permission Denied: Admin Action**
   - Events: 34
   - Users: 4
   - Pattern: Users attempting cross-org actions
   - Tags: tier=enterprise, action=admin

5. **GraphQL Query Complexity Exceeded**
   - Events: 21
   - Users: 3
   - Pattern: Complex nested queries
   - Tags: tier=enterprise, api=graphql

### Insights

- Enterprise users hitting different limits than standard users
- Rate limiting and connection pooling need enterprise-tier scaling
- Storage quotas may need adjustment for enterprise plans

### Affected Users

- user@bigcorp.com (89 events)
- admin@megacorp.com (67 events)
- api@enterprise-client.com (145 events)
- integration@partner-enterprise.com (98 events)

### Recommendations

1. **Immediate**: Increase rate limits for enterprise tier
2. **High**: Scale database connection pool for enterprise workloads
3. **Medium**: Review storage quotas and upgrade paths
4. **Low**: Document GraphQL query complexity limits

Would you like me to investigate any specific issue or user in detail?
```

## Query Syntax Examples

```
# Find errors in specific environment
environment:production is:unresolved

# Find issues affecting a specific user
user.email:user@example.com

# Find events from a specific release
release:v2.3.0

# Find slow transactions
event.type:transaction transaction.duration:>2000

# Combine multiple filters
environment:production release:v2.* user.id:12345 level:error

# Find issues with specific tags
tag.payment_method:stripe tag.status:failed
```

## Arguments

- `project-name` (optional): Sentry project slug
- `query-expression` (optional): Sentry query syntax or natural language description

## Tips

- Use Sentry's query syntax for precise filtering
- Combine multiple filters for targeted investigations
- Save common queries for reuse
- Use wildcard patterns for flexible matching
- Filter by custom tags for domain-specific analysis
- Narrow time ranges for faster queries

## Related Commands

- `/investigate-errors`: Pre-built error investigation workflow
- `/analyze-performance`: Performance-specific queries
- `/check-releases`: Release-filtered queries
