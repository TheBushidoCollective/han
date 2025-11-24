---
name: validate
description: Validate acceptance criteria for a Jira ticket without changing status
---

Validate that all acceptance criteria are met for a Jira ticket without transitioning status.

**Usage**: `/validate PROJ-123`

Use `atlassian_get_issue` to fetch ticket details and extract acceptance criteria.

**Display Format**:

```
🔍 Validating PROJ-123: {summary}

Current Status: {status}
Assignee: {assignee}

📋 Acceptance Criteria:

1. ✓ {criterion 1}
   Evidence: {ask user or check recent comments/code changes}

2. ✓ {criterion 2}
   Evidence: {ask user or check recent comments/code changes}

3. ✗ {criterion 3}
   Status: Not complete

4. ✓ {criterion 4}
   Evidence: {ask user or check recent comments/code changes}

Summary: 3/4 criteria met (75%)

Remaining work:
- {criterion 3}: {suggest what needs to be done}

Ready to complete? No - complete remaining criteria first.
```

Provide actionable feedback on what still needs to be done.
