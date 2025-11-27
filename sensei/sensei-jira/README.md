# Sensei: Jira

MCP server for Atlassian Jira integration with automatic acceptance criteria validation. Connects Claude Code directly to your Jira instance for seamless ticket management and quality enforcement.

## What This Sensei Provides

### MCP Server: Atlassian

This sensei connects Claude Code to Atlassian Jira and provides complete ticket lifecycle management with built-in validation to ensure work meets acceptance criteria before marking tickets complete.

**Key Capabilities:**

- **Ticket Management**: Create, read, update, and transition Jira issues
- **JQL Search**: Powerful querying with Jira Query Language
- **Acceptance Criteria Validation**: Automatic validation on Stop hook
- **Sprint Management**: View and manage sprint tickets
- **Issue Linking**: Link related issues and manage dependencies
- **Comments & Updates**: Add comments and update ticket fields
- **Workflow Transitions**: Move tickets through your workflow states

### Automatic Validation

When you stop a Claude Code session, this sensei automatically:

1. **Scans the conversation** for any Jira ticket keys (e.g., PROJ-123)
2. **Reminds you to validate** that work meets acceptance criteria
3. **Prompts Claude** to fetch ticket details and verify completeness
4. **Prevents incomplete work** from being marked as done

This ensures you never forget to validate your work against ticket requirements.

### Available MCP Tools

Once installed, Claude Code gains access to these Atlassian MCP tools:

- **`atlassian_get_issue`**: Get full details of a specific Jira issue
- **`atlassian_search_issues`**: Search for issues using JQL
- **`atlassian_create_issue`**: Create new Jira issues
- **`atlassian_update_issue`**: Update issue fields
- **`atlassian_transition_issue`**: Move issues through workflow states
- **`atlassian_add_comment`**: Add comments to issues
- **`atlassian_link_issues`**: Create relationships between issues
- **`atlassian_get_projects`**: List available projects
- **`atlassian_get_transitions`**: Get available workflow transitions for an issue

## Installation

