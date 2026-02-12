---
name: start
description: Start work on a Jira ticket (transition to In Progress)
---

# start

## Name

jira:start - Start work on a Jira ticket (transition to In Progress)

## Synopsis

```
/start [arguments]
```

## Description

Start work on a Jira ticket (transition to In Progress)

## Implementation

Start work on a Jira ticket by transitioning it to "In Progress" and displaying acceptance criteria.

**Usage**: `/start PROJ-123`

**Steps**:

1. Use `atlassian_get_issue` to fetch ticket details
2. Display ticket summary and current status
3. Extract and highlight acceptance criteria
4. Use `atlassian_transition_issue` to transition to "In Progress"
5. Use `atlassian_add_comment` to add: "Starting work on this ticket"
6. Optionally use `atlassian_update_issue` to assign to current user if unassigned

**Display Format**:

```
▶️  Starting work on PROJ-123

Summary: {ticket summary}
Status: {old status} → In Progress
Assignee: {assignee}

📋 Acceptance Criteria:
{list all acceptance criteria as checklist}

Link: {ticket URL}
```

If ticket is already In Progress, just display current status and acceptance criteria without transitioning.
