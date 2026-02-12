---
name: create-sop
description: Create a new Standard Operating Procedure (SOP) file with proper structure
---

# Create New SOP

## Name

agent-sop:create-sop - Create a new Standard Operating Procedure file

## Synopsis

```
/create-sop
```

## Description

This command guides users through creating well-structured Standard Operating Procedures (SOPs) for AI agents. It provides step-by-step assistance in determining SOP purpose, structuring content, applying RFC 2119 keywords, and saving files with proper naming conventions.

## Implementation

You are helping the user create a new Standard Operating Procedure (SOP) file.

## Your Task

Guide the user through creating a well-structured SOP file by:

1. **Ask about the SOP purpose** (if not provided):
   - What workflow or task does this SOP address?
   - When should this SOP be used?
   - What is the expected outcome?

2. **Determine SOP type**:
   - Analysis/Review SOP (analyzing code, reviewing PRs, auditing)
   - Implementation SOP (building features, writing code, making changes)
   - Deployment SOP (deploying changes, rolling back, configuring)
   - Maintenance SOP (updating dependencies, cleaning up, refactoring)

3. **Create the SOP file** following this structure:

```markdown
# {Action Verb} {Specific Outcome}

## Overview

{1-2 sentences describing what this SOP accomplishes and when to use it}

## Parameters

- **Parameter Name**: {parameter_name} - Description and example values
- **Configuration**: {config_option} - Available options

## Prerequisites

### Required Tools
- Tool name (version X.X or higher)

### Required Knowledge
- Understanding of relevant concepts

### Required Setup
- Required environment configuration

## Steps

1. First major step
   - Sub-step with details
   - Another sub-step
   - **Validation**: How to verify this step succeeded

2. Second major step
   - Implementation detail
   - Expected outcome
   - **Validation**: Verification method

3. Third major step
   - Specific actions
   - Success indicators

## Success Criteria

- [ ] Measurable outcome 1
- [ ] Measurable outcome 2
- [ ] Measurable outcome 3
- [ ] All tests pass
- [ ] Documentation updated

## Error Handling

### Error: {Common Error Name}

**Symptoms**: How this error manifests

**Cause**: Why this error occurs

**Resolution**:
1. First troubleshooting step
2. Second troubleshooting step
3. Alternative approach

## Related SOPs

- **{related-sop}**: When to use this instead
- **{complementary-sop}**: What to do next
```

1. **Use RFC 2119 keywords** appropriately:
   - **MUST**: Absolute requirements (security, data integrity, prerequisites)
   - **SHOULD**: Strong recommendations (best practices, optimizations)
   - **MAY**: Optional actions (enhancements, preferences)
   - **MUST NOT**: Absolute prohibitions (security violations, data risks)
   - **SHOULD NOT**: Strong discouragement (anti-patterns)

1. **File naming**:
   - Use kebab-case
   - Use `.sop.md` extension
   - Examples: `deploy-production.sop.md`, `code-review-security.sop.md`

1. **Save location**:
   - Ask where to save (or use `~/sops/` as default)
   - Suggest organizing by category: `~/sops/deployment/`, `~/sops/development/`

## Best Practices to Follow

- Use active voice and imperative mood
- Start steps with action verbs
- Include validation steps after major actions
- Provide specific, measurable success criteria
- Include common error scenarios
- Add examples where helpful
- Keep parameters at the top for easy reference

## After Creating the SOP

1. Test the SOP by walking through it
2. Add to SOP index if one exists
3. If using with Agent SOP MCP server, ensure file has `.sop.md` extension
4. Consider versioning (add version and changelog if this will evolve)

## Example Interaction

User: "Help me create an SOP for deploying to production"

Response:

1. Ask clarifying questions about deployment process
2. Identify required tools (kubectl, docker, etc.)
3. Map out deployment steps
4. Create structured SOP file with proper RFC 2119 keywords
5. Save to appropriate location
6. Suggest testing the SOP with a dry-run deployment
