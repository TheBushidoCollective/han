/**
 * Data Access Layer (DAL) MCP Server
 *
 * Provides read-only search tools for the Memory Agent.
 * This MCP server exposes:
 * - FTS search (full-text search using BM25)
 * - Vector search (semantic similarity)
 * - Hybrid search (FTS + Vector with Reciprocal Rank Fusion)
 *
 * All operations are READ-ONLY for memory safety.
 *
 * IMPORTANT: All data is stored in ~/.claude/han/han.db (single database).
 * Transcript searches use the native module's searchMessages for FTS.
 * Other layers use the indexer functions which also target the same database.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
	type FtsResult,
	getGitRemote,
	getTableName,
	hybridSearch,
	searchFts,
	searchVector,
} from "../../memory/index.ts";
import { tryGetNativeModule } from "../../native.ts";

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id?: string | number;
	method: string;
	params?: Record<string, unknown>;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id?: string | number;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

interface McpToolAnnotations {
	title?: string;
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
}

interface McpTool {
	name: string;
	description: string;
	annotations?: McpToolAnnotations;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

/**
 * Memory layer names for searching
 */
type MemoryLayer = "rules" | "transcripts" | "team" | "summaries" | "all";

/**
 * Search result with citations
 */
interface SearchResultWithCitation extends FtsResult {
	layer: string;
	browseUrl?: string;
}

/**
 * Get table name for a memory layer
 */
function getLayerTableName(layer: MemoryLayer): string[] {
	const gitRemote = getGitRemote();
	const tables: string[] = [];

	if (layer === "all" || layer === "rules") {
		tables.push(getTableName("observations"));
	}
	if (layer === "all" || layer === "transcripts") {
		tables.push(getTableName("transcripts"));
	}
	if ((layer === "all" || layer === "team") && gitRemote) {
		tables.push(getTableName("team", gitRemote));
	}

	return tables;
}

/**
 * Add layer info and browse URLs to results
 */
function enrichResults(
	results: FtsResult[],
	layer: string,
): SearchResultWithCitation[] {
	return results.map((r) => {
		const metadata = r.metadata || {};
		let browseUrl: string | undefined;

		// Build Browse UI deep link based on source type
		if (r.id.startsWith("git:commit:")) {
			const sha = r.id.replace("git:commit:", "");
			browseUrl = `/repos?commit=${sha}`;
		} else if (metadata.session_id) {
			browseUrl = `/sessions/${metadata.session_id}`;
			if (metadata.line_number) {
				browseUrl += `#line-${metadata.line_number}`;
			}
		} else if (layer === "rules" && metadata.domain) {
			browseUrl = `/memory?tab=rules&file=${metadata.domain}`;
		}

		return {
			...r,
			layer,
			browseUrl,
		};
	});
}

/**
 * Search transcripts using the native module
 * The native module stores indexed messages in ~/.claude/han/han.db
 */
async function searchTranscriptsNative(
	query: string,
	limit: number,
): Promise<SearchResultWithCitation[]> {
	const nativeModule = tryGetNativeModule();
	if (!nativeModule) {
		return [];
	}

	try {
		const dbPath = join(homedir(), ".claude", "han", "han.db");
		const messages = nativeModule.searchMessages(dbPath, query, null, limit);

		return messages.map((msg) => ({
			id: `transcript:${msg.sessionId}:${msg.id}`,
			content: msg.content || msg.toolResult || msg.toolInput || "",
			score: 0.7, // FTS matches get decent score
			layer: "transcripts",
			metadata: {
				sessionId: msg.sessionId,
				messageId: msg.id,
				role: msg.role,
				messageType: msg.messageType,
				toolName: msg.toolName,
				timestamp: new Date(msg.timestamp).getTime(),
				lineNumber: msg.lineNumber,
			},
			browseUrl: `/sessions/${msg.sessionId}#msg-${msg.id}`,
		}));
	} catch (error) {
		console.error("[DAL] Transcript search error:", error);
		return [];
	}
}

/**
 * Search generated session summaries using the native module
 * Returns semantic summaries with topics for "which session discussed X" queries
 */
