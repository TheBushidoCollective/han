# MySQL Plugin

MySQL/MariaDB database integration for Claude Code, providing query execution, schema exploration, and database management capabilities.

## Features

- Execute SQL queries against MySQL/MariaDB databases
- Explore database schemas and table structures
- Analyze data patterns and relationships
- Full read/write database access

## Installation

```bash
claude plugin install mysql@han
```

## Configuration

Set your MySQL connection details as environment variables:

```bash
export MYSQL_HOST="localhost"
export MYSQL_USER="myuser"
export MYSQL_PASSWORD="mypassword"
export MYSQL_DATABASE="mydb"
```

Or add to your Claude Code settings:

```json
{
  "env": {
    "MYSQL_HOST": "localhost",
    "MYSQL_USER": "myuser",
    "MYSQL_PASSWORD": "mypassword",
    "MYSQL_DATABASE": "mydb"
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
- Never expose credentials in code or logs
- Consider using SSL connections in production
- Limit database user permissions to necessary operations

## MCP Server

This plugin uses the MySQL MCP server:
- Package: `@benborla/mcp-server-mysql`

## Learn Patterns

This plugin is automatically suggested when detecting:
- MySQL connection strings (`mysql://`, `mariadb://`)
- MySQL CLI tools (`mysql -u`, `mysqldump`)
