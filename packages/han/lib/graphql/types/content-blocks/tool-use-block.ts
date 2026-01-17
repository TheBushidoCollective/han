/**
 * GraphQL ToolUseBlock type
 *
 * A tool use request from Claude.
 * Result is resolved via DataLoader for efficient batched loading.
 */

import { builder, type GraphQLContext } from "../../builder.ts";
import {
	type AgentTaskData,
	AgentTaskType,
	toAgentTaskData,
} from "../agent-task.ts";
import type {
	ContentBlockData,
	ToolResultBlockData,
	ToolUseBlockData,
} from "./content-block-data.ts";
import { ContentBlockInterface } from "./content-block-interface.ts";
import { ContentBlockTypeEnum } from "./content-block-type-enum.ts";
import { ToolCategoryEnum } from "./tool-category-enum.ts";
import { ToolResultBlockType } from "./tool-result-block.ts";

/**
 * Extract agent task ID from a Task tool result
 * Looks for patterns like "agent_id": "xxx" or "Agent: xxx" in the result
 */
function extractAgentTaskIdFromResult(resultContent: string): string | null {
	if (!resultContent) return null;

	// Try JSON pattern: "agent_id": "xxx" or similar
	const jsonMatch = resultContent.match(
		/"(?:agent_id|agentId|agent)":\s*"([^"]+)"/,
	);
	if (jsonMatch) return jsonMatch[1];

	// Try text pattern: "Agent ID: xxx" or "Agent: xxx"
	const textMatch = resultContent.match(/Agent(?:\s+ID)?:\s*(\S+)/i);
	if (textMatch) return textMatch[1];

	return null;
}

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
			/**
			 * For Task tool calls, the ID of the spawned agent.
			 * Returns null for non-Task tools or if agent ID cannot be determined.
			 */
			agentTaskId: t.field({
				type: "String",
				nullable: true,
				description: "For Task tool calls, the ID of the spawned agent task",
				resolve: async (
					block,
					_args,
					context: GraphQLContext,
				): Promise<string | null> => {
					// Only Task tool calls have agent tasks
					if (block.name !== "Task") return null;

					// If explicitly set on the block, use that
					if (block.agentTaskId) return block.agentTaskId;

					// Try to extract from the tool result
					if (!block.sessionId) return null;

					const toolResults =
						await context.loaders.sessionToolResultsLoader.load(
							block.sessionId,
						);
					const result = toolResults.get(block.toolCallId);
					if (!result) return null;

					return extractAgentTaskIdFromResult(result.content);
				},
			}),
			/**
			 * For Task tool calls, the spawned agent task details.
			 * Resolved via DataLoader for efficient batched loading.
			 */
			agentTask: t.field({
				type: AgentTaskType,
				nullable: true,
				description: "For Task tool calls, the spawned agent task with details",
				resolve: async (
					block,
					_args,
					context: GraphQLContext,
				): Promise<AgentTaskData | null> => {
					// Only Task tool calls have agent tasks
					if (block.name !== "Task" || !block.sessionId) return null;

					// Get the agent ID
					let agentId: string | undefined = block.agentTaskId;
					if (!agentId) {
						const toolResults =
							await context.loaders.sessionToolResultsLoader.load(
								block.sessionId,
							);
						const result = toolResults.get(block.toolCallId);
						if (result) {
							agentId =
								extractAgentTaskIdFromResult(result.content) ?? undefined;
						}
					}
					if (!agentId) return null;

					// Load agent task details via DataLoader
					const key = `${block.sessionId}:${agentId}`;
					const detail = await context.loaders.agentTaskLoader.load(key);
					if (!detail) return null;

					return toAgentTaskData(detail, block.sessionId);
				},
			}),
			/**
			 * Result of this tool call, resolved via DataLoader.
			 * Returns null if:
			 * - sessionId is not set on the block (shouldn't happen in normal use)
			 * - No matching tool result exists
			 */
			result: t.field({
				type: ToolResultBlockType,
				nullable: true,
				description: "Result of this tool call (resolved via DataLoader)",
				resolve: async (
					block,
					_args,
					context: GraphQLContext,
				): Promise<ToolResultBlockData | null> => {
					// Can't resolve result without session context
					if (!block.sessionId) return null;

					// Load all tool results for this session (batched)
					const toolResults =
						await context.loaders.sessionToolResultsLoader.load(
							block.sessionId,
						);

					// Look up result by toolCallId
					const result = toolResults.get(block.toolCallId);
					if (!result) return null;

					// Convert to ToolResultBlockData format
					return {
						type: "TOOL_RESULT",
						toolCallId: result.toolCallId,
						content: result.content,
						isError: result.isError,
						isLong: result.isLong,
						preview: result.preview,
						hasImage: result.hasImage,
					};
				},
			}),
		}),
	});
