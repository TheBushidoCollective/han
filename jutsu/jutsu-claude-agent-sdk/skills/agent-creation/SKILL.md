---
name: claude-agent-sdk-agent-creation
description: Use when creating or configuring Claude AI agents using the Agent SDK. Covers agent initialization, configuration, and basic setup patterns.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Claude Agent SDK - Agent Creation

Creating and configuring AI agents using the Claude Agent SDK with TypeScript.

## Core Agent Initialization

### Basic Agent Creation

```typescript
import { Agent } from '@anthropic-ai/claude-agent-sdk';

const agent = new Agent({
  model: 'claude-3-5-sonnet-20241022',  // Latest model
  systemPrompt: 'You are a helpful assistant specialized in...',
  settingSources: ['project'],  // Load .claude/CLAUDE.md from project
  allowedTools: ['read_file', 'write_file', 'list_files'],
});
```

## Configuration Options

### System Prompts

```typescript
// Direct system prompt
const agent = new Agent({
  systemPrompt: 'You are an expert code reviewer...',
});

// Load from CLAUDE.md
const agent = new Agent({
  settingSources: ['project'],  // Loads ./.claude/CLAUDE.md
});

// User-level memory
const agent = new Agent({
  settingSources: ['user'],  // Loads ~/.claude/CLAUDE.md
});
```

### Tool Permissions

```typescript
// Allow specific tools
const agent = new Agent({
  allowedTools: [
    'read_file',
    'write_file',
    'list_files',
    'grep',
    'bash',
  ],
});

// Block specific tools
const agent = new Agent({
  disallowedTools: ['bash', 'web_search'],
});

// Permission modes
const agent = new Agent({
  permissionMode: 'strict',  // Require explicit approval
});
```

## Agent Directory Structure

### Required Structure

```
project/
├── .claude/
│   ├── CLAUDE.md              # Project memory
│   ├── agents/
│   │   └── specialist.md      # Subagent definitions
│   ├── skills/
│   │   └── my-skill/
│   │       └── SKILL.md       # Skill definitions
│   └── commands/
│       └── my-command.md      # Slash commands
└── src/
    └── index.ts               # Your code
```

## Authentication

### Environment Variables

```bash
# Anthropic API (primary)
export ANTHROPIC_API_KEY="sk-ant-..."

# Alternative providers
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-east-1"

# Google Vertex AI
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"

# Azure
export AZURE_OPENAI_API_KEY="..."
export AZURE_OPENAI_ENDPOINT="..."
```

### SDK Configuration

```typescript
// Anthropic direct
const agent = new Agent({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Amazon Bedrock
const agent = new Agent({
  provider: 'bedrock',
  model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
});
```

## Best Practices

### Always Specify Model

```typescript
// Good
const agent = new Agent({
  model: 'claude-3-5-sonnet-20241022',
});

// Avoid: relying on default model
const agent = new Agent({});
```

### Use Explicit Setting Sources

```typescript
// Good
const agent = new Agent({
  settingSources: ['project'],
});

// Avoid: unclear memory source
const agent = new Agent({
  systemPrompt: '...',
});
```

### Separate Project and User Memory

```typescript
// Project-specific context
const projectAgent = new Agent({
  settingSources: ['project'],
});

// User preferences
const userAgent = new Agent({
  settingSources: ['user'],
});
```

## Anti-Patterns

### Don't Hardcode API Keys

```typescript
// Bad
const agent = new Agent({
  apiKey: 'sk-ant-hardcoded-key',
});

// Good
const agent = new Agent({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

### Don't Mix Conflicting Permissions

```typescript
// Bad: contradictory permissions
const agent = new Agent({
  allowedTools: ['read_file', 'write_file'],
  disallowedTools: ['read_file'],  // Conflict!
});

// Good: clear permissions
const agent = new Agent({
  allowedTools: ['read_file'],
});
```

## Related Skills

- **tool-integration**: Working with tools and MCP servers
- **context-management**: Managing agent context and memory
