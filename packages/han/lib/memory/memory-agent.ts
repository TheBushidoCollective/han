/**
 * Memory Agent
 *
 * A separate read-only agent spawned via Claude Agent SDK to handle memory queries.
 * The agent has access to the Data Access Layer MCP which provides search tools.
 *
 * Key principles:
 * - READ-ONLY: Cannot modify files, cannot execute code
 * - Synthesizes information from multiple memory layers
 * - Returns citations as deep links to Browse UI
 * - Session ID returned for live streaming
 */

import {
	type McpServerConfig,
	type Options,
	query,
} from "@anthropic-ai/claude-agent-sdk";
import { findClaudeExecutable } from "../shared/shared.ts";
import { discoverProviders } from "./provider-discovery.ts";

/**
 * JSONSchema for Memory Agent structured output
 *
 * Using outputFormat ensures consistent, parseable responses.
 */
const MEMORY_AGENT_OUTPUT_SCHEMA = {
	type: "object",
	properties: {
		answer: {
			type: "string",
			description: "Synthesized answer to the question based on memory search",
		},
		confidence: {
			type: "string",
			enum: ["high", "medium", "low"],
			description:
				"Confidence level based on quality and quantity of sources found",
		},
		citations: {
			type: "array",
			items: {
				type: "object",
				properties: {
					source: {
						type: "string",
						description:
							"Source identifier (e.g., rules:api, transcript:abc123, github:pr:123)",
					},
					excerpt: {
						type: "string",
						description: "Relevant excerpt from the source",
					},
					layer: {
						type: "string",
						description: "Memory layer this came from",
					},
				},
				required: ["source", "excerpt"],
			},
			description: "Citations supporting the answer",
		},
		searchedLayers: {
			type: "array",
			items: { type: "string" },
			description: "Memory layers that were searched",
		},
	},
	required: ["answer", "confidence", "citations", "searchedLayers"],
} as const;

/**
 * Memory query parameters
 */
export interface MemoryQueryParams {
	/** The question to research */
	question: string;
	/** Project filesystem path for plugin discovery (required for context-aware search) */
	projectPath: string;
	/** Maximum results per layer */
	limit?: number;
	/** Model to use (default: haiku for speed) */
	model?: "haiku" | "sonnet" | "opus";
}

/**
 * Citation with deep link to Browse UI
 */
export interface MemoryCitation {
	/** Source identifier */
	source: string;
	/** Relevant excerpt */
	excerpt: string;
	/** Author if known */
	author?: string;
	/** Timestamp if known */
	timestamp?: number;
	/** Deep link to Browse UI */
	browseUrl?: string;
	/** Memory layer this citation came from */
	layer?: string;
}

/**
 * Memory agent response
 */
export interface MemoryAgentResponse {
	/** Session ID for live streaming */
	sessionId: string;
	/** Final synthesized answer */
	answer: string;
	/** Confidence level */
	confidence: "high" | "medium" | "low";
	/** Citations for the answer */
	citations: MemoryCitation[];
	/** Layers that were searched */
	searchedLayers: string[];
	/** Whether the query succeeded */
	success: boolean;
	/** Error message if failed */
	error?: string;
}

/**
 * Progress update during memory query
 */
export interface MemoryProgressUpdate {
	type: "searching" | "found" | "synthesizing" | "complete" | "error";
	layer?: string;
	content: string;
	resultCount?: number;
}

/**
 * Memory Agent system prompt
 *
 * Emphasizes read-only behavior and citation requirements.
 */
