/**
 * GraphQL Content Block Types
 *
 * Represents the rich content structure of Claude Code messages,
 * including thinking blocks, text, tool usage, and images.
 */

import { builder } from "../builder.ts";

// =============================================================================
// Content Block Type Enum
// =============================================================================

export const ContentBlockTypeEnum = builder.enumType("ContentBlockType", {
	values: ["THINKING", "TEXT", "TOOL_USE", "TOOL_RESULT", "IMAGE"] as const,
	description: "Type of content block in a message",
});

// =============================================================================
// Tool Category Enum
// =============================================================================

export const ToolCategoryEnum = builder.enumType("ToolCategory", {
	values: ["FILE", "SEARCH", "SHELL", "WEB", "TASK", "MCP", "OTHER"] as const,
	description: "Category of tool",
});

// =============================================================================
// Content Block Types Data (defined before interface for type reference)
// =============================================================================

export interface ThinkingBlockData {
	type: "THINKING";
	thinking: string;
	preview: string;
	signature?: string;
}

export interface TextBlockData {
	type: "TEXT";
	text: string;
}

export interface ToolUseBlockData {
	type: "TOOL_USE";
	toolCallId: string;
	name: string;
	input: string; // JSON stringified
	category: string;
	icon: string;
	displayName: string;
	color: string;
}

export interface ToolResultBlockData {
	type: "TOOL_RESULT";
	toolCallId: string;
	content: string;
	isError: boolean;
	isLong: boolean;
	preview: string;
	hasImage: boolean;
}

export interface ImageBlockData {
	type: "IMAGE";
	mediaType: string;
	dataUrl: string;
}

export type ContentBlockData =
	| ThinkingBlockData
	| TextBlockData
	| ToolUseBlockData
	| ToolResultBlockData
	| ImageBlockData;

// =============================================================================
// Content Block Interface
// =============================================================================

/**
 * Base interface for all content blocks
 */
export const ContentBlockInterface = builder
	.interfaceRef<ContentBlockData>("ContentBlock")
	.implement({
		description: "A content block within a message",
		fields: (t) => ({
			type: t.field({
				type: ContentBlockTypeEnum,
				description: "The type of this content block",
			}),
		}),
		resolveType: (block) => {
			switch (block.type) {
				case "THINKING":
					return "ThinkingBlock";
				case "TEXT":
					return "TextBlock";
				case "TOOL_USE":
					return "ToolUseBlock";
				case "TOOL_RESULT":
					return "ToolResultBlock";
				case "IMAGE":
					return "ImageBlock";
				default:
					return "TextBlock";
			}
		},
	});

// =============================================================================
// Content Block Object Types
// =============================================================================

/**
 * Thinking block - Claude's internal reasoning
 */
export const ThinkingBlockType = builder
	.objectRef<ThinkingBlockData>("ThinkingBlock")
	.implement({
		description: "Claude's thinking/reasoning block (extended thinking)",
		interfaces: [ContentBlockInterface],
		isTypeOf: (obj): obj is ThinkingBlockData =>
			(obj as ContentBlockData).type === "THINKING",
		fields: (t) => ({
			type: t.field({
				type: ContentBlockTypeEnum,
				resolve: () => "THINKING" as const,
			}),
			thinking: t.exposeString("thinking", {
				description: "Full thinking content",
			}),
			preview: t.exposeString("preview", {
				description: "First ~200 chars for collapsed view",
			}),
			signature: t.string({
				nullable: true,
				description: "Cryptographic signature if present",
				resolve: (block) => block.signature ?? null,
			}),
		}),
	});

/**
 * Text block - Regular text response
 */
export const TextBlockType = builder
	.objectRef<TextBlockData>("TextBlock")
	.implement({
		description: "Regular text content",
		interfaces: [ContentBlockInterface],
		isTypeOf: (obj): obj is TextBlockData =>
			(obj as ContentBlockData).type === "TEXT",
		fields: (t) => ({
			type: t.field({
				type: ContentBlockTypeEnum,
				resolve: () => "TEXT" as const,
			}),
			text: t.exposeString("text", {
				description: "The text content",
			}),
		}),
	});

/**
 * Tool use block - Claude requesting to use a tool
 */
