# Sensei: GitLab

Official GitLab MCP server integration for comprehensive project management, issue tracking, merge request operations, and code search capabilities.

## What This Sensei Provides

### MCP Server: gitlab

The official GitLab MCP server enables AI assistants to securely interact with your GitLab instance through OAuth 2.0 authentication. This integration provides full access to GitLab's project management, issue tracking, merge request workflows, CI/CD pipelines, and intelligent code search capabilities.

This sensei connects Claude Code to GitLab and provides:

- **Issue Management**: Create, read, and manage GitLab issues across projects
- **Merge Request Operations**: Create MRs, view commits, diffs, and pipeline status
- **CI/CD Integration**: Access pipeline information and job details
- **Code Search**: Perform instance-wide searches and semantic code queries
- **Project Data Access**: Secure read/write access to GitLab projects via OAuth 2.0

### Available Tools

Once installed, Claude Code gains access to these tools:

- `get_mcp_server_version`: Returns the GitLab MCP server version information
- `create_issue`: Creates new issues in GitLab projects with title, description, and labels
- `get_issue`: Retrieves detailed information about a specific issue
- `create_merge_request`: Creates new merge requests (requires GitLab 18.5+)
- `get_merge_request`: Fetches comprehensive merge request information
- `get_merge_request_commits`: Lists all commits in a merge request
- `get_merge_request_diffs`: Shows file changes and diffs in a merge request
- `get_merge_request_pipelines`: Retrieves CI/CD pipeline data for a merge request
- `get_pipeline_jobs`: Lists all jobs in a specific CI/CD pipeline
- `gitlab_search`: Searches for terms across the entire GitLab instance
- `semantic_code_search`: Finds relevant code snippets using semantic search (GitLab.com only)

## Installation

