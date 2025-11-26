# Sensei: ClickUp

MCP server for ClickUp integration with automatic acceptance criteria validation. Connects Claude Code directly to your ClickUp workspace for seamless task management and quality enforcement.

## What This Sensei Provides

### MCP Server: ClickUp

This sensei connects Claude Code to ClickUp and provides complete task lifecycle management with built-in validation to ensure work meets acceptance criteria before marking tasks complete.

**Key Capabilities:**

- **Task Management**: Create, read, update, and manage ClickUp tasks
- **Workspace & Space Access**: Work across workspaces, spaces, folders, and lists
- **Acceptance Criteria Validation**: Automatic validation on Stop hook
- **Status Updates**: Update task statuses and track progress
- **Custom Fields**: Access and update custom fields
- **Comments & Updates**: Add comments and update task details
- **Checklist Management**: Create and manage task checklists
- **Time Tracking**: Track time spent on tasks
- **Assignees & Watchers**: Manage task assignments and watchers

### Automatic Validation

When you stop a Claude Code session, this sensei automatically:

1. **Scans the conversation** for any ClickUp task references (e.g., #ABC123, task-id: xyz)
2. **Reminds you to validate** that work meets acceptance criteria
3. **Prompts Claude** to fetch task details and verify completeness
4. **Prevents incomplete work** from being marked as done

This ensures you never forget to validate your work against task requirements.

### Available MCP Tools

Once installed, Claude Code gains access to these ClickUp MCP tools:

- **`clickup_get_task`**: Get full details of a specific task
- **`clickup_search_tasks`**: Search for tasks with filters
- **`clickup_create_task`**: Create new ClickUp tasks
- **`clickup_update_task`**: Update task fields
- **`clickup_update_task_status`**: Change task status
- **`clickup_add_comment`**: Add comments to tasks
- **`clickup_get_list`**: Get list details
- **`clickup_get_folder`**: Get folder information
- **`clickup_get_space`**: Get space details
- **`clickup_get_workspace`**: Get workspace information
- **`clickup_create_checklist`**: Create task checklists
- **`clickup_track_time`**: Track time on tasks
- **`clickup_assign_task`**: Assign tasks to users

## Installation

### Prerequisites

1. **ClickUp Workspace**: You need access to a ClickUp workspace
2. **API Token**: Generate a ClickUp API token
3. **Node.js**: For running the MCP server (comes with Claude Code)

### Getting an API Token

1. Go to <https://app.clickup.com/settings/apps>
2. Click "Apps" in the left sidebar
3. Click "API Token"
4. Click "Generate" or use existing token
5. Copy the API token
6. Save it securely

### Via Han Marketplace

```bash
npx @thebushidocollective/han plugin install sensei-clickup@han
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install sensei-clickup@han
```

### Configuration

Set required environment variable:

```bash
export CLICKUP_API_TOKEN="pk_xxxxxxxxxxxxxxxxxxxxxxxx"
```

Add to your shell profile (`~/.zshrc` or `~/.bashrc`) for persistence:

```bash
echo 'export CLICKUP_API_TOKEN="pk_xxxxxxxxxxxxxxxxxxxxxxxx"' >> ~/.zshrc
source ~/.zshrc
```

### Verify Installation

Test the MCP server connection:

```bash
# Should connect without errors
CLICKUP_API_TOKEN="your-token" npx -y @modelcontextprotocol/server-clickup
```

### Manual Installation

If not using Han, add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "clickup": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-clickup"],
      "env": {
        "CLICKUP_API_TOKEN": "pk_xxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

## Usage

### Example 1: Start Working on a Task

```
User: I need to work on task #ABC123

Claude: Let me get the details of that task.
[Uses clickup_get_task to fetch task]

Here's task #ABC123:
Name: Add user authentication
Status: To Do
Assignee: Unassigned
Priority: High
Due Date: 2025-02-01

Description:
Implement JWT-based authentication for the API.

Checklist:
- [ ] User can log in with email/password
- [ ] Invalid credentials return proper error
- [ ] JWT token expires after 7 days
- [ ] Refresh token mechanism implemented

Would you like me to update this to "In Progress" and assign it to you?
```

### Example 2: Search for Your Tasks

```
User: Show me all my assigned tasks

Claude: [Uses clickup_search_tasks with assignee filter]

You have 5 assigned tasks:

| ID      | Name                     | Status      | Priority | Due Date   |
|---------|-------------------------|-------------|----------|------------|
| ABC123  | Add authentication      | In Progress | High     | Feb 1      |
| ABC124  | Fix login redirect      | To Do       | Medium   | Feb 3      |
| ABC125  | Update user profile     | In Progress | Low      | Feb 5      |
| ABC126  | Add password reset      | To Do       | High     | Feb 2      |
| ABC127  | Implement 2FA           | Backlog     | Medium   | Feb 10     |

Which one would you like to work on?
```

### Example 3: Validate Acceptance Criteria

```
User: I've finished the authentication work for #ABC123

Claude: Let me validate the acceptance criteria.
[Uses clickup_get_task to fetch current state]

Checking task #ABC123 checklist:

✅ User can log in with email/password - COMPLETED
✅ Invalid credentials return proper error - COMPLETED
✅ JWT token expires after 7 days - COMPLETED
✅ Refresh token mechanism implemented - COMPLETED

All checklist items are complete! Would you like me to:
1. Add a completion comment
2. Update status to "Done"
3. Close the task
```

### Example 4: Create a New Task

```
User: Create a bug task for the login page not redirecting properly

Claude: I'll create a bug task for you.
[Uses clickup_create_task]

Created task #ABC128: Login page not redirecting properly
List: Bug Fixes
Priority: High
Assignee: You
Status: To Do

View: https://app.clickup.com/t/ABC128

Would you like to start working on this now?
```

### Example 5: Stop Hook Validation

When you stop Claude Code after working on tasks:

```
[Stop Hook Executes]

Found ClickUp tasks: ABC123, ABC124

⚠️  VALIDATION REQUIRED
Before stopping, please validate:
  - Fetch task ABC123 details and review checklist
  - Confirm all criteria are met
  - Fetch task ABC124 details and review checklist
  - Confirm all criteria are met

[Claude automatically asks:]
Let me validate these tasks before we stop...
[Uses MCP tools to verify completion]
```

## Tool Reference

### `clickup_get_task`

**Purpose**: Get comprehensive details of a specific ClickUp task

**Parameters**:

- `taskId` (required): The task ID (e.g., "ABC123" or full ID)

**Returns**: Full task object including name, description, status, assignees, checklist, custom fields, etc.

**Example**:

```json
{
  "taskId": "ABC123"
}
```

### `clickup_search_tasks`

**Purpose**: Search for tasks with various filters

**Parameters**:

- `listId` (optional): Filter by list ID
- `folderId` (optional): Filter by folder ID
- `spaceId` (optional): Filter by space ID
- `assignees` (optional): Filter by assignee IDs
- `statuses` (optional): Filter by status names
- `tags` (optional): Filter by tag names
- `dueDateGt` (optional): Due date greater than (timestamp)
- `dueDateLt` (optional): Due date less than (timestamp)

**Returns**: Array of matching tasks

**Example**:

```json
{
  "listId": "123456789",
  "assignees": ["user-id"],
  "statuses": ["in progress"]
}
```

### `clickup_create_task`

**Purpose**: Create a new ClickUp task

**Parameters**:

- `listId` (required): List ID where task will be created
- `name` (required): Task name
- `description` (optional): Task description (supports markdown)
- `assignees` (optional): Array of user IDs to assign
- `priority` (optional): Priority (1=Urgent, 2=High, 3=Normal, 4=Low)
- `status` (optional): Initial status name
- `dueDate` (optional): Due date timestamp
- `tags` (optional): Array of tag names

**Returns**: Created task details

**Example**:

```json
{
  "listId": "123456789",
  "name": "Add user authentication",
  "description": "Implement JWT-based authentication",
  "priority": 2,
  "assignees": ["user-id"]
}
```

### `clickup_update_task`

**Purpose**: Update task fields

**Parameters**:

- `taskId` (required): The task ID
- `name` (optional): New task name
- `description` (optional): New description
- `priority` (optional): New priority
- `dueDate` (optional): New due date
- `assignees` (optional): New assignee list

**Returns**: Update confirmation

**Example**:

```json
{
  "taskId": "ABC123",
  "priority": 1,
  "dueDate": 1738368000000
}
```

### `clickup_update_task_status`

**Purpose**: Change task status

**Parameters**:

- `taskId` (required): The task ID
- `status` (required): Target status name (e.g., "in progress", "done")

**Returns**: Status change confirmation

**Example**:

```json
{
  "taskId": "ABC123",
  "status": "in progress"
}
```

### `clickup_add_comment`

**Purpose**: Add a comment to a task

**Parameters**:

- `taskId` (required): The task ID
- `comment` (required): Comment text (supports markdown)
- `notify_all` (optional): Notify all task followers (boolean)

**Returns**: Comment confirmation

**Example**:

```json
{
  "taskId": "ABC123",
  "comment": "Completed implementation. Ready for review.",
  "notify_all": true
}
```

### `clickup_create_checklist`

**Purpose**: Create a checklist on a task

**Parameters**:

- `taskId` (required): The task ID
- `name` (required): Checklist name
- `items` (optional): Array of checklist item names

**Returns**: Checklist creation confirmation

**Example**:

```json
{
  "taskId": "ABC123",
  "name": "Acceptance Criteria",
  "items": [
    "User can log in",
    "Error handling works",
    "Tests pass"
  ]
}
```

### `clickup_track_time`

**Purpose**: Track time on a task

**Parameters**:

- `taskId` (required): The task ID
- `duration` (required): Duration in milliseconds
- `description` (optional): Time entry description

**Returns**: Time tracking confirmation

**Example**:

```json
{
  "taskId": "ABC123",
  "duration": 7200000,
  "description": "Implemented authentication logic"
}
```

### `clickup_assign_task`

**Purpose**: Assign or unassign users to a task

**Parameters**:

- `taskId` (required): The task ID
- `assignees` (required): Array of user IDs to assign
- `add` (optional): If true, adds to existing assignees; if false, replaces

**Returns**: Assignment confirmation

**Example**:

```json
{
  "taskId": "ABC123",
  "assignees": ["user-id-1", "user-id-2"],
  "add": true
}
```

### `clickup_get_list`

**Purpose**: Get list information

**Parameters**:

- `listId` (required): The list ID

**Returns**: List details including tasks, statuses, fields

**Example**:

```json
{
  "listId": "123456789"
}
```

### `clickup_get_workspace`

**Purpose**: Get workspace information and teams

**Parameters**:

- `workspaceId` (optional): Specific workspace ID, or omit for all accessible workspaces

**Returns**: Workspace details

**Example**:

```json
{
  "workspaceId": "workspace-id"
}
```

## Common Workflows

### Starting Work

1. Search for tasks assigned to you or in specific list
2. Get task details with checklist and acceptance criteria
3. Update status to "In Progress"
4. Assign to yourself if not already assigned
5. Start implementation

### Completing Work

1. Review task checklist items
2. Validate all items are complete
3. Add completion comment with summary
4. Update status to "Done" or "Complete"
5. Track time spent (optional)

### Daily Standup

1. List tasks updated in last 24 hours (your tasks)
2. List tasks currently in progress
3. Check for any blocked tasks
4. Review upcoming due dates

## Security Considerations

**API Token Security:**

- Never commit API tokens to version control
- Store tokens in environment variables only
- Use separate tokens for different environments
- Rotate tokens regularly
- Revoke unused tokens immediately

**Permissions:**

- MCP server inherits your ClickUp permissions
- Claude can only perform actions you're authorized to do
- Review actions before Claude executes them
- Be cautious with bulk operations

**Data Privacy:**

- Task data is transmitted to Claude for processing
- Sensitive information in tasks will be visible to Claude
- Consider using separate workspaces for sensitive projects

## Limitations

- **Rate Limits**: ClickUp has API rate limits (typically 100 requests/minute per token)
- **Bulk Operations**: Large bulk operations may timeout
- **Custom Fields**: Support depends on MCP server implementation
- **Attachments**: File upload/download may have size limits
- **Permissions**: You can only access tasks your ClickUp account has permission to view
- **Webhooks**: Real-time updates not supported (must poll for changes)

## Troubleshooting

### Issue: Connection Errors

**Solution**:

1. Verify environment variable is set:

   ```bash
   echo $CLICKUP_API_TOKEN
   ```

2. Test API access directly:

   ```bash
   curl -H "Authorization: $CLICKUP_API_TOKEN" \
     https://api.clickup.com/api/v2/user
   ```

3. Ensure token starts with `pk_`

### Issue: Authentication Failed

**Solution**:

- Regenerate API token at <https://app.clickup.com/settings/apps>
- Ensure no extra spaces or quotes around the token
- Try wrapping token in single quotes in shell config
- Verify token hasn't expired

### Issue: No Tasks Found

**Solution**:

- Verify list/space/folder ID is correct
- Check your ClickUp permissions for the workspace
- Simplify search filters to test
- Use ClickUp's web UI to verify task exists

### Issue: Status Update Failed

**Solution**:

- Get available statuses from list using `clickup_get_list`
- Check exact status name (case-sensitive)
- Verify task is in correct status for transition
- Check if status requires specific custom fields

### Issue: Stop Hook Not Working

**Solution**:

- Ensure hooks are enabled in plugin settings
- Check that task IDs are in conversation (format: #ABC123 or task-id: xyz)
- Verify Node.js is available in PATH
- Check Claude Code logs for hook execution errors

## Related Plugins

- **sensei-jira**: For teams using Jira instead of ClickUp
- **sensei-linear**: For teams using Linear instead of ClickUp
- **bushido:proof-of-work**: Requires concrete evidence of task completion
- **bushido:test-driven-development**: Ensures tests exist for acceptance criteria

## Best Practices

### DO

✅ Always read task checklist before starting work
✅ Update task status as you progress
✅ Add meaningful comments at key milestones
✅ Validate all checklist items before marking Done
✅ Use clear, descriptive task names
✅ Track time spent on tasks
✅ Keep task descriptions clear and updated
✅ Set appropriate priorities and due dates

### DON'T

❌ Skip reading task checklist/acceptance criteria
❌ Mark tasks Done without validation
❌ Leave tasks in wrong status
❌ Create duplicate tasks without searching first
❌ Update tasks without adding context in comments
❌ Use vague or unclear task names
❌ Ignore the Stop hook validation reminders
❌ Forget to assign tasks when starting work

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [ClickUp API Documentation](https://clickup.com/api)
- [ClickUp API v2 Reference](https://clickup.com/api/clickupreference/operation/GetTasks/)
- [MCP Server - ClickUp](https://github.com/modelcontextprotocol/servers/tree/main/src/clickup)
- [MCP Protocol Specification](https://modelcontextprotocol.io)

---

Built with ❤️ by [The Bushido Collective](https://thebushido.co)
