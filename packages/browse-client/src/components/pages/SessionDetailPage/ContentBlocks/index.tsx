/**
 * Content Blocks Index
 *
 * Exports all content block components for rich message rendering.
 */

export { ImageBlock } from "./ImageBlock.tsx";
export { TextBlock } from "./TextBlock.tsx";
export { ThinkingBlock } from "./ThinkingBlock.tsx";
export { ToolResultBlock } from "./ToolResultBlock.tsx";
export { ToolUseBlock } from "./ToolUseBlock.tsx";

/**
 * Content block type from GraphQL
 */
export type ContentBlockType =
	| "THINKING"
	| "TEXT"
	| "TOOL_USE"
	| "TOOL_RESULT"
	| "IMAGE";

/**
 * Content block data from GraphQL (discriminated union)
 */
export interface ThinkingBlockData {
	readonly type: "THINKING";
	readonly thinking: string;
	readonly preview: string;
	readonly signature: string | null;
}

export interface TextBlockData {
	readonly type: "TEXT";
	readonly text: string;
}

export interface ToolUseBlockData {
	readonly type: "TOOL_USE";
	readonly toolCallId: string;
	readonly name: string;
	readonly input: string;
	readonly category:
		| "FILE"
		| "SEARCH"
		| "SHELL"
		| "WEB"
		| "TASK"
		| "MCP"
		| "OTHER";
	readonly icon: string;
	readonly displayName: string;
	readonly color: string;
}

export interface ToolResultBlockData {
	readonly type: "TOOL_RESULT";
	readonly toolCallId: string;
	readonly content: string;
	readonly isError: boolean;
	readonly isLong: boolean;
	readonly preview: string;
	readonly hasImage: boolean;
}

export interface ImageBlockData {
	readonly type: "IMAGE";
	readonly mediaType: string;
	readonly dataUrl: string;
}

export type ContentBlockData =
	| ThinkingBlockData
	| TextBlockData
	| ToolUseBlockData
	| ToolResultBlockData
	| ImageBlockData;
