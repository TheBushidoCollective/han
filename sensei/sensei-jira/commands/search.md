---
name: search
description: Search for Jira tickets using JQL or text
---

Search for Jira tickets using either JQL (Jira Query Language) or simple text search.

**Usage**:

- `/search authentication bug` (simple text search)
- `/search project = PROJ AND status = "In Progress"` (JQL query)

Use the Atlassian MCP tool `atlassian_search_issues`.

**Logic**:

1. If the query contains JQL operators (=, AND, OR, IN, etc.), use it as JQL directly
2. Otherwise, construct a JQL query that searches across:
   - summary ~ "query"
   - description ~ "query"
   - comment ~ "query"

Display results in table format:

| Key | Summary | Status | Assignee | Priority | Updated |
|-----|---------|--------|----------|----------|---------|

Limit to 20 results. If more exist, show: "Showing 20 of X results. Refine your search for more specific results."

Provide helpful JQL tips if search returns no results.
