---
name: search
description: Search for Linear issues
---

Search for Linear issues using filters or text search.

**Usage**:

- `/search authentication` (text search in title and description)
- `/search team:ENG status:in-progress` (with filters)

Use the Linear MCP tool `linear_search_issues`.

**Supported filters**:

- `team:KEY` - Filter by team (e.g., team:ENG)
- `status:NAME` - Filter by status (e.g., status:in-progress)
- `priority:LEVEL` - Filter by priority (urgent/high/medium/low)
- `assignee:me` - Filter by assignee
- `label:NAME` - Filter by label

If no filters provided, search across title and description.

Display results in table format:

| ID | Title | Status | Assignee | Priority | Updated |
|----|-------|--------|----------|----------|---------|

Limit to 20 results. If more exist, show: "Showing 20 of X results. Use filters to narrow down results."

Provide filter examples if search returns no results.
