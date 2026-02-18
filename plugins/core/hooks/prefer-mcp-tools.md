# Prefer MCP Tools Over CLI Tools

**When both an MCP tool and a CLI tool can accomplish the same task, ALWAYS use the MCP tool.**

## Why

- MCP tools are already authenticated (OAuth/token handled by Claude Code)
- MCP tools return structured data the agent can reason about directly
- CLI tools require shell parsing and are prone to output format changes
- MCP tools integrate with the agent's tool use tracking and metrics

## Examples

| Task | Use This (MCP) | Not This (CLI) |
|------|----------------|-----------------|
| List PRs | `mcp__github__list_pull_requests` | `gh pr list` |
| Get issue | `mcp__github__get_issue` | `gh issue view` |
| Search code | `mcp__github__search_code` | `gh search code` |
| List MRs | `mcp__plugin_gitlab_gitlab__list_merge_requests` | `glab mr list` |
| Search Reddit | `mcp__plugin_reddit_reddit__get_subreddit_hot_posts` | manual web fetch |
| Query docs | `mcp__plugin_core_context7__query-docs` | web search |

## When CLI Is Acceptable

- The MCP server is not available or not installed
- The operation requires interactive input (e.g., `gh pr create` with editor)
- The MCP tool doesn't support the specific operation needed
- Git operations (`git commit`, `git push`) that have no MCP equivalent
