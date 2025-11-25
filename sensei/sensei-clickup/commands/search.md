---
name: search
description: Search for ClickUp tasks
---

Search for ClickUp tasks using filters or text search.

**Usage**:

- `/search authentication` (text search in task names)
- `/search list:123456 status:in-progress` (with filters)

Use the ClickUp MCP tool `clickup_search_tasks`.

**Supported filters**:

- `list:ID` - Filter by list ID
- `folder:ID` - Filter by folder ID
- `space:ID` - Filter by space ID
- `status:NAME` - Filter by status
- `priority:LEVEL` - Filter by priority (1-4)
- `assignee:me` - Filter by assignee
- `tag:NAME` - Filter by tag
- `due:today` - Filter by due date (today/tomorrow/week)

If no filters provided, search across task names in accessible lists.

Display results in table format:

| ID | Name | Status | Assignees | Priority | Due Date | List |
|----|------|--------|-----------|----------|----------|------|

Limit to 20 results. If more exist, show: "Showing 20 of X results. Use filters to narrow down results."

Provide filter examples if search returns no results.
