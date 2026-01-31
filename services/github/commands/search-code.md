---
description: Search for code across GitHub repositories
---

# Search GitHub Code

## Name

hashi-github:search-code - Search for code across GitHub repositories

## Synopsis

```
/search-code [arguments]
```

## Description

Search for code across GitHub repositories

## Implementation

Search for code, files, or implementations across GitHub repositories.

## Usage

```
/search-code [query]
```

This command helps you find relevant code across repositories.

## What This Command Does

1. Accepts a search query (keywords or GitHub search syntax)
2. Searches across accessible repositories using `search_code`
3. Returns relevant code snippets with:
   - File paths and line numbers
   - Repository names
   - Code context around matches
   - Links to view full files

## Prerequisites

- GitHub MCP server must be installed and configured
- OAuth authentication must be completed

## Example Interaction

```
User: /search-code JWT token validation

Claude: Searching for "JWT token validation"...

Found 4 relevant code snippets:

### 1. my-org/auth-service - src/middleware/validateToken.ts
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

### 2. my-org/api-gateway - lib/security/jwt.ts

```typescript
async function verifyToken(req: Request): Promise<boolean> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return false;
  return await jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}
```

Would you like to see more results or explore any of these files?

```

## Search Syntax

GitHub code search supports advanced syntax:

- **Exact phrase**: `"function authenticate"`
- **File type**: `language:typescript`
- **Path filter**: `path:src/auth`
- **Repository**: `repo:owner/repo-name`
- **Organization**: `org:my-org`
- **Extension**: `extension:ts`

### Examples

```

## Find all TypeScript files with "authenticate"

authenticate language:typescript

## Search in specific path

validate path:src/middleware

## Search specific repository

JWT repo:my-org/auth-service

## Combine filters

async function org:my-org language:javascript

```

## Tips

- Use specific keywords for better results
- Filter by language to reduce noise
- Search across an organization with `org:`
- Combine with path filters to narrow scope
- Use quotes for exact phrases
- Review multiple implementations for patterns

## Related Commands

- `/review-pr`: Review PRs that modify found code
- `/create-issue`: File issues for problems found
- `/create-pr`: Create PR to fix or improve code
