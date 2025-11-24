---
name: create
description: Create a new ClickUp task interactively
---

Create a new ClickUp task through an interactive prompt.

**Usage**: `/create [optional: initial task name]`

**Interactive Prompts**:

1. **List** (required)
   - Use `clickup_get_workspace` and `clickup_get_list` to show available lists
   - Ask user to select list ID

2. **Task Name** (required)
   - If provided as argument, use it, otherwise ask

3. **Description** (optional)
   - Ask if user wants to provide detailed description
   - Support multi-line input with markdown

4. **Priority** (optional, default: Normal)
   - Urgent (1) / High (2) / Normal (3) / Low (4)

5. **Assignees** (optional)
   - Current user
   - Unassigned
   - Specific users

6. **Due Date** (optional)
   - Today / Tomorrow / This Week / Specific Date

7. **Tags** (optional)
   - Comma-separated list

8. **Checklist** (optional)
   - Ask if user wants to add checklist items
   - Support multiple items

**Confirmation**:
Show summary and ask for confirmation before creating:

```
📝 Create New Task

List: {list name}
Name: {task name}
Description: {description preview}
Priority: High
Assignees: You
Due Date: {date}
Tags: {tags}
Checklist: {number} items

Create this task? (y/n)
```

After creation, use `clickup_create_task` and optionally `clickup_create_checklist`, then display:
```
✅ Created #ABC123: {name}

Link: {task URL}

What would you like to do next?
- Start work (/start #ABC123)
- View details (/task #ABC123)
```
