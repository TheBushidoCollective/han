---
description: Query documents from MongoDB collections
---

# Query MongoDB Collection

## Name

mongodb:query-collection - Query documents from MongoDB collections

## Synopsis

```
/query-collection <collection> [filter]
```

## Description

Query documents from a MongoDB collection using optional filter criteria. Supports MongoDB query syntax for filtering, projection, and sorting.

## Arguments

- `collection` - The collection name to query (required)
- `filter` - Optional JSON filter object

## Implementation

1. Connect to MongoDB using the configured connection string
2. Execute the find query on the specified collection
3. Apply any provided filters
4. Return matching documents in formatted output
5. Handle errors gracefully with helpful messages

## Example Interaction

```
User: /query-collection users {"status": "active"}

Claude: Querying collection 'users' with filter {"status": "active"}...

Found 3 documents:

{
  "_id": "64a1b2c3d4e5f6g7h8i9j0k1",
  "name": "Alice",
  "email": "alice@example.com",
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z"
}

{
  "_id": "64a1b2c3d4e5f6g7h8i9j0k2",
  "name": "Bob",
  "email": "bob@example.com",
  "status": "active",
  "createdAt": "2024-01-16T14:22:00Z"
}

...
```

## Notes

- Requires `MONGODB_URI` environment variable
- Large result sets may be limited
- Use projection to limit returned fields for large documents
