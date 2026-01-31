---
name: create
description: Create a new Jira ticket interactively
---

# create

## Name

hashi-jira:create - Create a new Jira ticket interactively

## Synopsis

```
/create [arguments]
```

## Description

Create a new Jira ticket interactively

## Implementation

Create a new Jira ticket through an interactive prompt.

**Usage**: `/create [optional: initial summary]`

**Interactive Prompts**:

1. **Project** (if not obvious from context)
   - Use `atlassian_search_issues` to list available projects
   - Ask user to select or provide project key

2. **Issue Type**
   - Story
   - Bug
   - Task
   - Epic
   - (show available types for selected project)

3. **Summary** (required)
   - If provided as argument, use it, otherwise ask

4. **Description** (optional)
   - Ask if user wants to provide detailed description
   - Support multi-line input

5. **Priority** (optional, default: Medium)
   - Blocker / Critical / High / Medium / Low

6. **Assignee** (optional)
   - Current user
   - Unassigned
   - Specific user (provide email)

7. **Labels** (optional)
   - Comma-separated list

**Confirmation**:
Show summary and ask for confirmation before creating:

```
📝 Create New Ticket

Project: PROJ
Type: Story
Summary: {summary}
Description: {description preview}
Priority: High
Assignee: You
Labels: {labels}

Create this ticket? (y/n)
```

After creation, use `atlassian_create_issue` and display:

```
✅ Created PROJ-123: {summary}

Link: {ticket URL}

What would you like to do next?
- Start work (/start PROJ-123)
- View details (/ticket PROJ-123)
```
