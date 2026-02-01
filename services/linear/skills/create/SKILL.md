---
name: create
description: Create a new Linear issue interactively
---

# create

## Name

hashi-linear:create - Create a new Linear issue interactively

## Synopsis

```
/create [arguments]
```

## Description

Create a new Linear issue interactively

## Implementation

Create a new Linear issue through an interactive prompt.

**Usage**: `/create [optional: initial title]`

**Interactive Prompts**:

1. **Team** (if not obvious from context)
   - Use `linear_get_team` to list available teams
   - Ask user to select or provide team key

2. **Title** (required)
   - If provided as argument, use it, otherwise ask

3. **Description** (optional)
   - Ask if user wants to provide detailed description
   - Support multi-line input with markdown

4. **Priority** (optional, default: Medium)
   - Urgent (1) / High (2) / Medium (3) / Low (4)

5. **Assignee** (optional)
   - Current user
   - Unassigned
   - Specific user

6. **Project** (optional)
   - Use `linear_list_projects` to show available projects

7. **Labels** (optional)
   - Comma-separated list

**Confirmation**:
Show summary and ask for confirmation before creating:

```
📝 Create New Issue

Team: Engineering
Title: {title}
Description: {description preview}
Priority: High
Assignee: You
Project: {project}
Labels: {labels}

Create this issue? (y/n)
```

After creation, use `linear_create_issue` and display:

```
✅ Created ENG-123: {title}

Link: {issue URL}

What would you like to do next?
- Start work (/start ENG-123)
- View details (/issue ENG-123)
```
