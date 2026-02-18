---
name: load-mr-context
description: Load MR context for the current branch using GitLab MCP tools
---

# Load MR Context

## Name

gitlab:load-mr-context - Load merge request context for the current branch

## Synopsis

```
/load-mr-context [project-path] [branch]
```

## Description

Loads the full context of an open merge request for the given branch, including description, changes, pipeline status, and review comments. Uses GitLab MCP tools for structured data access.

## Implementation

Given `project-path` and `branch` arguments:

1. Use `mcp__plugin_gitlab_gitlab__list_merge_requests` with `project_id: "PROJECT_PATH"`, `source_branch: "BRANCH"`, `state: "opened"` to find the MR
2. If no MR is found, report that no open MR exists for this branch and stop
3. If an MR exists, gather context **silently** (do not narrate each step):
   - Use `mcp__plugin_gitlab_gitlab__get_merge_request` with the MR IID to read description, labels, reviewers, and metadata
   - Use `mcp__plugin_gitlab_gitlab__get_merge_request_diffs` to understand what has changed
   - Check pipeline status for the branch
   - Check for review notes/discussions
   - Check for linked issues mentioned in the MR description
4. Present a concise summary:
   - MR title, number, and status
   - Key points from the description
   - Files changed (count and notable files)
   - Pipeline status (passing/failing)
   - Review status (approved, changes requested, pending)
   - Any blocking issues or failing pipelines

## Example Interaction

```
User: /load-mr-context my-group/my-project feat/mr-context

Claude: ## MR !42: Add MR context detection hooks

- **Status**: Open, 1 review pending
- **Description**: Adds SessionStart hooks to GitLab plugin that detect open MRs on the current branch
- **Changes**: 4 files (+120, -8)
- **Pipeline**: All stages passing
- **Reviews**: 1 approved, 1 pending from @reviewer

Ready to assist with this MR.
```

## Arguments

- `project-path` (required): GitLab project path (e.g., `group/project` or numeric ID)
- `branch` (required): Branch name to find the MR for

## Tips

- This skill is typically invoked automatically when starting a session on a feature branch
- All data is fetched via MCP tools (no CLI commands needed)
- The summary is kept concise to avoid cluttering the session start
