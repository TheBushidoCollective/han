---
name: issue
description: Get detailed information about a specific Linear issue
---

Retrieve and display comprehensive details for a Linear issue.

**Usage**: `/issue ENG-123`

Use the Linear MCP tool `linear_get_issue` to fetch full issue details.

Display in sections:

## 📋 Issue: ENG-123

**Title**: {title}
**Status**: {state name}
**Assignee**: {assignee}
**Priority**: {priority}
**Created**: {created date}
**Updated**: {updated date}
**Cycle**: {cycle/sprint if in one}
**Project**: {project if assigned}

## Description

{full description with formatting}

## Acceptance Criteria

{Extract and highlight any acceptance criteria or requirements}
{Parse checklist items if present}

## Recent Activity

{Show last 3 comments with author and date}

## Related Issues

{Show linked issues with relationship}

Provide the direct link to the issue at the end.