const MEMORY_AGENT_PROMPT = `You are a Memory Agent with READ-ONLY access to a project's memory layers. Your job is to research questions and synthesize answers with citations.

## Your Capabilities
- Search rules (project conventions in .claude/rules/)
- Search summaries (Claude's context window compression summaries)
- Search transcripts (past Claude Code conversations)
- Search team memory (git commits, PRs)
- Search external providers (GitHub PRs, issues, reviews - when available)

## CRITICAL RULES
1. You can ONLY read and search - you cannot modify any files or data
2. ALWAYS cite your sources with specific references
3. If you can't find relevant information, say so clearly
4. Synthesize information from multiple sources when available
5. Be concise but thorough

## How to Answer
1. Search relevant memory layers for the question
2. Analyze the results for relevance
3. Synthesize a clear, concise answer
4. Include citations for every claim

## Citation Format
When citing sources, use this format:
- [rules:api] - from .claude/rules/api.md
- [summary:abc123] - from session abc123's summary
- [transcript:abc123:42] - from session abc123, message 42
- [git:commit:a1b2c3d] - from commit a1b2c3d
- [github:pr:123] - from GitHub PR #123
- [github:issue:45] - from GitHub issue #45

Your answer should be helpful, accurate, and well-sourced.`;

/**
 * Memory Agent MCP Configuration
 *
 * The Memory Agent connects to MCP servers to search memory:
 * 1. **DAL MCP** (`han mcp memory`) - internal Han database (transcripts, git)
 * 2. **Memory Provider MCPs** - discovered from plugins with BOTH `mcp` AND `memory` keys
 *
 * Discovery: Scans han-plugin.yml files for plugins that have:
 * - `mcp` key: defines the MCP server (command, args, env)
 * - `memory` key: defines `allowed_tools` (which MCP tools the Memory Agent can use)
 */
interface MemoryAgentMcpConfig {
	/** MCP servers to connect to */
	mcpServers: Record<string, McpServerConfig>;
	/** Tools the Memory Agent is allowed to use */
	allowedTools: string[];
	/** System prompts from each provider (tool usage guidance) */
	systemPrompts: string[];
}

/**
 * Build MCP server config and allowed tools for the Memory Agent
 *
 * ALL MCP servers are discovered from plugins with BOTH `mcp` AND `memory` keys.
 * This includes the core DAL (defined in core/han-plugin.yml) and external
 * providers like hashi-github, hashi-blueprints, etc.
 *
 * @param projectPath - Optional project path for plugin discovery context
 * Returns:
 * - MCP server configs from all discovered providers
 * - List of allowed tools (from `memory.allowed_tools` of each provider)
 */
async function buildMemoryAgentMcpConfig(
	projectPath?: string,
): Promise<MemoryAgentMcpConfig> {
	const allowedTools: string[] = [];
	const systemPrompts: string[] = [];

	// Discover memory providers from installed plugins
	// MCP servers are automatically available from enabled plugins via .mcp.json
	// We just need to collect allowed_tools and system_prompts
	try {
		const providers = await discoverProviders(projectPath);

		for (const provider of providers) {
			// Add allowed tools from plugin's memory.allowed_tools
			allowedTools.push(...provider.allowedTools);

			// Add system prompt from plugin's memory.system_prompt
			if (provider.systemPrompt) {
				systemPrompts.push(
					`## ${provider.pluginName}\n${provider.systemPrompt}`,
				);
			}
		}

		if (allowedTools.length === 0) {
			console.warn(
				"[Memory Agent] No memory providers discovered. Ensure plugins have memory.allowed_tools defined.",
			);
		}
	} catch (error) {
		console.error("[Memory Agent] Error discovering providers:", error);
	}

	// MCP servers are inherited from enabled plugins - no need to specify them
	return { mcpServers: {}, allowedTools, systemPrompts };
}

/**
 * Generate a unique session ID for the memory query
 */
