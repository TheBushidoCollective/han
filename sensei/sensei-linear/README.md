# Sensei: Linear

MCP server for Linear integration with automatic acceptance criteria validation. Connects Claude Code directly to your Linear workspace for seamless issue management and quality enforcement.

## What This Sensei Provides

### MCP Server: Linear

This sensei connects Claude Code to Linear and provides complete issue lifecycle management with built-in validation to ensure work meets acceptance criteria before marking issues complete.

**Key Capabilities:**

- **Issue Management**: Create, read, update, and manage Linear issues
- **Project & Team Access**: Work across projects and teams
- **Acceptance Criteria Validation**: Automatic validation on Stop hook
- **Workflow States**: Update issue states and track progress
- **Labels & Priorities**: Organize with labels and set priorities
- **Comments & Updates**: Add comments and update issue fields
- **Cycle Management**: View and manage sprint/cycle issues
- **Relationships**: Link related issues and manage dependencies

### Automatic Validation

When you stop a Claude Code session, this sensei automatically:

1. **Scans the conversation** for any Linear issue identifiers (e.g., ENG-123, PROD-456)
2. **Reminds you to validate** that work meets acceptance criteria
3. **Prompts Claude** to fetch issue details and verify completeness
4. **Prevents incomplete work** from being marked as done

This ensures you never forget to validate your work against issue requirements.

### Available MCP Tools

Once installed, Claude Code gains access to these Linear MCP tools:

- **`linear_get_issue`**: Get full details of a specific issue
- **`linear_search_issues`**: Search for issues with filters
- **`linear_create_issue`**: Create new Linear issues
- **`linear_update_issue`**: Update issue fields
- **`linear_update_issue_state`**: Change issue workflow state
- **`linear_add_comment`**: Add comments to issues
- **`linear_get_user`**: Get user information
- **`linear_get_team`**: Get team details
- **`linear_get_project`**: Get project information
- **`linear_list_projects`**: List all projects
- **`linear_list_cycles`**: List active cycles/sprints

## Installation

### Prerequisites

1. **Linear Workspace**: You need access to a Linear workspace
2. **API Key**: Generate a Linear API key
3. **Node.js**: For running the MCP server (comes with Claude Code)

### Getting an API Key

