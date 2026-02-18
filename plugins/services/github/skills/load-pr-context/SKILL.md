---
name: load-pr-context
description: Load PR context for the current branch using GitHub MCP tools
---

# Load PR Context

## Name

github:load-pr-context - Load pull request context for the current branch

## Synopsis

```
/load-pr-context [owner/repo] [branch]
```

## Description

Loads the full context of an open pull request for the given branch, including description, changes, CI status, and review comments. Uses GitHub MCP tools for structured data access.

## Implementation

Given `owner/repo` and `branch` arguments:

1. Use `mcp__github__list_pull_requests` with `owner`, `repo`, `head: "OWNER:BRANCH"`, `state: "open"` to find the PR
2. If no PR is found, report that no open PR exists for this branch and stop
3. If a PR exists, gather context **silently** (do not narrate each step):
   - Use `mcp__github__get_pull_request` with the PR number to read description, labels, reviewers, and metadata
   - Use `mcp__github__get_pull_request_diff` or `mcp__github__list_pull_request_files` to understand what has changed
   - Use `mcp__github__list_workflow_runs` with `branch` to check CI status
   - Check for review comments via `mcp__github__list_review_comments_on_pull_request`
   - Check for linked issues mentioned in the PR description
4. Present a concise summary:
   - PR title, number, and status
   - Key points from the description
   - Files changed (count and notable files)
   - CI status (passing/failing)
   - Review status (approved, changes requested, pending)
   - Any blocking issues or failing checks

## Example Interaction

```
User: /load-pr-context thebushidocollective/han feat/pr-context

Claude: ## PR #142: Add PR/MR context detection hooks

- **Status**: Open, 2 reviews pending
- **Description**: Adds SessionStart hooks to GitHub and GitLab plugins that detect open PRs/MRs on the current branch
- **Changes**: 8 files (+245, -12)
- **CI**: All checks passing
- **Reviews**: 1 approved, 1 pending from @reviewer

Ready to assist with this PR.
```

## Arguments

- `owner/repo` (required): Repository in owner/repo format
- `branch` (required): Branch name to find the PR for

## Tips

- This skill is typically invoked automatically when starting a session on a feature branch
- All data is fetched via MCP tools (no CLI commands needed)
- The summary is kept concise to avoid cluttering the session start