async function searchSummariesNative(
	query: string,
	limit: number,
): Promise<SearchResultWithCitation[]> {
	const nativeModule = tryGetNativeModule();
	if (!nativeModule) {
		return [];
	}

	try {
		const dbPath = join(homedir(), ".claude", "han", "han.db");
		const summaries = nativeModule.searchGeneratedSummaries(dbPath, query, limit);

		return summaries.map((s) => ({
			id: `summary:${s.sessionId}`,
			content: `${s.summaryText}\n\nTopics: ${s.topics.join(", ")}`,
			score: 0.8, // Generated summaries get higher score than raw transcripts
			layer: "summaries",
			metadata: {
				sessionId: s.sessionId,
				topics: s.topics,
				outcome: s.outcome,
				filesModified: s.filesModified,
				toolsUsed: s.toolsUsed,
				messageCount: s.messageCount,
			},
			browseUrl: `/sessions/${s.sessionId}`,
		}));
	} catch (error) {
		console.error("[DAL] Summary search error:", error);
		return [];
	}
}

/**
 * Search across memory layers using FTS
 */
async function searchMemoryFts(
	query: string,
	layer: MemoryLayer,
	limit: number,
): Promise<SearchResultWithCitation[]> {
	const allResults: SearchResultWithCitation[] = [];

	// Handle summaries layer - semantic session summaries
	if (layer === "all" || layer === "summaries") {
		const summaryResults = await searchSummariesNative(query, limit);
		allResults.push(...summaryResults);
	}

	// Handle transcripts specially - use native module
	if (layer === "all" || layer === "transcripts") {
		const transcriptResults = await searchTranscriptsNative(query, limit);
		allResults.push(...transcriptResults);
	}

	// Handle other layers via indexer
	const tables = getLayerTableName(layer);
	for (const table of tables) {
		// Skip transcripts - handled above via native module
		if (table.includes("transcripts")) continue;

		try {
			const layerName = table.includes("team") ? "team" : "rules";
			const results = await searchFts(table, query, limit);
			allResults.push(...enrichResults(results, layerName));
		} catch {
			// Layer not available - continue
		}
	}

	// Sort by score and return top results
	return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Search across memory layers using vector similarity
 * Note: For transcripts/summaries, falls back to FTS since native module only has FTS
 */
async function searchMemoryVector(
	query: string,
	layer: MemoryLayer,
	limit: number,
): Promise<SearchResultWithCitation[]> {
	const allResults: SearchResultWithCitation[] = [];

	// Handle summaries layer - semantic session summaries (FTS for now)
	if (layer === "all" || layer === "summaries") {
		const summaryResults = await searchSummariesNative(query, limit);
		allResults.push(...summaryResults);
	}

	// Handle transcripts specially - use native module (FTS only for now)
	if (layer === "all" || layer === "transcripts") {
		const transcriptResults = await searchTranscriptsNative(query, limit);
		allResults.push(...transcriptResults);
	}

	// Handle other layers via indexer
	const tables = getLayerTableName(layer);
	for (const table of tables) {
		// Skip transcripts - handled above via native module
		if (table.includes("transcripts")) continue;

		try {
			const layerName = table.includes("team") ? "team" : "rules";
			const results = await searchVector(table, query, limit);
			allResults.push(...enrichResults(results, layerName));
		} catch {
			// Layer not available - continue
		}
	}

	// Sort by score and return top results
	return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Search across memory layers using hybrid (FTS + Vector with RRF)
 */
async function searchMemoryHybrid(
	query: string,
	layer: MemoryLayer,
	limit: number,
): Promise<SearchResultWithCitation[]> {
	const allResults: SearchResultWithCitation[] = [];

	// Handle summaries layer - semantic session summaries (FTS for now)
	if (layer === "all" || layer === "summaries") {
		const summaryResults = await searchSummariesNative(query, limit);
		allResults.push(...summaryResults);
	}

	// Handle transcripts specially - use native module
	if (layer === "all" || layer === "transcripts") {
		const transcriptResults = await searchTranscriptsNative(query, limit);
		allResults.push(...transcriptResults);
	}

	// Handle other layers via indexer
	const tables = getLayerTableName(layer);
	for (const table of tables) {
		// Skip transcripts - handled above via native module
		if (table.includes("transcripts")) continue;

		try {
			const layerName = table.includes("team") ? "team" : "rules";
			const results = await hybridSearch(table, query, limit);
			allResults.push(...enrichResults(results, layerName));
		} catch {
			// Layer not available - continue
		}
	}

	// Sort by score and return top results
	return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * DAL tools - all read-only
 */
const DAL_TOOLS: McpTool[] = [
	{
		name: "memory_search_fts",
		description:
			"Search memory layers using full-text search (BM25). Returns results ranked by keyword relevance. Best for exact phrase matches and specific terms.",
		annotations: {
			title: "FTS Search",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "The search query (keywords, phrases)",
				},
				layer: {
					type: "string",
					enum: ["rules", "transcripts", "summaries", "team", "all"],
					description:
						"Memory layer to search. 'rules' = project conventions, 'transcripts' = past sessions, 'summaries' = session summaries with topics, 'team' = git commits/PRs, 'all' = search everywhere (default)",
				},
				limit: {
					type: "number",
					description: "Maximum results to return (default: 10)",
				},
			},
			required: ["query"],
		},
	},
	{
		name: "memory_search_vector",
		description:
			"Search memory layers using semantic/vector similarity. Returns results based on meaning, not just keywords. Best for conceptual queries and finding related content.",
		annotations: {
			title: "Vector Search",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "The search query (natural language question)",
				},
				layer: {
					type: "string",
					enum: ["rules", "transcripts", "summaries", "team", "all"],
					description:
						"Memory layer to search. 'rules' = project conventions, 'transcripts' = past sessions, 'summaries' = session summaries with topics, 'team' = git commits/PRs, 'all' = search everywhere (default)",
				},
				limit: {
					type: "number",
					description: "Maximum results to return (default: 10)",
				},
			},
			required: ["query"],
		},
	},
	{
		name: "memory_search_hybrid",
		description:
			"Search memory layers using hybrid search (FTS + Vector with Reciprocal Rank Fusion). Combines keyword matching with semantic similarity for best overall results. RECOMMENDED for most queries.",
		annotations: {
			title: "Hybrid Search",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "The search query (can be keywords or natural language)",
				},
				layer: {
					type: "string",
					enum: ["rules", "transcripts", "summaries", "team", "all"],
					description:
						"Memory layer to search. 'rules' = project conventions, 'transcripts' = past sessions, 'summaries' = session summaries with topics, 'team' = git commits/PRs, 'all' = search everywhere (default)",
				},
				limit: {
					type: "number",
					description: "Maximum results to return (default: 10)",
				},
			},
			required: ["query"],
		},
	},
	{
		name: "memory_list_layers",
		description:
			"List available memory layers and their status. Returns which layers have data and are searchable.",
		annotations: {
			title: "List Memory Layers",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {},
			required: [],
		},
	},
];

