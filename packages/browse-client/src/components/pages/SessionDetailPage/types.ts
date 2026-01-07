/**
 * Shared types for session detail components
 */

/**
 * Content block from GraphQL - discriminated union based on type
 */
export interface ContentBlock {
  type: string | null | undefined;
  // ThinkingBlock fields
  thinking?: string | null;
  preview?: string | null;
  signature?: string | null;
  // TextBlock fields
  text?: string | null;
  // ToolUseBlock fields
  toolCallId?: string | null;
  name?: string | null;
  input?: string | null;
  category?: string | null;
  icon?: string | null;
  displayName?: string | null;
  color?: string | null;
  // ToolUseBlock nested result (fetched via GraphQL)
  result?: {
    toolCallId?: string | null;
    content?: string | null;
    isError?: boolean | null;
    isLong?: boolean | null;
    preview?: string | null;
    hasImage?: boolean | null;
  } | null;
  // ToolResultBlock fields
  content?: string | null;
  isError?: boolean | null;
  isLong?: boolean | null;
  hasImage?: boolean | null;
  // ImageBlock fields
  mediaType?: string | null;
  dataUrl?: string | null;
}

/**
 * Sentiment analysis data (nested on UserMessage)
 */
export interface SentimentAnalysis {
  sentimentScore: number;
  sentimentLevel: 'positive' | 'neutral' | 'negative';
  frustrationScore: number | null;
  frustrationLevel: 'low' | 'moderate' | 'high' | null;
  signals: readonly string[];
}

export interface Message {
  id: string;
  type: 'USER' | 'ASSISTANT' | 'SUMMARY';
  content: string | null;
  timestamp: string;
  isToolOnly: boolean;
  isToolResultOnly: boolean;
  rawJson: string | null;
  // Rich content blocks
  contentBlocks: readonly ContentBlock[] | null;
  // Message metadata
  isMeta: boolean | null;
  isInterrupt: boolean | null;
  isCommand: boolean | null;
  commandName: string | null;
  model: string | null;
  hasThinking: boolean | null;
  thinkingCount: number | null;
  hasToolUse: boolean | null;
  toolUseCount: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  // Han event fields
  hanEventType?: string | null;
  hanEventData?: string | null;
  // Nested sentiment analysis (UserMessage only)
  sentimentAnalysis?: SentimentAnalysis | null;
}

export interface HookExecution {
  id: string;
  hookType: string;
  hookName: string;
  hookSource: string | null;
  directory: string | null;
  durationMs: number;
  passed: boolean;
  output: string | null;
  error: string | null;
  timestamp: string;
}

export interface HookExecutionEdge {
  node: HookExecution;
  cursor: string;
}

export interface HookExecutionConnection {
  edges: HookExecutionEdge[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  totalCount: number;
}

export interface HookTypeStat {
  hookType: string;
  total: number;
  passed: number;
}

export interface HookStats {
  totalHooks: number;
  passedHooks: number;
  failedHooks: number;
  totalDurationMs: number;
  passRate: number;
  byHookType: HookTypeStat[];
}

export interface Task {
  id: string;
  taskId: string;
  description: string;
  type: 'IMPLEMENTATION' | 'FIX' | 'REFACTOR' | 'RESEARCH';
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  outcome: 'SUCCESS' | 'PARTIAL' | 'FAILURE' | null;
  confidence: number | null;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
}

export interface Session {
  id: string;
  sessionId: string;
  date: string;
  projectName: string;
  projectPath: string;
  worktreeName: string | null;
  summary: string | null;
  messageCount: number;
  startedAt: string | null;
  updatedAt: string | null;
  gitBranch: string | null;
  version: string | null;
  hookExecutions: HookExecutionConnection;
  hookStats: HookStats;
  tasks: Task[];
}

export interface SessionWithMessages extends Session {
  messages: Message[];
}
