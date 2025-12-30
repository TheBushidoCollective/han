/**
 * Rich Message Types for Claude Code JSONL Data
 *
 * These types represent the full structure of Claude Code conversation data,
 * enabling rich visualization of thinking blocks, tool usage, images, etc.
 */

// =============================================================================
// Content Block Types (inside message.content array)
// =============================================================================

/**
 * Thinking block - Claude's internal reasoning (extended thinking)
 */
export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

/**
 * Text block - Regular text response
 */
export interface TextBlock {
  type: 'text';
  text: string;
}

/**
 * Tool use block - Claude requesting to use a tool
 */
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result block - Result returned from a tool
 */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ToolResultContent[];
  is_error?: boolean;
}

/**
 * Tool result content can be text or image
 */
export interface ToolResultContent {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * Image block - Base64 encoded image
 */
export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * All possible content block types
 */
export type ContentBlock =
  | ThinkingBlock
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock
  | ImageBlock;

// =============================================================================
// Message Types
// =============================================================================

/**
 * User message content can be string or array of content blocks
 */
export type UserMessageContent = string | ContentBlock[];

/**
 * Assistant message content is always an array of content blocks
 */
export type AssistantMessageContent = ContentBlock[];

/**
 * Raw user message from JSONL
 */
export interface RawUserMessage {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: 'external' | 'internal';
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch?: string;
  type: 'user';
  message: {
    role: 'user';
    content: UserMessageContent;
  };
  isMeta?: boolean;
  uuid: string;
  timestamp: string;
  thinkingMetadata?: {
    level: string;
    disabled: boolean;
    triggers: string[];
  };
}

/**
 * Raw assistant message from JSONL
 */
export interface RawAssistantMessage {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: 'external' | 'internal';
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch?: string;
  message: {
    model: string;
    id: string;
    type: 'message';
    role: 'assistant';
    content: AssistantMessageContent;
    stop_reason?: string | null;
    stop_sequence?: string | null;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation?: {
        ephemeral_5m_input_tokens: number;
        ephemeral_1h_input_tokens: number;
      };
      service_tier?: string;
    };
  };
  requestId?: string;
  type: 'assistant';
  uuid: string;
  timestamp: string;
}

/**
 * Summary message type
 */
export interface RawSummaryMessage {
  type: 'summary';
  summary: string;
  uuid: string;
  timestamp: string;
}

/**
 * Union of all raw message types
 */
export type RawMessage =
  | RawUserMessage
  | RawAssistantMessage
  | RawSummaryMessage;

// =============================================================================
// Parsed/Enriched Types for Display
// =============================================================================

/**
 * Parsed content block with additional metadata for display
 */
export interface ParsedThinkingBlock extends ThinkingBlock {
  _parsed: true;
  preview: string; // First ~200 chars for collapsed view
}

export interface ParsedTextBlock extends TextBlock {
  _parsed: true;
}

export interface ParsedToolUseBlock extends ToolUseBlock {
  _parsed: true;
  toolCategory: 'file' | 'search' | 'shell' | 'web' | 'task' | 'mcp' | 'other';
  displayName: string;
  icon: string;
  color: string;
}

export interface ParsedToolResultBlock extends ToolResultBlock {
  _parsed: true;
  isLong: boolean;
  preview: string;
  hasImage: boolean;
}

export interface ParsedImageBlock extends ImageBlock {
  _parsed: true;
  previewUrl: string; // data: URL for display
}

export type ParsedContentBlock =
  | ParsedThinkingBlock
  | ParsedTextBlock
  | ParsedToolUseBlock
  | ParsedToolResultBlock
  | ParsedImageBlock;

/**
 * Enriched message with parsed content for display
 */
export interface EnrichedMessage {
  id: string;
  type: 'user' | 'assistant' | 'summary';
  timestamp: string;
  uuid: string;

  // User-specific fields
  isMeta?: boolean;
  isInterrupt?: boolean;
  isCommand?: boolean;
  commandName?: string;

  // Assistant-specific fields
  model?: string;
  hasThinking?: boolean;
  thinkingCount?: number;
  hasToolUse?: boolean;
  toolUseCount?: number;
  tokenUsage?: {
    input: number;
    output: number;
    cached?: number;
  };

  // Content blocks
  contentBlocks: ParsedContentBlock[];

  // Original text content (for fallback display)
  textContent: string;

  // Raw JSON for debugging
  rawJson: string;
}

// =============================================================================
// Tool Metadata
// =============================================================================

export const TOOL_CATEGORIES: Record<
  string,
  { category: string; icon: string; color: string; displayName: string }
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
    displayName: 'Notebook Edit',
    color: '#f0883e',
  },

  // Search operations
  Grep: {
    category: 'search',
    icon: '🔍',
    displayName: 'Search Content',
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

  // Shell operations
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

  // Web operations
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

  // Task operations
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

/**
 * Get tool metadata with fallback for unknown/MCP tools
 */
export function getToolMetadata(toolName: string): {
  category: string;
  icon: string;
  color: string;
  displayName: string;
} {
  if (TOOL_CATEGORIES[toolName]) {
    return TOOL_CATEGORIES[toolName];
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

  // Unknown tool
  return {
    category: 'other',
    icon: '🔧',
    displayName: toolName,
    color: '#8b949e',
  };
}