function handleInitialize(): unknown {
	return {
		protocolVersion: "2024-11-05",
		capabilities: {
			tools: {},
		},
		serverInfo: {
			name: "memory-dal",
			version: "1.0.0",
		},
	};
}

function handleToolsList(): unknown {
	return {
		tools: DAL_TOOLS,
	};
}

async function handleToolsCall(params: {
	name: string;
	arguments?: Record<string, unknown>;
}): Promise<unknown> {
	try {
		const args = params.arguments || {};

		switch (params.name) {
			case "memory_search_fts": {
				const query = typeof args.query === "string" ? args.query : "";
				const layer = (args.layer as MemoryLayer) || "all";
				const limit = typeof args.limit === "number" ? args.limit : 10;

				if (!query) {
					throw new Error("Query is required");
				}

				const results = await searchMemoryFts(query, layer, limit);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									searchType: "fts",
									layer,
									resultCount: results.length,
									results,
								},
								null,
								2,
							),
						},
					],
				};
			}

			case "memory_search_vector": {
				const query = typeof args.query === "string" ? args.query : "";
				const layer = (args.layer as MemoryLayer) || "all";
				const limit = typeof args.limit === "number" ? args.limit : 10;

				if (!query) {
					throw new Error("Query is required");
				}

				const results = await searchMemoryVector(query, layer, limit);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									searchType: "vector",
									layer,
									resultCount: results.length,
									results,
								},
								null,
								2,
							),
						},
					],
				};
			}

			case "memory_search_hybrid": {
				const query = typeof args.query === "string" ? args.query : "";
				const layer = (args.layer as MemoryLayer) || "all";
				const limit = typeof args.limit === "number" ? args.limit : 10;

				if (!query) {
					throw new Error("Query is required");
				}

				const results = await searchMemoryHybrid(query, layer, limit);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									searchType: "hybrid",
									layer,
									resultCount: results.length,
									results,
								},
								null,
								2,
							),
						},
					],
				};
			}

			case "memory_list_layers": {
				const gitRemote = getGitRemote();
				const layers = [
					{
						name: "rules",
						description: "Project conventions from .claude/rules/",
						available: true,
					},
					{
						name: "transcripts",
						description: "Past Claude Code sessions (raw messages)",
						available: true,
					},
					{
						name: "summaries",
						description: "Session summaries with topics (for 'which session discussed X' queries)",
						available: true,
					},
					{
						name: "team",
						description: "Git commits and PRs",
						available: !!gitRemote,
						gitRemote,
					},
				];

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ layers }, null, 2),
						},
					],
				};
			}

			default:
				throw {
					code: -32602,
					message: `Unknown tool: ${params.name}`,
				};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			content: [
				{
					type: "text",
					text: `Error executing ${params.name}: ${message}`,
				},
			],
			isError: true,
		};
	}
}

