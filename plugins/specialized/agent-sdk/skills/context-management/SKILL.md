---
name: claude-agent-sdk-context-management
description: Use when managing agent context, memory, and conversation state in Claude AI agents using the Agent SDK.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Claude Agent SDK - Context Management

Managing agent memory, context, and conversation state in the Claude Agent SDK.

## Setting Sources

### Project Memory

```typescript
import { Agent } from '@anthropic-ai/claude-agent-sdk';

// Load project-specific context from .claude/CLAUDE.md
const agent = new Agent({
  settingSources: ['project'],
});
```

### User Memory

```typescript
// Load user preferences from ~/.claude/CLAUDE.md
const agent = new Agent({
  settingSources: ['user'],
});
```

### Combined Sources

```typescript
// Load both user and project settings
const agent = new Agent({
  settingSources: ['user', 'project'],
});
```

## CLAUDE.md Files

### Project Context (.claude/CLAUDE.md)

```markdown
# Project Context

This is a TypeScript web application using React and Next.js.

## Code Style

- Use functional components
- Prefer hooks over class components
- Use TypeScript strict mode

## Architecture

- API routes in /pages/api
- Components in /components
- Utilities in /lib
```

### User Preferences (~/.claude/CLAUDE.md)

```markdown
# User Preferences

## Communication Style

- Be concise
- Show code examples
- Explain reasoning

## Development Environment

- Primary editor: VS Code
- Node version: 20.x
- Package manager: pnpm
```

## System Prompts

### Direct System Prompt

```typescript
const agent = new Agent({
  systemPrompt: `You are an expert TypeScript developer.

  Follow these guidelines:
  - Use strict type checking
  - Prefer immutability
  - Write comprehensive tests`,
});
```

### Dynamic System Prompt

```typescript
const projectType = detectProjectType();

const agent = new Agent({
  systemPrompt: `You are a ${projectType} specialist.

  Current project: ${process.cwd()}
  Node version: ${process.version}`,
});
```

## Conversation State

### Single-Turn Conversations

```typescript
const agent = new Agent({
  settingSources: ['project'],
});

const response = await agent.chat('What is this project about?');
console.log(response);
```

### Multi-Turn Conversations

```typescript
const agent = new Agent({
  settingSources: ['project'],
});

// First turn
const response1 = await agent.chat('List all API endpoints');

// Second turn - agent remembers previous context
const response2 = await agent.chat('Add authentication to the login endpoint');

// Third turn
const response3 = await agent.chat('Write tests for the changes you just made');
```

### Conversation History

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const conversation = query({
  prompt: 'Help me refactor this code',
  options: {
    settingSources: ['project'],
  },
});

// Access conversation history
for await (const message of conversation) {
  console.log('Role:', message.role);
  console.log('Content:', message.content);
}
```

## Context Limits

### Managing Context Size

```typescript
const agent = new Agent({
  model: 'claude-3-5-sonnet-20241022',
  systemPrompt: 'You are a code reviewer',
  // Agent automatically manages context window
});

// For very large files, chunk the content
const largeFile = await readFile('huge-file.ts');
const chunks = chunkContent(largeFile, 10000);

for (const chunk of chunks) {
  await agent.chat(`Review this section:\n\n${chunk}`);
}
```

### Context Summarization

```typescript
// Agent can summarize previous context to fit window
const agent = new Agent({
  settingSources: ['project'],
});

// Long conversation
await agent.chat('Explain the authentication system');
await agent.chat('How does session management work?');
await agent.chat('What about password hashing?');

// Agent maintains relevant context automatically
await agent.chat('Update the login endpoint to use bcrypt');
```

## Memory Persistence

### Storing Conversation State

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const conversationFile = './conversation-state.json';

// Load previous conversation
let messages = [];
if (existsSync(conversationFile)) {
  messages = JSON.parse(readFileSync(conversationFile, 'utf8'));
}

const conversation = query({
  prompt: 'Continue where we left off',
  options: {
    settingSources: ['project'],
    // Pass previous messages if API supports it
  },
});

// Save conversation state
const newMessages = [];
for await (const message of conversation) {
  newMessages.push(message);
}

writeFileSync(
  conversationFile,
  JSON.stringify([...messages, ...newMessages], null, 2),
);
```

## Best Practices

### Separate Project and User Context

```typescript
// Good: Clear separation
const agent = new Agent({
  settingSources: ['user', 'project'],
  systemPrompt: `Additional task-specific context`,
});

// Avoid: Mixing contexts in system prompt
const agent = new Agent({
  systemPrompt: `
    User preference: Be concise
    Project: TypeScript + React
    Task: Review code
  `, // Hard to maintain
});
```

### Keep CLAUDE.md Files Focused

```markdown
<!-- Good: Focused project context -->

# Project Context

## Technology Stack

- Next.js 14
- TypeScript 5
- Tailwind CSS

## Key Conventions

- Use server components by default
- Client components only when needed
- API routes follow REST conventions
```

```markdown
<!-- Avoid: Too much detail -->

# Project Context

## Technology Stack

- Next.js 14.2.3
- TypeScript 5.4.2
- Tailwind CSS 3.4.1
- ...50 more dependencies

## Every Single File

- src/app/page.tsx: Homepage
- src/app/about/page.tsx: About page
- ...200 more files
```

### Update Context as Project Evolves

```bash
# Update .claude/CLAUDE.md when architecture changes
echo "## New Features\n- Added GraphQL API\n- Migrated to PostgreSQL" >> .claude/CLAUDE.md
```

## Anti-Patterns

### Don't Duplicate Context

```typescript
// Bad: Duplicating project info in system prompt
const agent = new Agent({
  settingSources: ['project'], // Already loads .claude/CLAUDE.md
  systemPrompt: `This is a React app using TypeScript`, // Redundant
});

// Good: Let settingSources handle it
const agent = new Agent({
  settingSources: ['project'],
  systemPrompt: `Additional task-specific guidance`,
});
```

### Don't Hardcode Paths

```typescript
// Bad: Hardcoded paths
const agent = new Agent({
  systemPrompt: `Project location: /Users/me/projects/myapp`,
});

// Good: Use relative or dynamic paths
const agent = new Agent({
  systemPrompt: `Project root: ${process.cwd()}`,
});
```

### Don't Store Secrets in CLAUDE.md

```markdown
<!-- Bad: Secrets in context -->

# Project Context

Database: postgresql://user:password@localhost/db
API Key: sk-secret-key-here
```

```markdown
<!-- Good: Reference environment -->

# Project Context

Database: Configured via DATABASE_URL env var
API Key: Set OPENAI_API_KEY environment variable
```

## Advanced Patterns

### Context Injection

```typescript
const agent = new Agent({
  settingSources: ['project'],
  systemPrompt: `
    Current branch: ${execSync('git branch --show-current').toString().trim()}
    Uncommitted changes: ${execSync('git status --short').toString()}
  `,
});
```

### Role-Based Context

```typescript
function createSpecializedAgent(role: 'reviewer' | 'implementer' | 'tester') {
  const rolePrompts = {
    reviewer: 'Focus on code quality and best practices',
    implementer: 'Write production-ready code',
    tester: 'Create comprehensive test coverage',
  };

  return new Agent({
    settingSources: ['project'],
    systemPrompt: rolePrompts[role],
  });
}

const reviewer = createSpecializedAgent('reviewer');
const implementer = createSpecializedAgent('implementer');
```

## Related Skills

- **agent-creation**: Agent initialization and configuration
- **tool-integration**: Working with tools and MCP servers