export const ToolUseBlockType = builder
	.objectRef<ToolUseBlockData>("ToolUseBlock")
	.implement({
		description: "A tool use request from Claude",
		interfaces: [ContentBlockInterface],
		isTypeOf: (obj): obj is ToolUseBlockData =>
			(obj as ContentBlockData).type === "TOOL_USE",
		fields: (t) => ({
			type: t.field({
				type: ContentBlockTypeEnum,
				resolve: () => "TOOL_USE" as const,
			}),
			toolCallId: t.exposeString("toolCallId", {
				description: "Unique ID for this tool call",
			}),
			name: t.exposeString("name", {
				description: "Name of the tool being called",
			}),
			input: t.exposeString("input", {
				description: "Tool input as JSON string",
			}),
			category: t.field({
				type: ToolCategoryEnum,
				description: "Category of tool (FILE, SEARCH, SHELL, etc.)",
				resolve: (block) =>
					block.category.toUpperCase() as
						| "FILE"
						| "SEARCH"
						| "SHELL"
						| "WEB"
						| "TASK"
						| "MCP"
						| "OTHER",
			}),
			icon: t.exposeString("icon", {
				description: "Emoji icon for this tool",
			}),
			displayName: t.exposeString("displayName", {
				description: "Human-readable tool name",
			}),
			color: t.exposeString("color", {
				description: "Color code for the tool",
			}),
		}),
	});

/**
 * Tool result block - Result from a tool execution
 */
export const ToolResultBlockType = builder
	.objectRef<ToolResultBlockData>("ToolResultBlock")
	.implement({
		description: "Result returned from a tool execution",
		interfaces: [ContentBlockInterface],
		isTypeOf: (obj): obj is ToolResultBlockData =>
			(obj as ContentBlockData).type === "TOOL_RESULT",
		fields: (t) => ({
			type: t.field({
				type: ContentBlockTypeEnum,
				resolve: () => "TOOL_RESULT" as const,
			}),
			toolCallId: t.exposeString("toolCallId", {
				description: "ID of the tool call this is a result for",
			}),
			content: t.exposeString("content", {
				description: "Full result content",
			}),
			isError: t.exposeBoolean("isError", {
				description: "Whether this result is an error",
			}),
			isLong: t.exposeBoolean("isLong", {
				description: "Whether content exceeds preview length",
			}),
			preview: t.exposeString("preview", {
				description: "Preview of content (first 500 chars)",
			}),
			hasImage: t.exposeBoolean("hasImage", {
				description: "Whether this result contains an image",
			}),
		}),
	});

/**
 * Image block - Base64 encoded image
 */
export const ImageBlockType = builder
	.objectRef<ImageBlockData>("ImageBlock")
	.implement({
		description: "An image (base64 encoded or file path)",
		interfaces: [ContentBlockInterface],
		isTypeOf: (obj): obj is ImageBlockData =>
			(obj as ContentBlockData).type === "IMAGE",
		fields: (t) => ({
			type: t.field({
				type: ContentBlockTypeEnum,
				resolve: () => "IMAGE" as const,
			}),
			mediaType: t.exposeString("mediaType", {
				description: "MIME type of the image",
			}),
			dataUrl: t.exposeString("dataUrl", {
				description: "Data URL for displaying the image",
			}),
		}),
	});

// =============================================================================
// Tool Metadata Helper
// =============================================================================

const TOOL_METADATA: Record<
	string,
	{ category: string; icon: string; displayName: string; color: string }
