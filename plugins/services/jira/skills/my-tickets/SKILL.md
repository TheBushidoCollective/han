---
name: my-tickets
description: Show all Jira tickets assigned to you
---

# my-tickets

## Name

hashi-jira:my-tickets - Show all Jira tickets assigned to you

## Synopsis

```
/my-tickets [arguments]
```

## Description

Show all Jira tickets assigned to you

## Implementation

Retrieve and display all Jira tickets currently assigned to you.

Use the Atlassian MCP tool `atlassian_search_issues` with JQL:

```
assignee = currentUser() AND status != Done
```

Group the results by status and display in a clear table format:

| Key | Summary | Status | Priority | Updated |
|-----|---------|--------|----------|---------|

Include:

- Ticket key (e.g., PROJ-123)
- Summary (truncate if too long)
- Current status
- Priority
- Last updated date

Show count of tickets by status at the end.