For `han` CLI installation instructions, visit [han.guru](https://han.guru).

```bash
han install sensei-jira
```

## Usage

### Example 1: Start Working on a Ticket

```
User: I need to work on PROJ-123

Claude: Let me get the details of that ticket.
[Uses atlassian_get_issue to fetch ticket]

Here's PROJ-123:
Summary: Add user authentication
Status: To Do
Assignee: Unassigned

Acceptance Criteria:
- [ ] User can log in with email/password
- [ ] Invalid credentials show error
- [ ] Session persists for 7 days
- [ ] Logout clears session

Would you like me to transition this to "In Progress" and start working on it?
```

### Example 2: Search for Your Tickets

```
User: Show me all my open tickets

Claude: [Uses atlassian_search_issues with JQL: "assignee = currentUser() AND status != Done"]

You have 5 open tickets:

| Key      | Summary              | Status      | Priority |
|----------|---------------------|-------------|----------|
| PROJ-123 | Add authentication  | In Progress | High     |
| PROJ-124 | Fix login redirect  | To Do       | Medium   |
| PROJ-125 | Update user profile | In Progress | Low      |
| PROJ-126 | Add password reset  | To Do       | High     |
| PROJ-127 | Implement 2FA       | To Do       | Medium   |

Which one would you like to work on?
```

### Example 3: Validate Acceptance Criteria

```
User: I've finished the authentication work for PROJ-123

Claude: Let me validate the acceptance criteria.
[Uses atlassian_get_issue to fetch current state]

Checking PROJ-123 acceptance criteria:

✅ User can log in with email/password - IMPLEMENTED
✅ Invalid credentials show error - IMPLEMENTED
✅ Session persists for 7 days - IMPLEMENTED
✅ Logout clears session - IMPLEMENTED

All acceptance criteria are met! Would you like me to:
1. Add a comment documenting completion
2. Transition to "Done"
3. Create a pull request
```

### Example 4: Create a New Ticket

```
User: Create a bug ticket for the login page not redirecting properly

Claude: I'll create a bug ticket for you.
[Uses atlassian_create_issue]

Created PROJ-128: Login page not redirecting properly
Priority: High
Assignee: You
Status: To Do

Link: https://your-company.atlassian.net/browse/PROJ-128

Would you like to start working on this now?
```

### Example 5: Stop Hook Validation

When you stop Claude Code after working on tickets:

```
[Stop Hook Executes]

Found Jira tickets: PROJ-123, PROJ-124

⚠️  VALIDATION REQUIRED
Before stopping, please validate:
  - Fetch PROJ-123 details and review acceptance criteria
  - Confirm all criteria are met
  - Fetch PROJ-124 details and review acceptance criteria
  - Confirm all criteria are met

[Claude automatically asks:]
Let me validate these tickets before we stop...
[Uses MCP tools to verify completion]
```

## Tool Reference

### `atlassian_get_issue`

**Purpose**: Get comprehensive details of a specific Jira issue

**Parameters**:

- `issueKey` (required): The issue key (e.g., "PROJ-123")

**Returns**: Full issue object including description, status, assignee, comments, acceptance criteria, etc.

**Example**:

```json
{
  "issueKey": "PROJ-123"
}
```

### `atlassian_search_issues`

**Purpose**: Search for issues using Jira Query Language (JQL)

**Parameters**:

- `jql` (required): JQL query string
- `maxResults` (optional): Maximum results to return (default: 50)
- `startAt` (optional): Pagination offset (default: 0)

**Returns**: Array of matching issues

**Example**:

```json
{
  "jql": "project = PROJ AND status = 'In Progress' AND assignee = currentUser()",
  "maxResults": 20
}
```

### `atlassian_create_issue`

**Purpose**: Create a new Jira issue

**Parameters**:

- `projectKey` (required): Project key (e.g., "PROJ")
- `summary` (required): Issue title
- `issueType` (required): Type (Story, Bug, Task, Epic, etc.)
- `description` (optional): Detailed description
- `priority` (optional): Priority level
- `assignee` (optional): Assignee email
- `labels` (optional): Array of labels

**Returns**: Created issue details

**Example**:

```json
{
  "projectKey": "PROJ",
  "summary": "Add user authentication",
  "issueType": "Story",
  "description": "Implement JWT-based authentication",
  "priority": "High"
}
```

### `atlassian_transition_issue`

**Purpose**: Move an issue through workflow states

**Parameters**:

- `issueKey` (required): The issue key
- `transitionName` (required): Target status name (e.g., "In Progress", "Done")

**Returns**: Transition confirmation

**Example**:

```json
{
  "issueKey": "PROJ-123",
  "transitionName": "In Progress"
}
```

### `atlassian_add_comment`

**Purpose**: Add a comment to an issue

**Parameters**:

- `issueKey` (required): The issue key
- `comment` (required): Comment text (supports markdown)

**Returns**: Comment confirmation

**Example**:

```json
{
  "issueKey": "PROJ-123",
  "comment": "Completed initial implementation. Ready for review."
}
```

### `atlassian_link_issues`

**Purpose**: Create a relationship between two issues

**Parameters**:

- `inwardIssue` (required): First issue key
- `outwardIssue` (required): Second issue key
- `linkType` (required): Relationship type (Blocks, Relates To, Duplicates, etc.)

**Returns**: Link confirmation

**Example**:

```json
{
  "inwardIssue": "PROJ-123",
  "outwardIssue": "PROJ-456",
  "linkType": "Blocks"
}
```

## Common JQL Patterns

### Your Tickets

```jql
assignee = currentUser() AND status != Done
```

### Recent Updates

```jql
updated >= -7d AND project = PROJ
```

### Sprint Tickets

```jql
sprint in openSprints() AND project = PROJ
```

### High Priority Bugs

```jql
type = Bug AND priority in (Blocker, Critical, High) AND status != Done
```

### Unassigned Tickets

```jql
assignee is EMPTY AND status = "To Do"
```

### Overdue Tickets

```jql
duedate < now() AND status != Done
```

## Security Considerations

**API Token Security:**

- Never commit API tokens to version control
- Store tokens in environment variables only
- Use separate tokens for different environments
- Rotate tokens regularly
- Revoke unused tokens immediately

**Permissions:**

- MCP server inherits your Jira permissions
- Claude can only perform actions you're authorized to do
- Review actions before Claude executes them
- Be cautious with bulk operations

**Data Privacy:**

- Ticket data is transmitted to Claude for processing
- Sensitive information in tickets will be visible to Claude
- Consider using separate Jira instances for sensitive projects

## Limitations

- **Rate Limits**: Atlassian Cloud has API rate limits (typically 5-10 requests/second per user)
- **Bulk Operations**: Large bulk operations may timeout
- **Custom Fields**: Support depends on MCP server implementation
- **Attachments**: File upload/download may have size limits
- **Advanced JQL**: Some complex JQL functions might not work as expected
- **Permissions**: You can only access tickets your Jira account has permission to view

## Troubleshooting

### Issue: Connection Errors

**Solution**:

1. Verify environment variables are set correctly:

   ```bash
   echo $ATLASSIAN_API_TOKEN
   echo $ATLASSIAN_EMAIL
   echo $ATLASSIAN_SITE_URL
   ```

2. Test API access directly:

   ```bash
   curl -u $ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN \
     $ATLASSIAN_SITE_URL/rest/api/3/myself
   ```

3. Verify site URL format (should include https:// and no trailing slash)

### Issue: Authentication Failed

**Solution**:

- Regenerate API token at <https://id.atlassian.com/manage-profile/security/api-tokens>
- Ensure email matches your Atlassian account exactly
- Check for special characters in token (copy entire token)
- Try wrapping token in quotes if it contains special characters

### Issue: No Tickets Found

**Solution**:

- Verify project key is correct (case-sensitive)
- Check your Jira permissions for the project
- Simplify JQL query to test: `project = PROJ`
- Use Jira's built-in JQL search to validate query

### Issue: Transition Failed

**Solution**:

- Get available transitions: Use `atlassian_get_transitions`
- Check exact transition name (case-sensitive, matches workflow)
- Verify ticket is in correct status for transition
- Check if transition requires specific fields

### Issue: Stop Hook Not Working

**Solution**:

- Ensure hooks are enabled in plugin settings
- Check that ticket keys are in conversation (format: ABC-123)
- Verify Node.js is available in PATH
- Check Claude Code logs for hook execution errors

## Related Plugins

- **buki-jira**: Additional Jira-focused skills and commands (if you want extended functionality beyond the MCP)
- **bushido:proof-of-work**: Requires concrete evidence of task completion
- **bushido:test-driven-development**: Ensures tests exist for acceptance criteria

## Best Practices

### DO

✅ Always read ticket acceptance criteria before starting work
✅ Update ticket status as you progress through work
✅ Add meaningful comments at key milestones
✅ Validate all acceptance criteria before marking Done
✅ Use JQL to efficiently find relevant tickets
✅ Link related tickets to maintain context
✅ Keep ticket descriptions clear and updated

### DON'T

❌ Skip reading acceptance criteria
❌ Mark tickets Done without validation
❌ Leave tickets in wrong status
❌ Create duplicate tickets without searching first
❌ Update tickets without adding context in comments
❌ Use vague or unclear ticket summaries
❌ Ignore the Stop hook validation reminders

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [Atlassian REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [JQL Reference](https://support.atlassian.com/jira-service-management-cloud/docs/use-advanced-search-with-jira-query-language-jql/)
- [MCP Server - Atlassian](https://github.com/modelcontextprotocol/servers/tree/main/src/atlassian)
- [MCP Protocol Specification](https://modelcontextprotocol.io)

---

Built with ❤️ by [The Bushido Collective](https://thebushido.co)
