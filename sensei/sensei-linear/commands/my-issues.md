---
name: my-issues
description: Show all Linear issues assigned to you
---

# my-issues

## Name

sensei-linear:my-issues - Show all Linear issues assigned to you

## Synopsis

```
/my-issues [arguments]
```

## Description

Show all Linear issues assigned to you

## Implementation

Retrieve and display all Linear issues currently assigned to you.

Use the Linear MCP tool `linear_search_issues` with assignee filter set to current user.

Group results by status and display in a clear table format:

| ID | Title | Status | Priority | Updated |
|----|-------|--------|----------|---------|

Include:

- Issue identifier (e.g., ENG-123)
- Title (truncate if too long)
- Current state
- Priority (Urgent/High/Medium/Low/None)
- Last updated date

Show count of issues by status at the end:

```
Summary:
- In Progress: 3
- To Do: 2
- Backlog: 1
Total: 6 issues
```
