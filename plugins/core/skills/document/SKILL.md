---
name: document
description: Generate or update documentation for code, APIs, or systems
disable-model-invocation: false
---

# document

## Name

han-core:document - Generate or update documentation for code, APIs, or systems

## Synopsis

```
/document [arguments]
```

## Description

Generate or update documentation for code, APIs, or systems

## Implementation

Create or update documentation including README files, API docs, inline comments, or technical guides.

## Process

Use the documentation skill from bushido to:

1. **Understand audience**: Who will read this? What do they need?
2. **Gather information**: Code, APIs, system behavior to document
3. **Structure content**: Organize logically for readers
4. **Write clearly**: Plain language, concrete examples
5. **Add examples**: Show, don't just tell
6. **Review completeness**: Does it answer key questions?
7. **Keep updated**: Documentation rots, plan for maintenance

## Documentation Types

### README

- What the project does
- How to install/setup
- How to use (common tasks)
- How to contribute
- Where to get help

### API Documentation

- Endpoint/function signature
- Parameters and types
- Return values
- Error cases
- Usage examples
- Authentication/authorization

### Inline Comments

- Why (not what) the code does
- Non-obvious decisions
- Edge cases handled
- Warnings or gotchas

### Technical Guides

- How-to guides for specific tasks
- Architecture overviews
- Integration guides
- Troubleshooting guides

### ADRs (Architecture Decision Records)

- Context for decisions
- Alternatives considered
- Trade-offs accepted

## Documentation Principles

**Good documentation:**

- **For the reader**: Written for their level and needs
- **Clear**: No jargon unless necessary
- **Concrete**: Examples over abstract descriptions
- **Complete**: Answers the key questions
- **Maintained**: Updated when code changes

**Bad documentation:**

- Explains "what" instead of "why"
- Assumes too much knowledge
- No examples
- Out of date
- Too verbose or too terse

## README Template

```markdown
# Project Name

Brief description of what this project does and why it exists.

## Installation

```bash
npm install project-name
# or
yarn add project-name
```

## Quick Start

```javascript
import { Thing } from 'project-name'

const thing = new Thing()
thing.doSomething()
```

## Usage

### Basic Usage

[Most common use case with example]

### Advanced Usage

[More complex scenarios]

## API Reference

### `functionName(param1, param2)`

Description of what the function does.

**Parameters:**

- `param1` (string): Description
- `param2` (number, optional): Description

**Returns:** Description of return value

**Example:**

```javascript
const result = functionName('hello', 42)
```

## Configuration

[How to configure, if applicable]

## Troubleshooting

### Common Issue 1

**Problem:** [Description]
**Solution:** [How to fix]

## Contributing

[How to contribute to the project]

## License

[License information]

```

## API Documentation Template

```markdown
## `POST /api/users`

Create a new user.

### Request

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <token>"
}
```

**Body:**

```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user"
}
```

### Response

**Success (201 Created):**

```json
{
  "id": "123",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Error (400 Bad Request):**

```json
{
  "error": "Invalid email format"
}
```

**Error (401 Unauthorized):**

```json
{
  "error": "Authentication required"
}
```

### Example

```bash
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer abc123" \
  -d '{"email": "user@example.com", "name": "John Doe"}'
```

```

## Inline Comment Guidelines

```typescript
// ❌ BAD: Explains what (obvious)
// Loop through users
for (const user of users) {
  // ...
}

// ✅ GOOD: Explains why (non-obvious)
// Process users in creation order to maintain referential integrity
for (const user of users.sort((a, b) => a.createdAt - b.createdAt)) {
  // ...
}

// ❌ BAD: Redundant
function calculateTotal(items: Item[]): number {
  // Calculate total
  return items.reduce((sum, item) => sum + item.price, 0)
}

// ✅ GOOD: Explains non-obvious decision
function calculateTotal(items: Item[]): number {
  // Use reduce instead of sum to preserve precision with Money type
  return items.reduce((sum, item) => sum + item.price, 0)
}

// ✅ GOOD: Document edge cases
function parseDate(input: string): Date {
  // Note: Returns current date if input is invalid
  // This matches legacy API behavior that clients depend on
  try {
    return new Date(input)
  } catch {
    return new Date()
  }
}
```

## Examples

When the user says:

- "Write a README for this project"
- "Document this API endpoint"
- "Add comments explaining this complex function"
- "Create a guide for setting up the development environment"
- "Update the docs to reflect the new authentication flow"

## Documentation Checklist

### For README

- [ ] What the project does
- [ ] Installation instructions
- [ ] Quick start example
- [ ] Common use cases
- [ ] Link to full documentation
- [ ] How to contribute
- [ ] License information

### For API Docs

- [ ] Endpoint/function signature
- [ ] All parameters documented
- [ ] Return values documented
- [ ] Error cases documented
- [ ] Authentication requirements
- [ ] Example requests/responses
- [ ] Rate limiting (if applicable)

### For Inline Comments

- [ ] Explains *why*, not *what*
- [ ] Documents non-obvious decisions
- [ ] Notes edge cases handled
- [ ] Warns about gotchas
- [ ] References related code/docs
- [ ] No redundant comments

## Notes

- Use TodoWrite to track documentation tasks
- Use explainer skill for creating clear explanations
- Keep documentation close to code (inline comments, co-located READMEs)
- Update docs when code changes (include in PR reviews)
- Examples are worth a thousand words
- Test examples to ensure they work
- Consider using JSDoc/TSDoc for inline API documentation
