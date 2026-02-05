# MongoDB Plugin

MongoDB database integration for Claude Code, providing document queries, collection exploration, and database management capabilities.

## Features

- Execute queries against MongoDB databases
- Explore collections and document structures
- Run aggregation pipelines
- Analyze data patterns and schemas

## Installation

```bash
claude plugin install mongodb@han
```

## Configuration

Set your MongoDB connection string as an environment variable:

```bash
export MONGODB_URI="mongodb://user:password@localhost:27017/mydb"
```

For MongoDB Atlas:

```bash
export MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/mydb"
```

Or add to your Claude Code settings:

```json
{
  "env": {
    "MONGODB_URI": "mongodb://user:password@localhost:27017/mydb"
  }
}
```

## Usage

Once installed and configured, Claude can:

- **Query documents**: "Find all users with status active"
- **Explore collections**: "What collections exist in this database?"
- **Aggregate data**: "Show order totals grouped by customer"
- **Analyze schemas**: "What fields are in the products collection?"

## Security Considerations

- Use read-only database users when possible for exploration
- Never expose connection strings in code or logs
- Enable authentication and use SSL in production
- Limit database user permissions to necessary operations

## MCP Server

This plugin uses the MongoDB MCP server:
- Package: `mcp-mongo-server`

## Learn Patterns

This plugin is automatically suggested when detecting:
- MongoDB connection strings (`mongodb://`, `mongodb+srv://`)
- Mongoose connections (`mongoose.connect`)
- MongoDB CLI tools (`mongosh`, `mongodump`, `mongorestore`)
