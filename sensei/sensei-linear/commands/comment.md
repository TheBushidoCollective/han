---
name: comment
description: Add a comment to a Linear issue
---

Add a comment to a Linear issue.

**Usage**: `/comment ENG-123 [optional: comment text]`

If comment text is not provided, prompt for it with support for multi-line input.

Use `linear_add_comment` to add the comment.

**Display Format**:

```
💬 Adding comment to ENG-123

Comment:
{comment text}

Posted successfully!

View issue: {issue URL}
```

Support markdown formatting in comments:
- Bold: **text**
- Italic: *text*
- Code: `code`
- Code blocks: ```language
- Lists
- Links

Provide formatting tips if user is writing a longer comment.
