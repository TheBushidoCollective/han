# Sensei: GitHub

Connect Claude Code to the GitHub API for comprehensive repository management, issue tracking, pull request workflows, GitHub Actions, and code search.

**Zero Configuration**: If you have GitHub CLI (`gh`) installed and authenticated, this plugin works instantly - no OAuth setup, no tokens to manage!

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

Install with npx (no installation required):

```bash
npx @thebushidocollective/han plugin install hashi-github
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

- **Token Security**: Uses your existing `gh` CLI authentication token
- **Revoke Access**: Revoke via `gh auth logout` or manage tokens at [github.com/settings/tokens](https://github.com/settings/tokens)
- **Minimal Privileges**: Only requests permissions based on your `gh` token scopes
- **Local Execution**: Runs locally via `npx` - no remote servers storing credentials

## Limitations

- API rate limits apply (5000 requests/hour for authenticated requests)
- Requires GitHub CLI (`gh`) to be installed and authenticated
- Large file operations may timeout
- GitHub Enterprise requires your `gh` CLI to be configured for your enterprise instance

## Troubleshooting

### Issue: "gh: command not found"

**Solution**: Install GitHub CLI from [cli.github.com](https://cli.github.com/) or via package manager:

```bash
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# Linux
sudo apt install gh  # Debian/Ubuntu
```

### Issue: Authentication errors

**Solution**: Ensure you're logged in to `gh`:

```bash
gh auth status
gh auth login  # if not authenticated
```

### Issue: Insufficient permissions

**Solution**: Re-authenticate with additional scopes:

```bash
gh auth refresh -s repo,read:org,workflow
```

### Issue: Rate limit exceeded

**Solution**: Wait for rate limit reset (shown in error message). Authenticated requests have higher limits (5000/hour).

## Related Plugins

- **hashi-gitlab**: GitLab integration via MCP
- **jutsu-git**: Git workflow hooks and validation
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