For `han` CLI installation instructions, visit [han.guru](https://han.guru).

```bash
han install sensei-gitlab
```

## Usage

### Example 1: Creating an Issue

Create a new issue in a GitLab project:

```
User: Create an issue in project 123 titled "Fix login redirect bug" with description "Users are redirected to the wrong page after login"

Claude: I'll create that issue for you using the create_issue tool.

[Creates issue with specified title and description in project 123]

Issue created successfully: #42 - "Fix login redirect bug"
```

### Example 2: Reviewing a Merge Request

Get comprehensive information about a merge request:

```
User: Show me the details of merge request 15 in project 456, including the commits and file changes

Claude: Let me fetch that information for you.

[Uses get_merge_request, get_merge_request_commits, and get_merge_request_diffs tools]

Merge Request #15: "Add user authentication"
- Status: Open
- Author: @johndoe
- Target Branch: main
- Commits: 3 commits
- Files Changed: src/auth.ts (+45, -0), src/api/login.ts (+23, -5)
```

### Example 3: Searching Code

Find relevant code across your GitLab instance:

```
User: Search for implementations of JWT token validation in the codebase

Claude: I'll search for JWT token validation code.

[Uses semantic_code_search or gitlab_search tools]

Found 5 relevant results across 3 projects:
1. auth-service/src/middleware/validateToken.ts
2. api-gateway/lib/security/jwt.ts
3. user-service/utils/auth.ts
```

### Example 4: Monitoring CI/CD Pipelines

Check pipeline status and job details:

```
User: What's the status of the latest pipeline for merge request 42 in project 789?

Claude: Let me check the pipeline status.

[Uses get_merge_request_pipelines and get_pipeline_jobs tools]

Pipeline #1234 - Status: Running
- build: ✓ Passed (2m 15s)
- test: ⏳ Running (1m 45s)
- deploy: ⏸️ Pending
```

## Tool Reference

### `create_issue`

**Purpose**: Creates a new issue in a GitLab project

**Parameters**:

- `project_id` (required): Numeric project ID or URL-encoded project path
- `title` (required): Issue title
- `description` (optional): Issue description in Markdown format
- `labels` (optional): Array of label names to add to the issue

**Example**:

```json
{
  "project_id": "123",
  "title": "Fix memory leak in image processing",
  "description": "Memory usage increases over time when processing large images",
  "labels": ["bug", "high-priority"]
}
```

### `get_issue`

**Purpose**: Retrieves detailed information about a specific issue

**Parameters**:

- `project_id` (required): Numeric project ID or URL-encoded project path
- `issue_iid` (required): Internal issue ID (the number shown in the UI)

**Example**:

```json
{
  "project_id": "123",
  "issue_iid": "42"
}
```

### `create_merge_request`

**Purpose**: Creates a new merge request (GitLab 18.5+)

**Parameters**:

- `project_id` (required): Numeric project ID or URL-encoded project path
- `source_branch` (required): Source branch name
- `target_branch` (required): Target branch name
- `title` (required): Merge request title
- `description` (optional): MR description in Markdown format

**Example**:

```json
{
  "project_id": "456",
  "source_branch": "feature/user-auth",
  "target_branch": "main",
  "title": "Add user authentication system",
  "description": "Implements JWT-based authentication"
}
```

### `get_merge_request`

**Purpose**: Fetches comprehensive merge request information

**Parameters**:

- `project_id` (required): Numeric project ID or URL-encoded project path
- `merge_request_iid` (required): Internal MR ID

**Example**:

```json
{
  "project_id": "456",
  "merge_request_iid": "15"
}
```

### `get_merge_request_commits`

**Purpose**: Lists all commits in a merge request

**Parameters**:

- `project_id` (required): Numeric project ID or URL-encoded project path
- `merge_request_iid` (required): Internal MR ID

**Example**:

```json
{
  "project_id": "456",
  "merge_request_iid": "15"
}
```

### `get_merge_request_diffs`

**Purpose**: Shows file changes and diffs in a merge request

**Parameters**:

- `project_id` (required): Numeric project ID or URL-encoded project path
- `merge_request_iid` (required): Internal MR ID

**Example**:

```json
{
  "project_id": "456",
  "merge_request_iid": "15"
}
```

### `get_merge_request_pipelines`

**Purpose**: Retrieves CI/CD pipeline data for a merge request

**Parameters**:

- `project_id` (required): Numeric project ID or URL-encoded project path
- `merge_request_iid` (required): Internal MR ID

**Example**:

```json
{
  "project_id": "456",
  "merge_request_iid": "15"
}
```

### `get_pipeline_jobs`

**Purpose**: Lists all jobs in a specific CI/CD pipeline

**Parameters**:

- `project_id` (required): Numeric project ID or URL-encoded project path
- `pipeline_id` (required): Pipeline ID

**Example**:

```json
{
  "project_id": "456",
  "pipeline_id": "1234"
}
```

### `gitlab_search`

**Purpose**: Searches for a term across the entire GitLab instance

**Parameters**:

- `search` (required): Search term
- `scope` (optional): Search scope (issues, merge_requests, projects, etc.)

**Example**:

```json
{
  "search": "authentication bug",
  "scope": "issues"
}
```

### `semantic_code_search`

**Purpose**: Finds relevant code snippets using AI-powered semantic search

**Note**: Available on GitLab.com only

**Parameters**:

- `query` (required): Natural language query describing what you're looking for

**Example**:

```json
{
  "query": "How are user permissions checked in the API?"
}
```

## Security Considerations

**OAuth 2.0 Authentication**:

- The GitLab MCP server uses OAuth 2.0 with dynamic client registration
- Browser-based authorization flow on first connection
- Tokens are managed securely by the MCP server

**Prompt Injection Risks**:

- Be cautious when working with untrusted GitLab objects
- Review AI-generated code or changes carefully before applying
- Validate issue descriptions and comments from external sources

**Access Control**:

- The MCP server inherits your GitLab permissions
- Only projects you have access to will be available
- Respects GitLab's built-in access control and visibility settings

**Data Privacy**:

- All communication goes through GitLab's API
- No data is stored or cached by the MCP server
- Audit logs are maintained in GitLab's standard audit trail

## Limitations

**Version Requirements**:

- Merge request creation requires GitLab 18.5 or later
- Beta features must be enabled for GitLab 18.4 and earlier
- Semantic code search is only available on GitLab.com

**Rate Limits**:

- Subject to GitLab API rate limits (varies by tier)
- Premium: 2,000 requests per minute
- Ultimate: 4,000 requests per minute

**Feature Availability**:

- Some features require specific GitLab tiers (Premium/Ultimate)
- GitLab Duo add-on required for AI features
- Self-hosted instances need proper configuration

**Scope Limitations**:

- Default `mcp` OAuth scope provides read/write access
- Cannot perform admin-level operations
- Cannot modify GitLab instance settings

## Troubleshooting

### Issue: OAuth Authorization Fails

**Solution**:

1. Ensure you're logged into GitLab in your default browser
2. Check that beta features are enabled (GitLab 18.4 and earlier)
3. Verify your account has the necessary permissions
4. Try clearing browser cookies and re-authorizing

### Issue: "Project not found" Error

**Solution**:

1. Verify the project ID is correct (use numeric ID or URL-encoded path)
2. Ensure you have access to the project
3. For private projects, confirm OAuth scope includes necessary permissions
4. Check if the project exists and isn't archived

### Issue: Merge Request Creation Unavailable

**Solution**:

1. Verify your GitLab version is 18.5 or later
2. Ensure you have Developer or higher role in the project
3. Check that both source and target branches exist
4. Confirm branch protection rules allow MR creation

### Issue: Semantic Search Not Working

**Solution**:

1. Confirm you're using GitLab.com (not self-hosted)
2. Verify GitLab Duo is enabled for your account
3. Check that you have the necessary add-on subscription
4. Fall back to `gitlab_search` for basic search functionality

### Issue: Authentication Token Expired

**Solution**:

1. Run `/mcp` in Claude Code
2. Select the GitLab server
3. Click "Clear authentication" to reset
4. Re-authenticate through the OAuth flow

## Related Plugins

- **sensei-context7**: Up-to-date library documentation for code references
- **sensei-playwright-mcp**: Browser automation for testing GitLab UIs
- **buki-git**: Git operations and repository management skills
- **do-devops**: DevOps practices including CI/CD workflows

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [GitLab MCP Server Documentation](https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/mcp_server/)
- [Model Context Protocol](https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [GitLab Duo Documentation](https://docs.gitlab.com/user/gitlab_duo/)

---

**Sources:**

- [GitLab MCP server | GitLab Docs](https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/mcp_server/)
- [Model Context Protocol | GitLab Docs](https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/)
- [@modelcontextprotocol/server-gitlab - npm](https://www.npmjs.com/package/@modelcontextprotocol/server-gitlab)
