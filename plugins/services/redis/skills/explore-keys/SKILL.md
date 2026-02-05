---
description: Explore Redis keys and their values
---

# Explore Redis Keys

## Name

redis:explore-keys - Explore Redis keys and their values

## Synopsis

```
/explore-keys [pattern]
```

## Description

Explore Redis keys matching an optional pattern. Lists keys, their types, and TTL information. Use patterns like `user:*` or `session:*` to filter results.

## Arguments

- `pattern` - Optional glob pattern to filter keys (default: `*`)

## Implementation

1. Connect to Redis using the configured URL
2. List keys matching the pattern (SCAN operation)
3. For each key, show type and TTL
4. Optionally preview values for small keys
5. Handle large datasets with pagination

## Example Interaction

```
User: /explore-keys session:*

Claude: Exploring keys matching 'session:*'...

Found 5 keys:

| Key                    | Type   | TTL      | Size  |
|------------------------|--------|----------|-------|
| session:abc123         | hash   | 3600s    | 245B  |
| session:def456         | hash   | 1800s    | 312B  |
| session:ghi789         | hash   | 7200s    | 198B  |
| session:jkl012         | string | -1 (none)| 64B   |
| session:mno345         | hash   | 900s     | 287B  |

Total memory: 1.1KB
```

## Notes

- Requires `REDIS_URL` environment variable
- Uses SCAN for large keyspaces (production-safe)
- Pattern uses Redis glob syntax (* matches any, ? matches single char)
