/**
 * Content Block Parser
 *
 * Parses raw content blocks from message.content into typed ContentBlockData.
 */

import type { ContentBlockData } from "./content-block-data.ts";
import { getToolMetadata } from "./tool-metadata.ts";

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
 * Options for parsing content blocks
 */
export interface ParseContentBlocksOptions {
	/** Session ID to include in tool use blocks for result resolution */
	sessionId?: string;
}

/**
 * Parse raw content blocks from message.content into typed ContentBlockData
 */
export function parseContentBlocks(
	content: string | RawContentBlock[] | undefined,
	options?: ParseContentBlocksOptions,
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
						sessionId: options?.sessionId,
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