async function handleRequest(
	request: JsonRpcRequest,
): Promise<JsonRpcResponse> {
	try {
		let result: unknown;

		switch (request.method) {
			case "initialize":
				result = handleInitialize();
				break;
			case "initialized":
				// Notification, no response needed
				return { jsonrpc: "2.0", id: request.id, result: {} };
			case "ping":
				// Simple ping/pong for health checks
				result = {};
				break;
			case "tools/list":
				result = handleToolsList();
				break;
			case "tools/call":
				result = await handleToolsCall(
					request.params as {
						name: string;
						arguments?: Record<string, unknown>;
					},
				);
				break;
			default:
				throw {
					code: -32601,
					message: `Method not found: ${request.method}`,
				};
		}

		return {
			jsonrpc: "2.0",
			id: request.id,
			result,
		};
	} catch (error) {
		const errorObj =
			typeof error === "object" && error !== null && "code" in error
				? (error as { code: number; message: string })
				: { code: -32603, message: String(error) };

		return {
			jsonrpc: "2.0",
			id: request.id,
			error: errorObj,
		};
	}
}

function sendResponse(response: JsonRpcResponse): void {
	const json = JSON.stringify(response);
	process.stdout.write(`${json}\n`);
}

/**
 * Start the Data Access Layer MCP server
 *
 * This server is designed to be used by the Memory Agent via Agent SDK.
 * All operations are read-only for memory safety.
 */
export async function startDalMcpServer(): Promise<void> {
	// Setup signal handlers for graceful shutdown
	process.on("SIGINT", () => process.exit(0));
	process.on("SIGTERM", () => process.exit(0));

	const rl = createInterface({
		input: process.stdin,
		terminal: false,
	});

	for await (const line of rl) {
		if (!line.trim()) continue;

		try {
			const request = JSON.parse(line) as JsonRpcRequest;
			const response = await handleRequest(request);

			// Only send response if there's an id (not a notification)
			if (request.id !== undefined) {
				sendResponse(response);
			}
		} catch (error) {
			// JSON parse error
			sendResponse({
				jsonrpc: "2.0",
				error: {
					code: -32700,
					message: "Parse error",
					data: String(error),
				},
			});
		}
	}
}
