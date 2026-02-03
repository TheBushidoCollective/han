---
name: start
description: Start work on a Linear issue (transition to In Progress)
---

# start

## Name

hashi-linear:start - Start work on a Linear issue (transition to In Progress)

## Synopsis

```
/start [arguments]
```

## Description

Start work on a Linear issue (transition to In Progress)

## Implementation

Start work on a Linear issue by transitioning it to "In Progress" and displaying acceptance criteria.

**Usage**: `/start ENG-123`

**Steps**:

1. Use `linear_get_issue` to fetch issue details
2. Display issue title and current state
3. Extract and highlight acceptance criteria
4. Use `linear_update_issue_state` to transition to "In Progress"
5. Use `linear_add_comment` to add: "Starting work on this issue"
6. Optionally use `linear_update_issue` to assign to current user if unassigned

**Display Format**:

```
▶️  Starting work on ENG-123

Title: {issue title}
Status: {old status} → In Progress
Assignee: {assignee}

📋 Acceptance Criteria:
{list all acceptance criteria}

Link: {issue URL}
```

If issue is already In Progress, just display current status and acceptance criteria without transitioning.