function generateSessionId(): string {
	return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Query memory using the Memory Agent
 *
 * This spawns a separate read-only agent that searches memory layers
 * and synthesizes an answer with citations.
 *
 * @param params - Query parameters
 * @param onProgress - Optional progress callback for live streaming
 * @returns Promise<MemoryAgentResponse>
 */
export async function queryMemoryAgent(
	params: MemoryQueryParams,
	onProgress?: (update: MemoryProgressUpdate) => void,
): Promise<MemoryAgentResponse> {
	const { question, projectPath, model = "haiku" } = params;
	const sessionId = generateSessionId();

	// Validate input
	if (!question || question.trim().length === 0) {
		return {
			sessionId,
			answer: "Question cannot be empty",
			confidence: "low",
			citations: [],
			searchedLayers: [],
			success: false,
			error: "Empty question",
		};
	}

	try {
		// Get MCP config: servers + allowed tools + system prompts from discovered providers
		// Pass projectPath for context-aware plugin discovery
		const { mcpServers, allowedTools, systemPrompts } =
			await buildMemoryAgentMcpConfig(projectPath);

		// Log what's discovered (for debugging)
		if (Object.keys(mcpServers).length === 0) {
			console.error("[Memory Agent] WARNING: No MCP servers discovered");
		}
		console.error(
			`[Memory Agent] MCP servers: ${Object.keys(mcpServers).join(", ")}`,
		);
		console.error(
			`[Memory Agent] Allowed tools (${allowedTools.length}): ${allowedTools.join(", ")}`,
		);

		// Find Claude executable
		const claudePath = findClaudeExecutable();

		// Build provider-specific instructions from system prompts
		const providerInstructions =
			systemPrompts.length > 0
				? `\n## Provider-Specific Instructions\n\n${systemPrompts.join("\n\n")}`
				: "";

		// Build prompt for the Memory Agent
		// The agent will use MCP tools to search - NO local results pre-fetched
		const agentPrompt = `${MEMORY_AGENT_PROMPT}
${providerInstructions}

## Question

${question}

## General Instructions

1. Use your MCP tools to search for relevant information.
2. Synthesize findings into a clear, concise answer.
3. Include citations using [Source: <source_id>] format for each claim.
4. If you cannot find relevant information, say so clearly.
5. Your memory requests are one-shot, you cannot ask for additional information or tell the user what you WILL do. Just do it.

IMPORTANT: You ONLY have access to MCP search tools listed in allowedTools. Do NOT try to use Bash, Read, Write, Glob, Task, or other tools - they are blocked.`;

		onProgress?.({
			type: "searching",
			content: `prompt: ${agentPrompt}`,
		});

		const options: Options = {
			model,
			pathToClaudeCodeExecutable: claudePath,
			mcpServers,
			allowedTools, // CRITICAL: Only MCP tools, blocks Bash/Read/Write/Glob
			outputFormat: {
				type: "json_schema",
				schema: MEMORY_AGENT_OUTPUT_SCHEMA,
			},
		};

		onProgress?.({
			type: "searching",
			content: JSON.stringify(options, null, 2),
		});

		// Spawn agent with ONLY MCP tools - Bash/Read/Write/Glob are blocked
		const agent = query({
			prompt: agentPrompt,
			options,
		});

		let responseText = "";
		const toolSearchedLayers: string[] = [];

		for await (const message of agent) {
			// Handle tool use - report progress
			if (message.type === "assistant" && message.message?.content) {
				for (const block of message.message.content) {
					if (block.type === "text") {
						responseText += block.text;
					} else if (block.type === "tool_use") {
						// Extract layer from tool name: mcp__<serverName>__<toolName>
						const toolName = block.name;
						const parts = toolName.split("__");
						const layer = parts.length >= 2 ? parts[1] : toolName;

						if (!toolSearchedLayers.includes(layer)) {
							toolSearchedLayers.push(layer);
						}

						onProgress?.({
							type: "searching",
							layer,
							content: `Using tool: ${toolName}`,
						});
					}
				}
			}

			// Handle tool results - count results for progress
			if (message.type === "user" && message.message?.content) {
				for (const block of message.message.content) {
					if (
						block.type === "tool_result" &&
						typeof block.content === "string"
					) {
						try {
							const parsed = JSON.parse(block.content);
							if (Array.isArray(parsed)) {
								onProgress?.({
									type: "found",
									content: `Found ${parsed.length} results`,
									resultCount: parsed.length,
								});
							}
						} catch {
							// Not JSON array, ignore
						}
					}
				}
			}
		}

		onProgress?.({
			type: "complete",
			content: "Memory search complete",
		});

		// Parse the structured JSON response from outputFormat
		interface StructuredResponse {
			answer: string;
			confidence: "high" | "medium" | "low";
			citations: Array<{
				source: string;
				excerpt: string;
				layer?: string;
			}>;
			searchedLayers: string[];
		}

		let structuredResponse: StructuredResponse | null = null;
		try {
			structuredResponse = JSON.parse(responseText) as StructuredResponse;
		} catch {
			// Fallback: response wasn't valid JSON, use raw text
			console.warn(
				"[Memory Agent] Response was not valid JSON, using raw text",
			);
		}

		if (structuredResponse) {
			// Use structured response from JSONSchema
			return {
				sessionId,
				answer: structuredResponse.answer || "No relevant information found.",
				confidence: structuredResponse.confidence || "low",
				citations: structuredResponse.citations.slice(0, 10).map((c) => ({
					source: c.source,
					excerpt: c.excerpt,
					layer: c.layer,
				})),
				searchedLayers:
					structuredResponse.searchedLayers.length > 0
						? structuredResponse.searchedLayers
						: toolSearchedLayers,
				success: true,
			};
		}

		// Fallback: use raw text as answer
		return {
			sessionId,
			answer: responseText || "No relevant information found.",
			confidence: "low",
			citations: [],
			searchedLayers: toolSearchedLayers,
			success: true,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		onProgress?.({
			type: "error",
			content: errorMessage,
		});

		return {
			sessionId,
			answer: `Memory Agent error: ${errorMessage}`,
			confidence: "low",
			citations: [],
			searchedLayers: [],
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Format memory agent result for display
 */
export function formatMemoryAgentResult(result: MemoryAgentResponse): string {
	const lines: string[] = [];

	// Confidence indicator
	const emoji =
		result.confidence === "high"
			? "🟢"
			: result.confidence === "medium"
				? "🟡"
				: "🔴";
	lines.push(`${emoji} **Confidence: ${result.confidence}**`);
	lines.push("");

	// Answer
	lines.push("## Answer");
	lines.push(result.answer);
	lines.push("");

	// Citations
	if (result.citations.length > 0) {
		lines.push("## Sources");
		for (const citation of result.citations.slice(0, 5)) {
			const author = citation.author ? ` (${citation.author})` : "";
			const date = citation.timestamp
				? ` - ${new Date(citation.timestamp).toLocaleDateString()}`
				: "";
			const link = citation.browseUrl ? ` [View](${citation.browseUrl})` : "";
			lines.push(`- **${citation.source}**${author}${date}${link}`);
			if (citation.excerpt) {
				lines.push(`  > ${citation.excerpt.slice(0, 150)}...`);
			}
		}
		lines.push("");
	}

	// Layers searched
	if (result.searchedLayers.length > 0) {
		lines.push(`*Searched: ${result.searchedLayers.join(", ")}*`);
	}

	return lines.join("\n");
}

/**
 * Get MCP configuration for spawning a Memory Agent with autonomous search
 *
 * This returns the MCP server config needed to spawn a Claude agent
 * that has access to the memory DAL tools (FTS, Vector, Hybrid search).
 *
 * Use this when you need an agent to autonomously research memory
 * rather than doing a search-then-synthesize flow.
 *
 * @example
 * ```typescript
 * import { query } from "@anthropic-ai/claude-agent-sdk";
 * import { getMemoryAgentMcpConfig } from "./memory-agent";
 *
 * const agent = query({
 *   prompt: "Research who implemented the auth system",
 *   options: {
 *     model: "haiku",
 *     mcpServers: getMemoryAgentMcpConfig(),
 *   },
 * });
 * ```
 */
export { buildMemoryAgentMcpConfig as getMemoryAgentMcpConfig };
