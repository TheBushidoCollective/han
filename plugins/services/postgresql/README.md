# PostgreSQL Plugin

PostgreSQL database integration for Claude Code, providing query execution, schema exploration, and database management capabilities.

## Features

- Execute SQL queries against PostgreSQL databases
- Explore database schemas and table structures
- Analyze data patterns and relationships
- Full read/write database access

## Installation

```bash
claude plugin install postgresql@han
```

## Configuration

Set your PostgreSQL connection string as an environment variable:

```bash
export POSTGRES_CONNECTION_STRING="postgres://user:password@localhost:5432/mydb"
```

Or add to your Claude Code settings:

```json
{
  "env": {
    "POSTGRES_CONNECTION_STRING": "postgres://user:password@localhost:5432/mydb"
  }
}
```

## Usage

Once installed and configured, Claude can:

- **Query data**: "Show me the last 10 orders from the orders table"
- **Explore schema**: "What tables exist in this database?"
- **Analyze structure**: "Describe the users table schema"
- **Join operations**: "Find all orders with their customer names"

## Security Considerations

- Use read-only database users when possible for exploration
- Never expose connection strings in code or logs
- Consider using SSL connections in production
- Limit database user permissions to necessary operations

## MCP Server

This plugin uses the official Model Context Protocol PostgreSQL server:
- Package: `@modelcontextprotocol/server-postgres`

## Learn Patterns

This plugin is automatically suggested when detecting:
- PostgreSQL connection strings (`postgres://`, `postgresql://`)
- PostgreSQL CLI tools (`psql`, `pg_dump`, `pg_restore`)
