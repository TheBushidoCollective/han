---
description: Update an existing SOP to reflect changes in tools, processes, or best practices
---

# Update Existing SOP

## Name

hashi-agent-sop:update-sop - Update an existing Standard Operating Procedure

## Synopsis

```
/update-sop
```

## Description

This command guides users through updating existing Standard Operating Procedures (SOPs) to reflect changes in tools, processes, or best practices. It handles version bumping, changelog management, migration guides, and ensures consistency across related SOPs.

## Implementation

You are helping the user update an existing Standard Operating Procedure (SOP) to keep it current and accurate.

## Your Task

Guide the user through updating an SOP by:

1. **Identify the SOP to update**:
   - Which SOP needs updating?
   - What triggered the need for update? (tool change, process change, incident, feedback)

2. **Read the current SOP**:
   - Review existing content
   - Note current version (if versioned)
   - Identify sections that need changes

3. **Determine update type**:
   - **Minor update**: Clarifications, typo fixes, small improvements (patch version)
   - **Feature update**: New steps, additional parameters, enhanced error handling (minor version)
   - **Breaking change**: Fundamental process change, tool migration (major version)

4. **Update version and changelog**:

```markdown
# {SOP Title}

**Version**: {new_version}
**Last Updated**: {YYYY-MM-DD}
**Changes**: {brief summary of changes}

## Changelog

### v{new_version} ({date})
- {change 1 with detail}
- {change 2 with detail}
- {change 3 with detail}

*Reason: {why these changes were made}*

### v{previous_version} ({previous_date})
- {previous changes}
```

1. **Make the updates**:
   - Update affected sections
   - Add new steps if needed
   - Update parameters
   - Revise success criteria
   - Add new error handling scenarios
   - Update examples to current syntax
   - Verify RFC 2119 keywords are still appropriate

1. **Ensure consistency**:
   - Related SOPs may need updates too
   - Update "Related SOPs" section if needed
   - Check if examples still work
   - Verify prerequisites are current

## Version Numbering (Semantic Versioning)

- **Major** (X.0.0): Breaking changes
  - Tool replacement (Docker → Kubernetes)
  - Fundamental process change
  - Incompatible parameter changes

- **Minor** (x.X.0): New features, non-breaking
  - New optional steps
  - Additional parameters
  - Enhanced error handling

- **Patch** (x.x.X): Bug fixes, clarifications
  - Typo corrections
  - Clarifying language
  - Updated examples

## Update Checklist

After making changes, verify:

- [ ] Version number incremented appropriately
- [ ] Changelog updated with changes and reason
- [ ] Last Updated date is current
- [ ] All tool versions are current
- [ ] Examples use current syntax
- [ ] Prerequisites are accurate
- [ ] Success criteria are measurable
- [ ] Error handling covers known issues
- [ ] Related SOPs are still valid
- [ ] RFC 2119 keywords are appropriate

## Common Update Scenarios

### Scenario 1: Tool Version Update

```markdown
## Changelog

### v1.2.0 (2025-12-05)
- Updated Node.js requirement from v16 to v18
- Updated npm commands to use new syntax
- Added troubleshooting for Node v18 breaking changes

*Reason: Node.js v16 reached end-of-life*

## Prerequisites

### Required Tools
- Node.js (v18 or higher) <!-- Changed from v16 -->
- npm (v9 or higher)     <!-- Changed from v8 -->
```

### Scenario 2: Adding Error Handling

```markdown
## Changelog

### v1.1.0 (2025-12-05)
- Added error handling for connection timeout scenarios
- Included retry logic in deployment steps

*Reason: Production incident #1234 - timeout during deployment*

## Error Handling

### Error: Connection Timeout During Deployment

**Symptoms**: Deployment hangs, connection to server times out

**Cause**: Network issues, server overload, or firewall blocking

**Resolution**:
1. Check network connectivity to deployment target
2. Verify server is responsive: `ping {server}`
3. Retry deployment with increased timeout: `--timeout 300`
4. If persistent, check firewall rules and server logs
```

### Scenario 3: Process Improvement

```markdown
## Changelog

### v2.0.0 (2025-12-05)
- Added canary deployment step (BREAKING)
- Restructured rollout process for gradual release
- Added monitoring validation between stages

*Reason: Reduce risk of production outages from bad deployments*

## Steps

1. Deploy to canary (10% of traffic)
   - Update canary deployment
   - Route 10% traffic to new version
   - **NEW**: Monitor error rates for 10 minutes
   - **Validation**: Error rate < 1%, latency within 10% of baseline

2. Deploy to production (remaining 90%)
   - If canary successful, proceed
   - If canary fails, rollback automatically
   [... rest of steps ...]
```

## Migration Guide Template

For breaking changes (major version), include migration guide:

```markdown
## Migration from v{old_major}.x

### Breaking Changes

1. **{Change Name}**
   - **Old Behavior**: {what it was before}
   - **New Behavior**: {what it is now}
   - **Action Required**: {what users must do}

2. **{Another Change}**
   - **Old Behavior**: {previous approach}
   - **New Behavior**: {new approach}
   - **Action Required**: {migration steps}

### Migration Steps

1. {Step to prepare for migration}
2. {Step to perform migration}
3. {Step to verify migration}

### Backward Compatibility

- {What remains compatible}
- {What breaks compatibility}
- {How long old version will be supported}
```

## After Updating

1. **Test the updated SOP**:
   - Walk through all steps
   - Verify examples work
   - Check error scenarios

2. **Communicate changes**:
   - Notify team of significant updates
   - Highlight breaking changes
   - Provide migration guidance if needed

3. **Update related documentation**:
   - SOP index
   - Related SOPs
   - Team wikis or documentation

4. **Commit changes**:

   ```bash
   git add {sop-file}.sop.md
   git commit -m "feat(sop): update {sop-name} to v{version} - {summary}"
   ```

## Example Interaction

User: "Update the deployment SOP to use the new CI/CD pipeline"

Response:

1. Read current deployment SOP
2. Ask about new pipeline details
3. Determine this is a major version (breaking change)
4. Update version from 1.5.0 to 2.0.0
5. Add changelog entry explaining CI/CD migration
6. Update deployment steps to use new pipeline
7. Add migration guide from old to new pipeline
8. Update prerequisites (new tools needed)
9. Test updated SOP
10. Save and commit changes
