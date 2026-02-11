# GitHub

Connect Claude Code to the GitHub API for comprehensive repository management, issue tracking, pull request workflows, GitHub Actions, and code search.

**Zero Configuration**: Uses GitHub Copilot's hosted MCP server - no installation, no Docker, no authentication setup required!

## What This Plugin Provides

### MCP Server: github

This plugin connects to GitHub's hosted [GitHub MCP Server](https://github.com/github/github-mcp-server) via `https://api.githubcopilot.com/mcp` to provide direct access to the GitHub API with 100+ tools for:

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

```bash
han plugin install github
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

- **OAuth Authentication**: Uses GitHub OAuth via Claude Code - authentication handled securely by GitHub
- **Hosted Server**: Connects to GitHub's official hosted MCP endpoint at `api.githubcopilot.com`
- **No Token Management**: No need to create or manage Personal Access Tokens
- **Revoke Access**: Manage OAuth authorizations at [github.com/settings/applications](https://github.com/settings/applications)

## Limitations

- API rate limits apply (5000 requests/hour for authenticated requests)
- Requires Claude Code 2.1+ with HTTP MCP transport support
- Large file operations may timeout
- GitHub Enterprise Server is not supported (GitHub.com only)

## Troubleshooting

### Issue: MCP connection failed

**Solution**: Ensure you're using Claude Code 2.1+ which supports HTTP MCP transport. Restart Claude Code if the plugin was just installed.

### Issue: Authentication required

**Solution**: The first time you use a GitHub tool, Claude Code will prompt you to authenticate via GitHub OAuth. Follow the browser authorization flow.

### Issue: Rate limit exceeded

**Solution**: Wait for rate limit reset (shown in error message). Authenticated requests have higher limits (5000/hour).

## Related Plugins

- **hashi-gitlab**: GitLab integration via MCP
- **jutsu-git**: Git workflow hooks and validation
- **do-claude-plugin-development**: Plugin linting includes git operations
