# Sensei: GitHub

Connect Claude Code to the GitHub API for comprehensive repository management, issue tracking, pull request workflows, GitHub Actions, and code search.

## What This Sensei Provides

### MCP Server: github

This sensei uses the official [GitHub MCP Server](https://github.com/github/github-mcp-server) to provide direct access to the GitHub API with 100+ tools for:

- **Repository Management**: Create, fork, and manage repositories
- **File Operations**: Read, create, update, and delete files with automatic branch creation
- **Issues & Pull Requests**: Full lifecycle management of issues and PRs
- **GitHub Actions**: View workflow runs, trigger workflows, manage artifacts
- **Code Search**: Search across repositories, code, issues, and users
- **Code Security**: Access Dependabot alerts and security advisories

### Available Tools

Once installed, Claude Code gains access to these tool categories:

#### Repository Tools

- `create_repository`: Create a new GitHub repository
- `fork_repository`: Fork an existing repository
- `get_repository`: Get repository details
- `list_repositories`: List repositories for a user/org

#### File Operations

- `get_file_contents`: Read file contents from a repository
- `create_or_update_file`: Create or update a single file
- `push_files`: Push multiple files in a single commit
- `create_branch`: Create a new branch

#### Issues

- `create_issue`: Create a new issue
- `get_issue`: Get issue details
- `list_issues`: List issues with filters
- `update_issue`: Update issue title, body, labels, assignees
- `add_issue_comment`: Add a comment to an issue

#### Pull Requests

- `create_pull_request`: Create a new pull request
- `get_pull_request`: Get PR details including diff
- `list_pull_requests`: List PRs with filters
- `merge_pull_request`: Merge a pull request
- `update_pull_request`: Update PR title, body, base branch

#### GitHub Actions

- `list_workflow_runs`: List workflow runs
- `get_workflow_run`: Get details of a workflow run
- `trigger_workflow`: Manually trigger a workflow
- `list_artifacts`: List workflow artifacts

#### Search

- `search_code`: Search for code across GitHub
- `search_issues`: Search issues and pull requests
- `search_users`: Search for users

## Installation

### Via Han Marketplace (Recommended)

```bash
npx @thebushidocollective/han install
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install sensei-github@han
```

### Authentication

After installation, authenticate with GitHub OAuth:

1. Run `/mcp` in Claude Code
2. Select the GitHub server
3. Click "Authenticate" to open the OAuth flow in your browser
4. Authorize access to your GitHub account

Authentication tokens are stored securely and refreshed automatically.

### Manual Installation

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

Or via CLI:

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/
```

### Alternative: Docker with Personal Access Token

If you prefer using a Personal Access Token instead of OAuth, or need to use GitHub Enterprise:

1. Create a [GitHub Personal Access Token](https://github.com/settings/tokens) with scopes:
   - `repo` - Full repository access
   - `read:org` - Read organization data
   - `workflow` - Manage GitHub Actions

2. Set the environment variable:

   ```bash
   export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_your_token_here"
   ```

3. Configure the Docker-based server:

   ```json
   {
     "mcpServers": {
       "github": {
         "command": "docker",
         "args": [
           "run", "-i", "--rm",
           "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
           "ghcr.io/github/github-mcp-server"
         ],
         "env": {
           "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
         }
       }
     }
   }
   ```

## Usage

### Example 1: Create an Issue

```
User: Create an issue in my-org/my-repo titled "Bug: Login fails on mobile"
      with description "Users report login button is unresponsive on iOS Safari"

Claude: [Uses create_issue tool to create the issue and returns the issue URL]
```

### Example 2: Review a Pull Request

```
User: Show me the changes in PR #42 on my-org/my-repo

Claude: [Uses get_pull_request to fetch PR details, files changed, and diff]
```

### Example 3: Search Code

```
User: Find all uses of "deprecated_function" across my organization

Claude: [Uses search_code to find matching code across repositories]
```

### Example 4: Trigger a Workflow

```
User: Run the deploy workflow on my-org/my-repo main branch

Claude: [Uses trigger_workflow to start the workflow and returns run details]
```

### Example 5: Create a Branch and Push Changes

```
User: Create a feature branch and add a new config file

Claude: [Uses create_branch then push_files to create branch and commit file]
```

## Tool Reference

### `create_repository`

**Purpose**: Create a new GitHub repository

**Parameters**:

- `name` (required): Repository name
- `description` (optional): Repository description
- `private` (optional): Whether the repository is private
- `auto_init` (optional): Initialize with README

### `get_file_contents`

**Purpose**: Read file contents from a repository

**Parameters**:

- `owner` (required): Repository owner
- `repo` (required): Repository name
- `path` (required): File path
- `ref` (optional): Branch, tag, or commit SHA

### `create_pull_request`

**Purpose**: Create a new pull request

**Parameters**:

- `owner` (required): Repository owner
- `repo` (required): Repository name
- `title` (required): PR title
- `head` (required): Source branch
- `base` (required): Target branch
- `body` (optional): PR description
- `draft` (optional): Create as draft PR

### `search_code`

**Purpose**: Search for code across GitHub

**Parameters**:

- `q` (required): Search query (supports GitHub search syntax)
- `per_page` (optional): Results per page (max 100)
- `page` (optional): Page number

## Security Considerations

- **OAuth Tokens**: Managed automatically by Claude Code, stored securely, and refreshed as needed
- **Revoke Access**: Use `/mcp` > "Clear authentication" to revoke OAuth access anytime
- **Minimal Scopes**: OAuth requests only necessary permissions for the tools you use
- **PAT Security**: If using Personal Access Tokens, never commit them to version control

## Limitations

- API rate limits apply (5000 requests/hour for authenticated requests)
- Some operations require specific OAuth scopes
- Large file operations may timeout
- GitHub Enterprise requires Docker-based setup with PAT

## Troubleshooting

### Issue: OAuth authentication fails

**Solution**: Run `/mcp` in Claude Code, select GitHub, and click "Clear authentication" to reset. Then re-authenticate.

### Issue: "Resource not accessible"

**Solution**: The OAuth flow may not have requested sufficient scopes. Re-authenticate and ensure you grant the requested permissions.

### Issue: Rate limit exceeded

**Solution**: Wait for rate limit reset (shown in error message). Authenticated requests have higher limits (5000/hour).

### Issue: Need GitHub Enterprise support

**Solution**: Use the Docker-based setup with a Personal Access Token configured for your GitHub Enterprise instance.

## Related Plugins

- **sensei-gitlab**: GitLab integration via MCP
- **buki-git**: Git workflow hooks and validation
- **do-claude-plugin-development**: Plugin linting includes git operations

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [GitHub MCP Server Repository](https://github.com/github/github-mcp-server)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [GitHub Personal Access Tokens](https://github.com/settings/tokens)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
