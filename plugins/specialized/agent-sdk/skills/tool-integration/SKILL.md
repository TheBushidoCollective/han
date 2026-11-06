---
name: claude-agent-sdk-tool-integration
description: Use when integrating tools, permissions, and MCP servers with Claude AI agents using the Agent SDK.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Claude Agent SDK - Tool Integration

Working with tools, permissions, and MCP (Model Context Protocol) servers in the Claude Agent SDK.

## Tool Permissions

### Allowing Specific Tools

```typescript
import { Agent } from '@anthropic-ai/claude-agent-sdk';

const agent = new Agent({
  allowedTools: [
    'read_file',
    'write_file',
    'list_files',
    'grep',
    'bash',
  ],
});
```

### Blocking Tools

```typescript
const agent = new Agent({
  disallowedTools: ['bash', 'web_search'],
});
```

### Permission Modes

```typescript
// Strict mode - requires explicit user approval
const agent = new Agent({
  permissionMode: 'strict',
});

// Permissive mode - auto-approves known safe operations
const agent = new Agent({
  permissionMode: 'permissive',
});
```

## Custom Tools

### Defining Custom Tools

```typescript
import { Agent, Tool } from '@anthropic-ai/claude-agent-sdk';

const customTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  input_schema: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name',
      },
    },
    required: ['location'],
  },
  execute: async (input) => {
    const { location } = input;
    // Call weather API
    return {
      location,
      temperature: 72,
      conditions: 'sunny',
    };
  },
};

const agent = new Agent({
  tools: [customTool],
});
```

### Tool Execution Context

```typescript
const customTool: Tool = {
  name: 'read_database',
  description: 'Query the database',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  },
  execute: async (input, context) => {
    // Context provides agent state and utilities
    console.log('Agent model:', context.model);

    const result = await runQuery(input.query);
    return result;
  },
};
```

## MCP Server Integration

### Adding MCP Servers

```typescript
const agent = new Agent({
  mcpServers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed'],
    },
    git: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git'],
    },
  },
});
```

### Using MCP Resources

```typescript
// Agent automatically has access to MCP server resources
const agent = new Agent({
  mcpServers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', './data'],
    },
  },
});

// Agent can now read files via MCP
await agent.chat('Read the contents of data/config.json');
```

### MCP Server Configuration

```typescript
const agent = new Agent({
  mcpServers: {
    database: {
      command: 'node',
      args: ['./mcp-servers/database.js'],
      env: {
        DATABASE_URL: process.env.DATABASE_URL,
      },
    },
  },
});
```

## Tool Response Handling

### Streaming Tool Responses

```typescript
const response = await agent.chat('List all files in src/');

for await (const chunk of response) {
  if (chunk.type === 'tool_use') {
    console.log('Tool called:', chunk.name);
  }
  if (chunk.type === 'tool_result') {
    console.log('Tool result:', chunk.content);
  }
}
```

### Error Handling

```typescript
const customTool: Tool = {
  name: 'risky_operation',
  description: 'Perform risky operation',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string' },
    },
    required: ['action'],
  },
  execute: async (input) => {
    try {
      const result = await performOperation(input.action);
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
```

## Best Practices

### Principle of Least Privilege

```typescript
// Good: Only allow necessary tools
const agent = new Agent({
  allowedTools: ['read_file', 'list_files'],
});

// Avoid: Allowing all tools unnecessarily
const agent = new Agent({
  allowedTools: ['*'],
});
```

### Tool Input Validation

```typescript
const customTool: Tool = {
  name: 'delete_file',
  description: 'Delete a file',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
    },
    required: ['path'],
  },
  execute: async (input) => {
    // Validate input
    if (!input.path || input.path.includes('..')) {
      throw new Error('Invalid file path');
    }

    // Prevent deleting critical files
    if (input.path.startsWith('/etc') || input.path.startsWith('/sys')) {
      throw new Error('Cannot delete system files');
    }

    await deleteFile(input.path);
    return { deleted: input.path };
  },
};
```

### MCP Server Sandboxing

```typescript
// Good: Restrict filesystem access to specific directory
const agent = new Agent({
  mcpServers: {
    filesystem: {
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        './workspace', // Sandboxed to workspace only
      ],
    },
  },
});
```

## Anti-Patterns

### Don't Allow Unrestricted Bash

```typescript
// Bad: Unrestricted bash access
const agent = new Agent({
  allowedTools: ['bash'],
});

// Better: Use specific tools instead
const agent = new Agent({
  allowedTools: ['read_file', 'write_file', 'list_files'],
});
```

### Don't Ignore Tool Errors

```typescript
// Bad: Silent failure
const customTool: Tool = {
  execute: async (input) => {
    try {
      return await riskyOperation(input);
    } catch {
      return null; // Silent failure
    }
  },
};

// Good: Explicit error handling
const customTool: Tool = {
  execute: async (input) => {
    try {
      return await riskyOperation(input);
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Operation failed',
      };
    }
  },
};
```

## Related Skills

- **agent-creation**: Agent initialization and configuration
- **context-management**: Managing agent context and memory
