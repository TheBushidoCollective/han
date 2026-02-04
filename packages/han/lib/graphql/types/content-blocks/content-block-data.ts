/**
 * Content Block Data Interfaces
 *
 * TypeScript interfaces for content block types.
 */

export interface ThinkingBlockData {
  type: 'THINKING';
  thinking: string;
  preview: string;
  signature?: string;
}

export interface TextBlockData {
  type: 'TEXT';
  text: string;
}

export interface ToolUseBlockData {
  type: 'TOOL_USE';
  toolCallId: string;
  name: string;
  input: string; // JSON stringified
  category: string;
  icon: string;
  displayName: string;
  color: string;
  /** Session ID for resolving the result via DataLoader */
  sessionId?: string;
  /** For Task tool calls, the ID of the spawned agent task */
  agentTaskId?: string;
}

export interface ToolResultBlockData {
  type: 'TOOL_RESULT';
  toolCallId: string;
  content: string;
  isError: boolean;
  isLong: boolean;
  preview: string;
  hasImage: boolean;
}

export interface ImageBlockData {
  type: 'IMAGE';
  mediaType: string;
  dataUrl: string;
}

export type ContentBlockData =
  | ThinkingBlockData
  | TextBlockData
  | ToolUseBlockData
  | ToolResultBlockData
  | ImageBlockData;
