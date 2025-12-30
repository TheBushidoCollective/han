# Hashi: Notion

Connect Claude Code to your Notion workspace via Notion's official hosted MCP server. Search pages, manage content, query databases, and collaborate with AI-optimized access to your knowledge base.

## What This Hashi Provides

### MCP Server: notion

Notion MCP provides a token-efficient, Markdown-based API optimized for AI assistants. The server uses "Notion-flavored" Markdown for powerful page creation and editing.

This hashi connects Claude Code to Notion and provides:

- **Workspace Search**: Search across your Notion workspace and connected tools (Slack, Google Drive, Jira)
- **Page Management**: Create, update, duplicate, and move pages
- **Database Operations**: Query, create, and update databases with structured data
- **Content Access**: Retrieve and edit pages in AI-optimized Markdown format
- **Collaboration**: Add and view comments on pages
- **Team Context**: Access workspace users and teams

### Available Tools

Once installed, Claude Code gains access to these tools:

| Tool | Purpose |
|------|---------|
| `notion-search` | Search across workspace and connected tools (requires Notion AI) |
| `notion-fetch` | Retrieve page or database content by URL |
| `notion-create-pages` | Create one or multiple pages with content |
| `notion-update-page` | Modify page properties or content |
| `notion-move-pages` | Relocate pages to different parent locations |
| `notion-duplicate-page` | Create a copy of an existing page |
| `notion-create-database` | Create new databases with schemas |
| `notion-update-database` | Modify database properties and attributes |
| `notion-query-data-sources` | Query multiple data sources with filters (Enterprise + AI) |
| `notion-create-comment` | Add comments to pages |
| `notion-get-comments` | List page comments including threads |
| `notion-get-teams` | Retrieve workspace teams and membership |
| `notion-get-users` | List all workspace users |
| `notion-get-user` | Get specific user information |
| `notion-get-self` | Get bot user and workspace info |

## Installation

### Prerequisites

- A Notion account with workspace access
- Notion AI subscription (for search and advanced features)

### Via Han Marketplace

```bash
han plugin install hashi-notion
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install hashi-notion@han
```

### Authentication

Notion MCP uses OAuth for authentication. On first use:

1. Claude Code will prompt you to authorize the connection
2. Click the authorization link to grant workspace access
3. The OAuth flow handles token management automatically

No environment variables or API keys required.

## Usage

### Example 1: Search and Retrieve Documentation

```
Search my Notion workspace for "API documentation" and summarize the key endpoints
```

Claude will use `notion-search` to find relevant pages, then `notion-fetch` to retrieve content.

### Example 2: Create Meeting Notes

```
Create a new Notion page titled "Team Standup - December 2024" with these notes:
- Discussed Q1 roadmap priorities
- Action items assigned to engineering team
- Next meeting scheduled for Friday
```

Claude will use `notion-create-pages` to create a formatted page.

### Example 3: Query a Task Database

```
Query my Tasks database for items with status "In Progress" assigned to me
```

Claude will use `notion-fetch` or `notion-query-data-sources` to retrieve filtered results.

### Example 4: Update Page Content

```
Update the "Project README" page to include a new section about deployment
```

Claude will use `notion-fetch` to get current content, then `notion-update-page` to add the new section.

## Tool Reference

### notion-search

**Purpose**: Search across your Notion workspace and connected integrations

**Notes**: Requires Notion AI access. Searches pages, databases, and connected tools like Slack and Google Drive.

### notion-fetch

**Purpose**: Retrieve content from a specific page or database

**Parameters**:
- URL or page ID of the Notion resource

**Returns**: Page content in AI-optimized Markdown format

### notion-create-pages

**Purpose**: Create new pages with specified content

**Parameters**:
- Parent location (page or database)
- Page title and properties
- Content in Markdown format

### notion-query-data-sources

**Purpose**: Query databases with structured filters

**Notes**: Enterprise + Notion AI required. Returns summarized results.

## Rate Limits

- Standard API: **180 requests per minute**
- Search operations: **30 requests per minute**

## Limitations

- Some features require Notion AI subscription
- Enterprise features (query-data-sources) require Enterprise plan
- OAuth authorization required on first use
- Rate limits apply to all API operations

## Troubleshooting

### Issue: Authorization Failed

**Solution**: Clear any cached OAuth tokens and re-authorize:
1. Disconnect the Notion integration in your Notion settings
2. Restart Claude Code
3. Re-authorize when prompted

### Issue: Search Returns No Results

**Solution**: Ensure your Notion AI subscription is active. The `notion-search` tool requires Notion AI access.

### Issue: Cannot Access Page

**Solution**: Verify the page is shared with the Notion integration. Check page permissions in Notion's Share settings.

## Related Plugins

- **hashi-github**: GitHub integration for code and issues
- **hashi-linear**: Linear project management integration
- **hashi-jira**: Jira ticket management

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [Notion MCP Documentation](https://developers.notion.com/docs/mcp)
- [Notion MCP Getting Started](https://developers.notion.com/docs/get-started-with-mcp)
- [Notion Help Center - MCP](https://www.notion.com/help/notion-mcp)
- [Official Notion MCP Server (GitHub)](https://github.com/makenotion/notion-mcp-server)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
