---
name: ai-dlc-intent-detection
description: Use PROACTIVELY when a user describes work that sounds like a feature, project, or task. Detects intent patterns and offers to start AI-DLC elaboration.
allowed-tools:
  - Read
  - Glob
  - AskUserQuestion
---

# Proactive Intent Detection

When interacting with users, actively listen for patterns that suggest they're describing work that would benefit from structured AI-DLC elaboration.

## Intent Signal Patterns

Watch for user messages that contain:

### Feature Descriptions
- "I want to add..."
- "We need to implement..."
- "Can you build..."
- "I'm thinking about adding..."
- "We should have..."

### Problem Statements
- "Users are experiencing..."
- "There's an issue where..."
- "We need to fix..."
- "The problem is..."

### Project Scope
- "I want to create a..."
- "We're building..."
- "The goal is to..."
- "We need a system that..."

### Enhancement Requests
- "It would be nice if..."
- "Can we improve..."
- "I'd like to change..."
- "We should update..."

### Multi-step Work
- Work involving multiple files or components
- Changes that affect multiple parts of the system
- Features that need both frontend and backend work
- Anything that sounds like it needs planning

## When to Offer Elaboration

If you detect 2+ of these signals in a user's message:

1. **Acknowledge their intent** - Show you understand what they want
2. **Offer structure** - Ask if they'd like to use AI-DLC elaboration

Use `AskUserQuestion`:

```json
{
  "questions": [{
    "question": "This sounds like a substantial piece of work. Would you like to use AI-DLC to structure this?",
    "header": "Approach",
    "options": [
      {"label": "Yes, elaborate", "description": "Define intent, success criteria, and units collaboratively"},
      {"label": "Quick implementation", "description": "Just start building without formal structure"},
      {"label": "Tell me more", "description": "Explain what AI-DLC elaboration involves"}
    ],
    "multiSelect": false
  }]
}
```

## Response Handling

Based on their choice:

- **Yes, elaborate**: Invoke the `/elaborate` skill
- **Quick implementation**: Proceed with normal implementation
- **Tell me more**: Briefly explain AI-DLC benefits:
  - Structured success criteria
  - Decomposition into independent units
  - Autonomous construction with quality gates
  - Resumable work across sessions

## When NOT to Offer

Skip the offer when:

- User explicitly says "quick" or "just do it"
- The request is clearly trivial (single line change, typo fix)
- User is already in an AI-DLC workflow
- User has previously declined for similar work

## Detection Sensitivity

Err on the side of offering for:
- Any multi-file change
- Work spanning multiple components
- Features with unclear scope
- Bug investigations
- Performance improvements
- Refactoring efforts

The goal is to catch work that would benefit from structure BEFORE diving in, not to annoy with prompts for trivial tasks.

## Integration

This detection should happen naturally during conversation. Don't be mechanical about it - weave the offer into your acknowledgment of their request:

**Good:**
> "Adding user authentication with OAuth sounds like a multi-component feature. Would you like to elaborate this into a structured intent with clear success criteria, or should I dive straight into implementation?"

**Bad:**
> "I detected intent signals in your message. According to my AI-DLC intent detection protocol, I should ask: do you want to elaborate?"

Be natural. Be helpful. Offer structure when it adds value.
