---
name: search-code
description: Search for code across your GitLab instance
---

# Search GitLab Code

## Name

gitlab:search-code - Search for code across your GitLab instance

## Synopsis

```
/search-code [arguments]
```

## Description

Search for code across your GitLab instance

## Implementation

Search for code, files, or implementations across your GitLab instance using semantic or keyword search.

## Usage

```
/search-code [query]
```

This command helps you find relevant code across all accessible projects.

## What This Command Does

1. Accepts a natural language query or search term
2. Attempts semantic code search first (GitLab.com only)
3. Falls back to keyword search if semantic search unavailable
4. Returns relevant code snippets with:
   - File paths and line numbers
   - Context around matches
   - Project names and links
   - Relevance scores (for semantic search)

## Prerequisites

- GitLab MCP server must be installed and configured
- OAuth authentication must be completed
- For semantic search: GitLab.com account with GitLab Duo enabled

## Example Interaction

### Semantic Search (GitLab.com)

```
User: /search-code How is JWT token validation implemented?

Claude: Searching for JWT token validation implementations...

Found 4 relevant code snippets:

### 1. auth-service/src/middleware/validateToken.ts (Relevance: 95%)
```typescript
export function validateJWT(token: string): UserPayload {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded as UserPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid token');
  }
}
```

### 2. api-gateway/lib/security/jwt.ts (Relevance: 87%)

```typescript
async function verifyToken(req: Request): Promise<boolean> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return false;

  return await jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}
```

### 3. user-service/utils/auth.ts (Relevance: 82%)

```typescript
const validateAuthToken = (token: string) => {
  const payload = jwt.decode(token, { complete: true });
  return payload?.exp && payload.exp > Date.now() / 1000;
};
```

Would you like to see more results or explore any of these implementations?

```

### Keyword Search

```

User: /search-code authentication middleware

Claude: Searching for "authentication middleware"...

Found 7 results across 4 projects:

### Project: api-service

- src/middleware/auth.ts:15 - `export const authenticationMiddleware = async`
- src/middleware/auth.ts:42 - `// Authentication middleware for protected routes`

### Project: user-api

- lib/middleware/authenticate.ts:8 - `class AuthenticationMiddleware {`
- lib/middleware/authenticate.ts:23 - `// Main authentication check`

### Project: microservices-core

- shared/middleware/auth.ts:5 - `const authMiddleware = (req, res, next) => {`

Would you like to see the full context for any of these files?

```

## Arguments

- `query` (required): Natural language description or search keywords
  - For semantic search: "How do we handle user permissions?"
  - For keyword search: "redis cache implementation"

## Search Types

### Semantic Search (GitLab.com only)
Best for:
- Understanding how something works
- Finding implementations by concept
- Discovering related code
- Architectural questions

Examples:
- "How are database migrations handled?"
- "Where do we validate API requests?"
- "Show me error handling patterns"

### Keyword Search (All instances)
Best for:
- Finding specific function or class names
- Locating files by name
- Searching for exact text matches
- Finding configuration values

Examples:
- "validateUserInput function"
- "config.yml database"
- "TODO: fix memory leak"

## Tips

- Use natural language for semantic search
- Be specific with your queries
- Combine with other commands for deeper analysis
- Use quotes for exact phrase matching in keyword search
- Refine your query if results aren't relevant
- Check multiple projects for consistency
- Consider privacy when searching across all projects

## Advanced Usage

### Search with Scope

```

User: /search-code Find all test files that test authentication, scope:tests

Claude: Searching test files for authentication tests...

```

### Search in Specific Project

```

User: /search-code Redis caching implementation in project auth-service

Claude: Limiting search to auth-service project...

```

### Search by File Type

```

User: /search-code Database connection configuration in YAML files

Claude: Searching YAML files for database configuration...

```

## Related Commands

- `/view-issue`: View related issues after finding code
- `/create-issue`: Create issue for bugs found during search
- `/review-mr`: Review implementations found in search results
