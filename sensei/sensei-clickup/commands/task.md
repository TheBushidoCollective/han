---
name: task
description: Get detailed information about a specific ClickUp task
---

Retrieve and display comprehensive details for a ClickUp task.

**Usage**: `/task #ABC123` or `/task ABC123`

Use the ClickUp MCP tool `clickup_get_task` to fetch full task details.

Display in sections:

## 📋 Task: #ABC123

**Name**: {task name}
**Status**: {status}
**Assignees**: {assignees}
**Priority**: {priority}
**Due Date**: {due date}
**Created**: {created date}
**Updated**: {updated date}
**List**: {list name}
**Folder**: {folder name}
**Space**: {space name}

## Description

{full description with formatting}

## Checklist Items

{show all checklist items with completion status}

- [x] Completed item
- [ ] Incomplete item

## Custom Fields

{show any relevant custom fields}

## Recent Comments

{Show last 3 comments with author and date}

## Time Tracked

{show time entries if any}

Provide the direct link to the task at the end.
