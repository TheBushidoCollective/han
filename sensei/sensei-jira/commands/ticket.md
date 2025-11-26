---
name: ticket
description: Get detailed information about a specific Jira ticket
---

# ticket

## Name

sensei-jira:ticket - Get detailed information about a specific Jira ticket

## Synopsis

```
/ticket [arguments]
```

## Description

Get detailed information about a specific Jira ticket

## Implementation

Retrieve and display comprehensive details for a Jira ticket.

**Usage**: `/ticket PROJ-123`

Use the Atlassian MCP tool `atlassian_get_issue` to fetch full ticket details.

Display in sections:

## 📋 Ticket: PROJ-123

**Summary**: {title}
**Status**: {status}
**Assignee**: {assignee}
**Reporter**: {reporter}
**Priority**: {priority}
**Created**: {created date}
**Updated**: {updated date}

## Description

{full description with formatting}

## Acceptance Criteria

{Extract and highlight any acceptance criteria sections}
{Parse checklist items if present}

## Recent Comments

{Show last 3 comments with author and date}

## Linked Issues

{Show related tickets with relationship type}

Provide the direct link to the ticket at the end.
