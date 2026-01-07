# Database Query Patterns

## Rule: Never Load Full Tables into Memory

When implementing search or filter functionality:

1. **Always use SQL** for searching/filtering - never load entire tables into JS/TS
2. **Use FTS (Full-Text Search)** when available - han-native provides `searchMessages()` via FTS5
3. **Push filtering to the database** - SQL is optimized for this, JS is not
4. **Paginate at the database level** - use LIMIT/OFFSET in SQL, not array slicing in JS

## Available Database Search Functions

```typescript
import { searchMessages } from "../../db/index.ts";

// FTS search with optional session filtering
const results = await searchMessages({
  query: "search term",
  sessionId: "optional-session-id", 
  limit: 20
});
```

## Anti-pattern (DON'T DO THIS)

```typescript
// BAD: Loading all messages then filtering in JS
const allMessages = await context.loaders.sessionMessagesLoader.load(sessionId);
const filtered = allMessages.filter(msg => msg.content.includes(query));
```

## Correct Pattern

```typescript
// GOOD: Let the database do the filtering
const results = await searchMessages({ query, sessionId, limit });
```
