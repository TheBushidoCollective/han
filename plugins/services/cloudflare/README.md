# Cloudflare Plugin

Cloudflare integration for Claude Code, providing DNS management, Workers deployment, and edge computing operations.

## Features

- Manage DNS records and zones
- Deploy and manage Cloudflare Workers
- Configure CDN and caching rules
- Set up security features (WAF, rate limiting)
- Manage Cloudflare Pages

## Installation

```bash
claude plugin install cloudflare@han
```

## Configuration

Set your Cloudflare API token as an environment variable:

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
```

Or add to your Claude Code settings:

```json
{
  "env": {
    "CLOUDFLARE_API_TOKEN": "your-api-token"
  }
}
```

### Creating an API Token

1. Go to Cloudflare Dashboard > My Profile > API Tokens
2. Create a token with permissions for:
   - Zone:Read and Zone:Edit (for DNS)
   - Workers Scripts:Edit (for Workers)
   - Pages:Edit (for Pages)

## Usage

Once installed and configured, Claude can:

- **DNS**: "List DNS records for example.com", "Add A record for api.example.com"
- **Workers**: "List deployed Workers", "Update Worker script"
- **Zones**: "Show all zones in my account"
- **Security**: "Enable rate limiting for /api path"
- **Pages**: "List Pages projects", "Trigger deployment"

## Example Workflow

```
User: Add a CNAME record pointing blog to my-blog.netlify.app

Claude: I'll add a CNAME record for blog.example.com...

Created DNS record:
- Type: CNAME
- Name: blog
- Content: my-blog.netlify.app
- Proxied: Yes (orange cloud)
- TTL: Auto

The record is now active and proxied through Cloudflare.
```

## MCP Server

This plugin uses the Anthropic Cloudflare MCP server:
- Package: `@anthropic/mcp-server-cloudflare`

## Learn Patterns

This plugin is automatically suggested when detecting:
- Cloudflare references (`cloudflare`, `workers.dev`, `pages.dev`)
- Wrangler CLI usage (`wrangler publish`, `wrangler.toml`)
- Cloudflare environment variables (`CF_API_TOKEN`, `CLOUDFLARE_*`)
