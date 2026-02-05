---
description: Execute SQL queries against MySQL database
---

# Query MySQL Database

## Name

mysql:query-database - Execute SQL queries against MySQL database

## Synopsis

```
/query-database <sql_query>
```

## Description

Execute SQL queries against the configured MySQL database. Supports SELECT, INSERT, UPDATE, DELETE, and DDL operations depending on database user permissions.

## Arguments

- `sql_query` - The SQL query to execute (required)

## Implementation

1. Connect to MySQL using the configured connection details
2. Execute the provided SQL query
3. Return results in a formatted table for SELECT queries
4. Return affected row counts for DML operations
5. Handle errors gracefully with helpful messages

## Example Interaction

```
User: /query-database SELECT * FROM users LIMIT 5

Claude: Executing query against MySQL...

| id | name      | email              | created_at          |
|----|-----------|--------------------| --------------------|
| 1  | Alice     | alice@example.com  | 2024-01-15 10:30:00 |
| 2  | Bob       | bob@example.com    | 2024-01-16 14:22:00 |
| 3  | Charlie   | charlie@example.com| 2024-01-17 09:15:00 |

Returned 3 rows.
```

## Notes

- Requires MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE environment variables
- Use read-only users for exploration to prevent accidental modifications
- Large result sets may be truncated