> = {
	// File operations
	Read: {
		category: "file",
		icon: "📄",
		displayName: "Read File",
		color: "#58a6ff",
	},
	Write: {
		category: "file",
		icon: "✍️",
		displayName: "Write File",
		color: "#f0883e",
	},
	Edit: {
		category: "file",
		icon: "✏️",
		displayName: "Edit File",
		color: "#a371f7",
	},
	NotebookEdit: {
		category: "file",
		icon: "📓",
		displayName: "Notebook",
		color: "#f0883e",
	},
	// Search
	Grep: {
		category: "search",
		icon: "🔍",
		displayName: "Search",
		color: "#79c0ff",
	},
	Glob: {
		category: "search",
		icon: "📁",
		displayName: "Find Files",
		color: "#79c0ff",
	},
	LSP: {
		category: "search",
		icon: "🔗",
		displayName: "Code Intel",
		color: "#a371f7",
	},
	// Shell
	Bash: {
		category: "shell",
		icon: "💻",
		displayName: "Shell",
		color: "#7ee787",
	},
	KillShell: {
		category: "shell",
		icon: "⏹️",
		displayName: "Kill Shell",
		color: "#f85149",
	},
	// Web
	WebFetch: {
		category: "web",
		icon: "🌐",
		displayName: "Web Fetch",
		color: "#58a6ff",
	},
	WebSearch: {
		category: "web",
		icon: "🔎",
		displayName: "Web Search",
		color: "#58a6ff",
	},
	// Task
	Task: {
		category: "task",
		icon: "🤖",
		displayName: "Subagent",
		color: "#d29922",
	},
	TaskOutput: {
		category: "task",
		icon: "📤",
		displayName: "Task Output",
		color: "#d29922",
	},
	TodoWrite: {
		category: "task",
		icon: "✏️",
		displayName: "Todo List",
		color: "#22c55e",
	},
	Skill: {
		category: "task",
		icon: "⚡",
		displayName: "Skill",
		color: "#d29922",
	},
	// Other
	AskUserQuestion: {
		category: "other",
		icon: "❓",
		displayName: "Question",
		color: "#f778ba",
	},
	EnterPlanMode: {
		category: "other",
		icon: "📝",
		displayName: "Plan Mode",
		color: "#a371f7",
	},
	ExitPlanMode: {
		category: "other",
		icon: "✅",
		displayName: "Exit Plan",
		color: "#22c55e",
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
	if (toolName.startsWith("mcp__")) {
		const parts = toolName.split("__");
		const serverName = parts[1] || "mcp";
		return {
			category: "mcp",
			icon: "🔌",
			displayName: `MCP: ${serverName}`,
			color: "#8b949e",
		};
	}
	return {
		category: "other",
		icon: "🔧",
		displayName: toolName,
		color: "#8b949e",
	};
}

// =============================================================================
// Content Block Parser
// =============================================================================

interface RawToolResultImageItem {
	type: "image";
	source: {
		type: string;
		media_type: string;
		data: string;
	};
}

interface RawToolResultContentItem {
	type: string;
	text?: string;
}

interface RawContentBlock {
	type: string;
	text?: string;
	thinking?: string;
	signature?: string;
	id?: string;
	name?: string;
	input?: Record<string, unknown>;
	tool_use_id?: string;
	content?: string | Array<RawToolResultContentItem | RawToolResultImageItem>;
	is_error?: boolean;
	source?: {
		type: string;
		media_type: string;
		data: string;
	};
}

/**
 * Parse raw content blocks from message.content into typed ContentBlockData
 */
export function parseContentBlocks(
	content: string | RawContentBlock[] | undefined,
): ContentBlockData[] {
	if (!content) return [];

	// String content becomes a single text block
	if (typeof content === "string") {
		return [{ type: "TEXT", text: content }];
	}

	if (!Array.isArray(content)) return [];

	const blocks: ContentBlockData[] = [];

	for (const block of content) {
		switch (block.type) {
			case "thinking":
				if (block.thinking) {
					blocks.push({
						type: "THINKING",
						thinking: block.thinking,
						preview:
							block.thinking.length > 200
								? `${block.thinking.slice(0, 200)}...`
								: block.thinking,
						signature: block.signature,
					});
				}
				break;

			case "text":
				if (block.text) {
					blocks.push({
						type: "TEXT",
						text: block.text,
					});
				}
				break;

			case "tool_use":
				if (block.name && block.id) {
					const meta = getToolMetadata(block.name);
					blocks.push({
						type: "TOOL_USE",
						toolCallId: block.id,
						name: block.name,
						input: JSON.stringify(block.input || {}, null, 2),
						...meta,
					});
				}
				break;

			case "tool_result":
				if (block.tool_use_id) {
					const contentStr =
						typeof block.content === "string"
							? block.content
							: Array.isArray(block.content)
								? block.content
										.filter(
											(c): c is RawToolResultContentItem =>
												c.type === "text" && "text" in c && !!c.text,
										)
										.map((c) => c.text ?? "")
										.join("\n")
								: "";
					const hasImage =
						Array.isArray(block.content) &&
						block.content.some((c) => c.type === "image");

					blocks.push({
						type: "TOOL_RESULT",
						toolCallId: block.tool_use_id,
						content: contentStr,
						isError: block.is_error ?? false,
						isLong: contentStr.length > 500,
						preview:
							contentStr.length > 500
								? `${contentStr.slice(0, 500)}...`
								: contentStr,
						hasImage,
					});

					// Also extract any images embedded in tool_result content
					if (Array.isArray(block.content)) {
						for (const item of block.content) {
							if (
								item.type === "image" &&
								(item as RawToolResultImageItem).source?.data
							) {
								const imgItem = item as RawToolResultImageItem;
								blocks.push({
									type: "IMAGE",
									mediaType: imgItem.source.media_type || "image/png",
									dataUrl: `data:${imgItem.source.media_type || "image/png"};base64,${imgItem.source.data}`,
								});
							}
						}
					}
				}
				break;

			case "image":
				if (block.source?.data) {
					blocks.push({
						type: "IMAGE",
						mediaType: block.source.media_type || "image/png",
						dataUrl: `data:${block.source.media_type || "image/png"};base64,${block.source.data}`,
					});
				}
				break;
		}
	}

	return blocks;
}
