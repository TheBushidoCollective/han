---
name: my-tasks
description: Show all ClickUp tasks assigned to you
---

# my-tasks

## Name

clickup:my-tasks - Show all ClickUp tasks assigned to you

## Synopsis

```
/my-tasks [arguments]
```

## Description

Show all ClickUp tasks assigned to you

## Implementation

Retrieve and display all ClickUp tasks currently assigned to you.

Use the ClickUp MCP tool `clickup_search_tasks` with assignee filter set to current user.

Group results by status and display in a clear table format:

| ID | Name | Status | Priority | Due Date | Updated |
|----|------|--------|----------|----------|---------|

Include:

- Task ID (e.g., #ABC123 or custom ID)
- Task name (truncate if too long)
- Current status
- Priority (Urgent/High/Normal/Low)
- Due date (if set)
- Last updated date

Show count of tasks by status at the end:

```
Summary:
- In Progress: 4
- To Do: 3
- Backlog: 2
Total: 9 tasks
```
