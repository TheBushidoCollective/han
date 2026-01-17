# GraphQL Layer: One Type Per File

## Rule

Each file in the GraphQL types layer (`packages/han/lib/graphql/types/`) must contain exactly **one primary type definition**:

- `builder.objectType()` - Object types
- `builder.enumType()` - Enum types
- `builder.inputType()` - Input types
- `builder.scalarType()` - Scalar types
- `builder.unionType()` - Union types
- `builder.interfaceType()` - Interface types

## File Naming Convention

Files should be named after the type they contain:
- `session.ts` → `SessionType`
- `session-status-enum.ts` → `SessionStatusEnum`
- `message-interface.ts` → `MessageInterface`

## Exceptions

1. **Edge and Connection types** for Relay pagination may be co-located with their node type
2. **Helper functions** specific to a single type may live in the same file
3. **TypeScript interfaces** for resolver arguments are allowed alongside their type

## Why This Matters

- Improves code navigation and discoverability
- Reduces merge conflicts
- Makes dependencies explicit
- Enables better code splitting
- Follows single responsibility principle

## Refactoring Guide

When splitting a file with multiple types:

1. Create new files for each type (e.g., `types/enums/session-status.ts`)
2. Move the type definition and its resolvers
3. Update imports in the original file
4. Update `schema.ts` if needed
5. Run `bun run typecheck` to verify