1. Go to https://linear.app/settings/api
2. Click "Create new API key"
3. Give it a name (e.g., "Claude Code MCP")
4. Copy the API key immediately (it won't be shown again)
5. Save it securely

### Via Han Marketplace

```bash
npx @thebushidocollective/han install
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install sensei-linear@han
```

### Configuration

Set required environment variable:

```bash
export LINEAR_API_KEY="lin_api_xxxxxxxxxxxxxxxxxxxxxxxx"
```

Add to your shell profile (`~/.zshrc` or `~/.bashrc`) for persistence:

```bash
echo 'export LINEAR_API_KEY="lin_api_xxxxxxxxxxxxxxxxxxxxxxxx"' >> ~/.zshrc
source ~/.zshrc
```

### Verify Installation

Test the MCP server connection:

```bash
# Should connect without errors
LINEAR_API_KEY="your-key" npx -y @modelcontextprotocol/server-linear
```

### Manual Installation

If not using Han, add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-linear"],
      "env": {
        "LINEAR_API_KEY": "lin_api_xxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

## Usage

### Example 1: Start Working on an Issue

```
User: I need to work on ENG-123

Claude: Let me get the details of that issue.
[Uses linear_get_issue to fetch issue]

Here's ENG-123:
Title: Add user authentication
Status: To Do
Assignee: Unassigned
Priority: High

Description:
Implement JWT-based authentication for the API.

Acceptance Criteria:
- User can log in with email/password
- Invalid credentials return proper error
- JWT token expires after 7 days
- Refresh token mechanism implemented

Would you like me to update this to "In Progress" and assign it to you?
```

### Example 2: Search for Your Issues

```
User: Show me all my open issues

Claude: [Uses linear_search_issues with assignee filter]

You have 4 open issues:

| ID      | Title                    | Status      | Priority |
|---------|-------------------------|-------------|----------|
| ENG-123 | Add authentication      | In Progress | High     |
| ENG-124 | Fix login redirect      | To Do       | Medium   |
| ENG-125 | Update user profile     | In Progress | Low      |
| ENG-126 | Add password reset      | To Do       | High     |

Which one would you like to work on?
```

### Example 3: Validate Acceptance Criteria

```
User: I've finished the authentication work for ENG-123

Claude: Let me validate the acceptance criteria.
[Uses linear_get_issue to fetch current state]

Checking ENG-123 acceptance criteria:

✅ User can log in with email/password - IMPLEMENTED
✅ Invalid credentials return proper error - IMPLEMENTED
✅ JWT token expires after 7 days - IMPLEMENTED
✅ Refresh token mechanism implemented - IMPLEMENTED

All acceptance criteria are met! Would you like me to:
1. Add a comment documenting completion
2. Update status to "Done"
3. Create a pull request linking this issue
```

### Example 4: Create a New Issue

```
User: Create a bug issue for the login page not redirecting properly

Claude: I'll create a bug issue for you.
[Uses linear_create_issue]

Created ENG-127: Login page not redirecting properly
Team: Engineering
Priority: High
Assignee: You
Status: Backlog

View: https://linear.app/your-workspace/issue/ENG-127

Would you like to start working on this now?
```

### Example 5: Stop Hook Validation

When you stop Claude Code after working on issues:

```
[Stop Hook Executes]

Found Linear issues: ENG-123, ENG-124

⚠️  VALIDATION REQUIRED
Before stopping, please validate:
  - Fetch ENG-123 details and review acceptance criteria
  - Confirm all criteria are met
  - Fetch ENG-124 details and review acceptance criteria
  - Confirm all criteria are met

[Claude automatically asks:]
Let me validate these issues before we stop...
[Uses MCP tools to verify completion]
```

## Tool Reference

### `linear_get_issue`

**Purpose**: Get comprehensive details of a specific Linear issue

**Parameters**:
- `issueId` (required): The issue ID or identifier (e.g., "ENG-123")

**Returns**: Full issue object including title, description, status, assignee, comments, etc.

**Example**:
```json
{
  "issueId": "ENG-123"
}
```

### `linear_search_issues`

**Purpose**: Search for issues with various filters

**Parameters**:
- `teamId` (optional): Filter by team ID
- `assigneeId` (optional): Filter by assignee
- `stateId` (optional): Filter by workflow state
- `priority` (optional): Filter by priority (0-4)
- `labelIds` (optional): Filter by label IDs
- `projectId` (optional): Filter by project

**Returns**: Array of matching issues

**Example**:
```json
{
  "assigneeId": "current-user-id",
  "stateId": "in-progress-state-id"
}
```

### `linear_create_issue`

**Purpose**: Create a new Linear issue

**Parameters**:
- `title` (required): Issue title
- `teamId` (required): Team ID
- `description` (optional): Issue description (supports markdown)
- `assigneeId` (optional): Assignee user ID
- `priority` (optional): Priority (0-4, where 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low)
- `stateId` (optional): Initial state ID
- `labelIds` (optional): Array of label IDs
- `projectId` (optional): Project ID

**Returns**: Created issue details

**Example**:
```json
{
  "title": "Add user authentication",
  "teamId": "team-id-here",
  "description": "Implement JWT-based authentication",
  "priority": 2
}
```

### `linear_update_issue`

**Purpose**: Update issue fields

**Parameters**:
- `issueId` (required): The issue ID
- `title` (optional): New title
- `description` (optional): New description
- `assigneeId` (optional): New assignee
- `priority` (optional): New priority
- `labelIds` (optional): New label IDs

**Returns**: Update confirmation

**Example**:
```json
{
  "issueId": "ENG-123",
  "assigneeId": "user-id",
  "priority": 1
}
```

### `linear_update_issue_state`

**Purpose**: Change issue workflow state

**Parameters**:
- `issueId` (required): The issue ID
- `stateId` (required): Target state ID

**Returns**: State change confirmation

**Example**:
```json
{
  "issueId": "ENG-123",
  "stateId": "done-state-id"
}
```

### `linear_add_comment`

**Purpose**: Add a comment to an issue

**Parameters**:
- `issueId` (required): The issue ID
- `body` (required): Comment text (supports markdown)

**Returns**: Comment confirmation

**Example**:
```json
{
  "issueId": "ENG-123",
  "body": "Completed implementation. Ready for review."
}
```

### `linear_get_team`

**Purpose**: Get team information

**Parameters**:
- `teamId` (required): The team ID or key (e.g., "ENG")

**Returns**: Team details including states, labels, members

**Example**:
```json
{
  "teamId": "ENG"
}
```

### `linear_list_projects`

**Purpose**: List all accessible projects

**Parameters**: None

**Returns**: Array of projects

**Example**:
```json
{}
```

### `linear_list_cycles`

**Purpose**: List active cycles/sprints

**Parameters**:
- `teamId` (optional): Filter by team

**Returns**: Array of cycles

**Example**:
```json
{
  "teamId": "ENG"
}
```

## Common Workflows

### Starting Work

1. Search for issues assigned to you
2. Get issue details with acceptance criteria
3. Update state to "In Progress"
4. Start implementation

### Completing Work

1. Review acceptance criteria
2. Validate all criteria are met
3. Add completion comment
4. Update state to "Done"

### Daily Standup

1. List issues you worked on yesterday (updated recently)
2. List issues currently in progress
3. Check for any blockers

## Security Considerations

**API Key Security:**
- Never commit API keys to version control
- Store keys in environment variables only
- Use separate keys for different environments
- Rotate keys regularly
- Revoke unused keys immediately

**Permissions:**
- MCP server inherits your Linear permissions
- Claude can only perform actions you're authorized to do
- Review actions before Claude executes them
- Be cautious with bulk operations

**Data Privacy:**
- Issue data is transmitted to Claude for processing
- Sensitive information in issues will be visible to Claude
- Consider using separate workspaces for sensitive projects

## Limitations

- **Rate Limits**: Linear has API rate limits (typically 2000 requests/hour)
- **Bulk Operations**: Large bulk operations may timeout
- **Custom Fields**: Support depends on MCP server implementation
- **Attachments**: File upload/download may have size limits
- **Advanced Queries**: Complex filtering might require multiple API calls
- **Permissions**: You can only access issues your Linear account has permission to view

## Troubleshooting

### Issue: Connection Errors

**Solution**:

1. Verify environment variable is set:
   ```bash
   echo $LINEAR_API_KEY
   ```

2. Test API access directly:
   ```bash
   curl -H "Authorization: $LINEAR_API_KEY" \
     https://api.linear.app/graphql \
     -d '{"query":"{ viewer { id name } }"}'
   ```

3. Ensure API key starts with `lin_api_`

### Issue: Authentication Failed

**Solution**:

- Regenerate API key at https://linear.app/settings/api
- Ensure no extra spaces or quotes around the key
- Try wrapping key in single quotes in shell config
- Verify key has necessary permissions

### Issue: No Issues Found

**Solution**:

- Verify team ID/key is correct (case-sensitive)
- Check your Linear permissions for the workspace
- Simplify search filters to test
- Use Linear's web UI to verify issue exists

### Issue: State Transition Failed

**Solution**:

- Get available states using `linear_get_team`
- Check exact state ID (not name)
- Verify issue is in correct state for transition
- Check if transition requires specific fields

### Issue: Stop Hook Not Working

**Solution**:

- Ensure hooks are enabled in plugin settings
- Check that issue IDs are in conversation (format: ABC-123)
- Verify Node.js is available in PATH
- Check Claude Code logs for hook execution errors

## Related Plugins

- **sensei-jira**: For teams using Jira instead of Linear
- **bushido:proof-of-work**: Requires concrete evidence of task completion
- **bushido:test-driven-development**: Ensures tests exist for acceptance criteria

## Best Practices

### DO

✅ Always read issue acceptance criteria before starting work
✅ Update issue state as you progress through work
✅ Add meaningful comments at key milestones
✅ Validate all acceptance criteria before marking Done
✅ Use clear, descriptive issue titles
✅ Link related issues to maintain context
✅ Keep issue descriptions clear and updated
✅ Set appropriate priorities

### DON'T

❌ Skip reading acceptance criteria
❌ Mark issues Done without validation
❌ Leave issues in wrong state
❌ Create duplicate issues without searching first
❌ Update issues without adding context in comments
❌ Use vague or unclear issue titles
❌ Ignore the Stop hook validation reminders
❌ Forget to assign issues when starting work

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [Linear API Documentation](https://developers.linear.app/docs)
- [Linear GraphQL API](https://studio.apollographql.com/public/Linear-API/home)
- [MCP Server - Linear](https://github.com/modelcontextprotocol/servers/tree/main/src/linear)
- [MCP Protocol Specification](https://modelcontextprotocol.io)

---

Built with ❤️ by [The Bushido Collective](https://thebushido.co)
