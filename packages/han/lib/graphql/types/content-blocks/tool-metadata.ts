/**
 * Tool Metadata Helper
 *
 * Provides metadata for known tools including category, icon, display name, and color.
 */

const TOOL_METADATA: Record<
  string,
  { category: string; icon: string; displayName: string; color: string }
> = {
  // File operations
  Read: {
    category: 'file',
    icon: '📄',
    displayName: 'Read File',
    color: '#58a6ff',
  },
  Write: {
    category: 'file',
    icon: '✍️',
    displayName: 'Write File',
    color: '#f0883e',
  },
  Edit: {
    category: 'file',
    icon: '✏️',
    displayName: 'Edit File',
    color: '#a371f7',
  },
  NotebookEdit: {
    category: 'file',
    icon: '📓',
    displayName: 'Notebook',
    color: '#f0883e',
  },
  // Search
  Grep: {
    category: 'search',
    icon: '🔍',
    displayName: 'Search',
    color: '#79c0ff',
  },
  Glob: {
    category: 'search',
    icon: '📁',
    displayName: 'Find Files',
    color: '#79c0ff',
  },
  LSP: {
    category: 'search',
    icon: '🔗',
    displayName: 'Code Intel',
    color: '#a371f7',
  },
  // Shell
  Bash: {
    category: 'shell',
    icon: '💻',
    displayName: 'Shell',
    color: '#7ee787',
  },
  KillShell: {
    category: 'shell',
    icon: '⏹️',
    displayName: 'Kill Shell',
    color: '#f85149',
  },
  // Web
  WebFetch: {
    category: 'web',
    icon: '🌐',
    displayName: 'Web Fetch',
    color: '#58a6ff',
  },
  WebSearch: {
    category: 'web',
    icon: '🔎',
    displayName: 'Web Search',
    color: '#58a6ff',
  },
  // Task
  Task: {
    category: 'task',
    icon: '🤖',
    displayName: 'Subagent',
    color: '#d29922',
  },
  TaskOutput: {
    category: 'task',
    icon: '📤',
    displayName: 'Task Output',
    color: '#d29922',
  },
  TodoWrite: {
    category: 'task',
    icon: '✏️',
    displayName: 'Todo List',
    color: '#22c55e',
  },
  Skill: {
    category: 'task',
    icon: '⚡',
    displayName: 'Skill',
    color: '#d29922',
  },
  // Other
  AskUserQuestion: {
    category: 'other',
    icon: '❓',
    displayName: 'Question',
    color: '#f778ba',
  },
  EnterPlanMode: {
    category: 'other',
    icon: '📝',
    displayName: 'Plan Mode',
    color: '#a371f7',
  },
  ExitPlanMode: {
    category: 'other',
    icon: '✅',
    displayName: 'Exit Plan',
    color: '#22c55e',
  },
};

export function getToolMetadata(toolName: string): {
  category: string;
  icon: string;
  displayName: string;
  color: string;
} {
  if (TOOL_METADATA[toolName]) {
    return TOOL_METADATA[toolName];
  }
  // MCP tools
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    const serverName = parts[1] || 'mcp';
    return {
      category: 'mcp',
      icon: '🔌',
      displayName: `MCP: ${serverName}`,
      color: '#8b949e',
    };
  }
  return {
    category: 'other',
    icon: '🔧',
    displayName: toolName,
    color: '#8b949e',
  };
}
