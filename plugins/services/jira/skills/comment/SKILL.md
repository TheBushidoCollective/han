---
name: comment
description: Add a comment to a Jira ticket
---

# comment

## Name

jira:comment - Add a comment to a Jira ticket

## Synopsis

```
/comment [arguments]
```

## Description

Add a comment to a Jira ticket

## Implementation

Add a comment to a Jira ticket.

**Usage**: `/comment PROJ-123 [optional: comment text]`

If comment text is not provided, prompt for it with support for multi-line input.

Use `atlassian_add_comment` to add the comment.

**Display Format**:

```
💬 Adding comment to PROJ-123

Comment:
{comment text}

Posted successfully!

View ticket: {ticket URL}
```

Support markdown formatting in comments:

- Bold: **text**
- Italic: *text*
- Code: `code`
- Lists
- Links

Provide formatting tips if user is writing a longer comment.
