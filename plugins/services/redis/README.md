# Redis Plugin

Redis integration for Claude Code, providing key-value operations, data exploration, and cache management capabilities.

## Features

- Get and set key-value pairs
- Explore key patterns and namespaces
- Work with Redis data structures (strings, hashes, lists, sets)
- Monitor cache performance and memory usage

## Installation

```bash
claude plugin install redis@han
```

## Configuration

Set your Redis connection URL as an environment variable:

```bash
export REDIS_URL="redis://localhost:6379"
```

With authentication:

```bash
export REDIS_URL="redis://:password@localhost:6379/0"
```

For Redis with TLS:

```bash
export REDIS_URL="rediss://user:password@redis.example.com:6380"
```

Or add to your Claude Code settings:

```json
{
  "env": {
    "REDIS_URL": "redis://localhost:6379"
  }
}
```

## Usage

Once installed and configured, Claude can:

- **Get values**: "What is the value of session:abc123?"
- **Explore keys**: "List all keys matching user:*"
- **Set values**: "Cache this result under key api:response:123"
- **Check stats**: "Show Redis server info and memory usage"

## Security Considerations

- Use authentication in production environments
- Enable TLS for connections over networks
- Limit commands if using Redis ACLs
- Never expose connection URLs in code or logs

## MCP Server

This plugin uses the official Model Context Protocol Redis server:
- Package: `@modelcontextprotocol/server-redis`

## Learn Patterns

This plugin is automatically suggested when detecting:
- Redis connection URLs (`redis://`, `rediss://`)
- Redis client libraries (`redis.createClient`, `ioredis`)
- Redis CLI usage (`redis-cli`)
- Redis environment variables (`REDIS_URL`, `REDIS_HOST`)
