---
name: complete
description: Mark a Jira ticket as complete after validating acceptance criteria
---

Complete a Jira ticket by validating acceptance criteria and transitioning to Done.

**Usage**: `/complete PROJ-123`

**Steps**:

1. Use `atlassian_get_issue` to fetch ticket details including description and comments
2. Extract acceptance criteria from description
3. Display each criterion and ask user to confirm completion
4. If all confirmed:
   - Use `atlassian_add_comment` to add completion summary
   - Use `atlassian_transition_issue` to transition to "Done"
5. If any not confirmed:
   - List incomplete criteria
   - Keep ticket in current status
   - Suggest next steps

**Display Format**:

```
✅ Completing PROJ-123: {summary}

📋 Acceptance Criteria Validation:

1. ✓ {criterion 1} - COMPLETE
2. ✓ {criterion 2} - COMPLETE
3. ✗ {criterion 3} - INCOMPLETE
4. ✓ {criterion 4} - COMPLETE

❌ Cannot complete: 1 criterion not met
- {criterion 3}

Suggestion: Complete remaining criteria before marking as Done.
```

Only transition to Done if ALL criteria are validated.
