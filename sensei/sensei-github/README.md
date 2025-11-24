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

The GitHub MCP server supports two authentication methods:

| Method | Transport | Auth Type | Best For |
|--------|-----------|-----------|----------|
| **Remote Server** | HTTP | OAuth | VS Code, MCP hosts with OAuth support |
| **Docker** | stdio | Personal Access Token | Claude Code, any MCP host |

### Option 1: Remote Server with OAuth (Recommended for VS Code)

The easiest setup - uses GitHub's hosted MCP server with OAuth authentication.

**Requirements**: MCP host with HTTP transport and OAuth support (VS Code 1.101+)

Add to your MCP settings:

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

OAuth will be handled automatically by your MCP host.

### Option 2: Docker with Personal Access Token

Works with any MCP host that supports stdio transport, including Claude Code.

**Requirements**: Docker installed and running

#### Creating a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)" or use Fine-grained tokens
3. Select scopes based on your needs:
   - `repo` - Full repository access
   - `read:org` - Read organization data
   - `workflow` - Manage GitHub Actions
   - `read:user` - Read user profile data
4. Generate and copy the token

#### Via Han Marketplace

```bash
npx @thebushidocollective/han install
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install sensei-github@han
```

#### Configuration

Set your GitHub Personal Access Token:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_your_token_here"
```

Or add to your shell profile (`~/.zshrc`, `~/.bashrc`):

```bash
echo 'export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_your_token_here"' >> ~/.zshrc
source ~/.zshrc
```

#### Manual Installation (Docker)

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
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

- **Token Security**: Never commit your Personal Access Token to version control
- **Minimal Scopes**: Use the minimum required scopes for your use case
- **Token Rotation**: Regularly rotate your access tokens
- **Fine-grained Tokens**: Consider using fine-grained tokens for specific repository access
- **Docker Isolation**: The MCP server runs in an isolated Docker container

## Limitations

- Requires Docker to be installed and running
- API rate limits apply (5000 requests/hour for authenticated requests)
- Some operations require specific token scopes
- Large file operations may timeout
- GitHub Enterprise requires additional configuration

## Troubleshooting

### Issue: "Docker not found"

**Solution**: Ensure Docker is installed and the Docker daemon is running:

```bash
docker --version
docker ps  # Should not error
```

### Issue: "Bad credentials" error

**Solution**: Verify your token is set correctly:

```bash
echo $GITHUB_PERSONAL_ACCESS_TOKEN  # Should show your token
```

### Issue: "Resource not accessible"

**Solution**: Check that your token has the required scopes for the operation. Repository operations need `repo` scope, organization operations need `read:org`, etc.

### Issue: Rate limit exceeded

**Solution**: Wait for rate limit reset (shown in error message) or use a token with higher limits (GitHub Enterprise).

## Philosophy

This sensei embodies the Bushido virtues:

- **Wisdom (Chi)**: Provides access to the vast knowledge stored in GitHub repositories
- **Respect (Rei)**: Integrates thoughtfully with GitHub's API rate limits and guidelines
- **Integrity (Makoto)**: Maintains secure connections and proper authentication

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
