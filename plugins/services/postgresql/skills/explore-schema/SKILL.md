---
description: Explore PostgreSQL database schema and table structures
---

# Explore PostgreSQL Schema

## Name

postgresql:explore-schema - Explore PostgreSQL database schema and table structures

## Synopsis

```
/explore-schema [table_name]
```

## Description

Explore the PostgreSQL database schema, list available tables, and describe table structures including columns, types, constraints, and indexes.

## Arguments

- `table_name` - Optional specific table to describe. If omitted, lists all tables.

## Implementation

1. If no table specified:
   - List all tables in the database
   - Show table counts and basic metadata
2. If table specified:
   - Show column names, types, and constraints
   - List primary keys and foreign keys
   - Show indexes on the table
   - Display sample data (first few rows)

## Example Interaction

```
User: /explore-schema

Claude: Exploring database schema...

Tables in database 'myapp':
- users (15,234 rows)
- orders (45,678 rows)
- products (1,234 rows)
- order_items (89,012 rows)

User: /explore-schema users

Claude: Schema for table 'users':

| Column     | Type         | Nullable | Default        |
|------------|--------------|----------|----------------|
| id         | serial       | NO       | nextval(...)   |
| name       | varchar(255) | NO       |                |
| email      | varchar(255) | NO       |                |
| created_at | timestamp    | NO       | now()          |

Primary Key: id
Indexes:
- users_email_key (UNIQUE) on email
- users_created_at_idx on created_at
```

## Notes

- Requires `POSTGRES_CONNECTION_STRING` environment variable
- Schema exploration is read-only and safe for production databases
