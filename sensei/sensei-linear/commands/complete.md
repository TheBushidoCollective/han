---
name: complete
description: Mark a Linear issue as complete after validating acceptance criteria
---

# complete

## Name

sensei-linear:complete - Mark a Linear issue as complete after validating acceptance criteria

## Synopsis

```
/complete [arguments]
```

## Description

Mark a Linear issue as complete after validating acceptance criteria

## Implementation

Complete a Linear issue by validating acceptance criteria and transitioning to Done.

**Usage**: `/complete ENG-123`

**Steps**:

1. Use `linear_get_issue` to fetch issue details including description and comments
2. Extract acceptance criteria from description
3. Display each criterion and ask user to confirm completion
4. If all confirmed:
   - Use `linear_add_comment` to add completion summary
   - Use `linear_update_issue_state` to transition to "Done"
5. If any not confirmed:
   - List incomplete criteria
   - Keep issue in current status
   - Suggest next steps

**Display Format**:

```
✅ Completing ENG-123: {title}

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
