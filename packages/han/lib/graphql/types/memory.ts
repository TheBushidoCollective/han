/**
 * GraphQL Memory types
 *
 * Represents memory search functionality across all layers.
 */

import { queryMemoryAgent } from "../../memory/memory-agent.ts";
import { builder } from "../builder.ts";
import { getAllRules, RuleType } from "./rule.ts";

/**
 * Memory layer enum
 */
export const MemoryLayerEnum = builder.enumType("MemoryLayer", {
	values: [
		"RULES",
		"SUMMARIES",
		"OBSERVATIONS",
		"TRANSCRIPTS",
		"TEAM",
	] as const,
	description: "Layer in the memory system",
});

/**
 * Memory source enum
 */
export const MemorySourceEnum = builder.enumType("MemorySource", {
	values: ["PERSONAL", "TEAM", "RULES", "TRANSCRIPTS", "COMBINED"] as const,
	description: "Source of memory search result",
});

/**
 * Confidence enum
 */
export const ConfidenceEnum = builder.enumType("Confidence", {
	values: ["HIGH", "MEDIUM", "LOW"] as const,
	description: "Confidence level in search results",
});

/**
 * Citation interface
 */
interface Citation {
	source: string;
	excerpt: string;
	author?: string;
	timestamp?: number;
	layer?: string;
	projectPath?: string;
	projectName?: string;
}
const CitationRef = builder.objectRef<Citation>("Citation");

/**
 * Citation type implementation
 */
export const CitationType = CitationRef.implement({
	description: "Citation from memory search",
	fields: (t) => ({
		source: t.exposeString("source", { description: "Source identifier" }),
		excerpt: t.exposeString("excerpt", { description: "Relevant excerpt" }),
		author: t.string({
			nullable: true,
			description: "Author if known",
			resolve: (c) => c.author ?? null,
		}),
		timestamp: t.field({
			type: "DateTime",
			nullable: true,
			description: "Timestamp if known",
			resolve: (c) => c.timestamp ?? null,
		}),
		layer: t.field({
			type: MemoryLayerEnum,
			nullable: true,
			description: "Memory layer this came from",
			resolve: (c) => {
				if (!c.layer) return null;
				return c.layer.toUpperCase() as
					| "RULES"
					| "SUMMARIES"
					| "OBSERVATIONS"
					| "TRANSCRIPTS"
					| "TEAM";
			},
		}),
		projectPath: t.string({
			nullable: true,
			description: "Full filesystem path to the project",
			resolve: (c) => c.projectPath ?? null,
		}),
		projectName: t.string({
			nullable: true,
			description: "Human-readable project name (e.g., han, website)",
			resolve: (c) => c.projectName ?? null,
		}),
	}),
});

/**
 * Memory search result interface
 */
interface MemorySearchResult {
	answer: string;
	source: string;
	confidence: string;
	citations: Citation[];
	caveats: string[];
	layersSearched?: string[];
}
const MemorySearchResultRef =
	builder.objectRef<MemorySearchResult>("MemorySearchResult");

/**
 * Memory search result type implementation
 */
export const MemorySearchResultType = MemorySearchResultRef.implement({
	description: "Result from memory search",
	fields: (t) => ({
		answer: t.exposeString("answer", {
			description: "Answer synthesized from memory",
		}),
		source: t.field({
			type: MemorySourceEnum,
			description: "Primary source of the answer",
			resolve: (r) =>
				r.source.toUpperCase() as
					| "PERSONAL"
					| "TEAM"
					| "RULES"
					| "TRANSCRIPTS"
					| "COMBINED",
		}),
		confidence: t.field({
			type: ConfidenceEnum,
			description: "Confidence in the answer",
			resolve: (r) => r.confidence.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
		}),
		citations: t.field({
			type: [CitationType],
			description: "Citations supporting the answer",
			resolve: (r) => r.citations,
		}),
		caveats: t.stringList({
			description: "Caveats or notes about the results",
			resolve: (r) => r.caveats,
		}),
		layersSearched: t.field({
			type: [MemoryLayerEnum],
			description: "Which memory layers were searched",
			resolve: (r) => {
				return (r.layersSearched || []).map(
					(l) =>
						l.toUpperCase() as
							| "RULES"
							| "SUMMARIES"
							| "OBSERVATIONS"
							| "TRANSCRIPTS"
							| "TEAM",
				);
			},
		}),
	}),
});

/**
 * Memory query type for viewer.memory field
 */
interface MemoryQueryData {
	_phantom?: never;
}
const MemoryQueryRef = builder.objectRef<MemoryQueryData>("MemoryQuery");

/**
 * Memory query type implementation
 */
export const MemoryQueryType = MemoryQueryRef.implement({
	description: "Memory query interface",
	fields: (t) => ({
		search: t.field({
			type: MemorySearchResultType,
			args: {
				query: t.arg.string({ required: true }),
				projectPath: t.arg.string({
					required: true,
					description:
						"Project filesystem path for plugin discovery. Required for context-aware search.",
				}),
				layers: t.arg({ type: [MemoryLayerEnum] }),
			},
			description: "Search memory with a question (requires project context)",
			resolve: async (_parent, args) => {
				// Use Memory Agent with discovered MCP providers (blueprints, github, etc.)
				// projectPath is required for context-aware plugin discovery
				const result = await queryMemoryAgent({
					question: args.query,
					projectPath: args.projectPath,
				});

				// Map MemoryAgentResponse to MemorySearchResult
				return {
					answer: result.answer,
					source:
						result.searchedLayers.length > 1
							? "combined"
							: result.searchedLayers[0] || "transcripts",
					confidence: result.confidence,
					citations: result.citations.map((c) => ({
						source: c.source,
						excerpt: c.excerpt,
						author: c.author,
						timestamp: c.timestamp,
						layer: c.layer,
					})),
					caveats: result.error ? [result.error] : [],
					layersSearched: result.searchedLayers,
				} as MemorySearchResult;
			},
		}),
		rules: t.field({
			type: [RuleType],
			description: "All project and user rules across registered projects",
			resolve: () => getAllRules(),
		}),
	}),
});

/**
 * Memory Agent progress type enum
 */
export const MemoryAgentProgressTypeEnum = builder.enumType(
	"MemoryAgentProgressType",
	{
		values: [
			"SEARCHING",
			"FOUND",
			"SYNTHESIZING",
			"COMPLETE",
			"ERROR",
		] as const,
		description: "Type of progress update from Memory Agent",
	},
);

/**
 * Memory Agent progress interface
 */
interface MemoryAgentProgress {
	sessionId: string;
	type: "searching" | "found" | "synthesizing" | "complete" | "error";
	layer?: string;
	content: string;
	resultCount?: number;
	timestamp: number;
}
const MemoryAgentProgressRef = builder.objectRef<MemoryAgentProgress>(
	"MemoryAgentProgress",
);

/**
 * Memory Agent progress type implementation
 */
export const MemoryAgentProgressType = MemoryAgentProgressRef.implement({
	description: "Progress update from Memory Agent during search",
	fields: (t) => ({
		sessionId: t.exposeString("sessionId", {
			description: "Unique ID for this memory query session",
		}),
		type: t.field({
			type: MemoryAgentProgressTypeEnum,
			description: "Type of progress update",
			resolve: (p) =>
				p.type.toUpperCase() as
					| "SEARCHING"
					| "FOUND"
					| "SYNTHESIZING"
					| "COMPLETE"
					| "ERROR",
		}),
		layer: t.string({
			nullable: true,
			description: "Memory layer being searched",
			resolve: (p) => p.layer ?? null,
		}),
		content: t.exposeString("content", {
			description: "Progress message or content",
		}),
		resultCount: t.int({
			nullable: true,
			description: "Number of results found (if applicable)",
			resolve: (p) => p.resultCount ?? null,
		}),
		timestamp: t.field({
			type: "DateTime",
			description: "When this progress update occurred",
			resolve: (p) => p.timestamp,
		}),
	}),
});

/**
 * Memory Agent result interface
 */
interface MemoryAgentResult {
	sessionId: string;
	answer: string;
	confidence: "high" | "medium" | "low";
	citations: Citation[];
	searchedLayers: string[];
	success: boolean;
	error?: string;
}
const MemoryAgentResultRef =
	builder.objectRef<MemoryAgentResult>("MemoryAgentResult");

/**
 * Memory Agent result type implementation
 */
export const MemoryAgentResultType = MemoryAgentResultRef.implement({
	description: "Final result from Memory Agent query",
	fields: (t) => ({
		sessionId: t.exposeString("sessionId", {
			description: "Unique ID for this memory query session",
		}),
		answer: t.exposeString("answer", {
			description: "Synthesized answer from memory",
		}),
		confidence: t.field({
			type: ConfidenceEnum,
			description: "Confidence in the answer",
			resolve: (r) => r.confidence.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
		}),
		citations: t.field({
			type: [CitationType],
			description: "Citations supporting the answer",
			resolve: (r) => r.citations,
		}),
		searchedLayers: t.field({
			type: [MemoryLayerEnum],
			description: "Memory layers that were searched",
			resolve: (r) =>
				r.searchedLayers.map(
					(l) =>
						l.toUpperCase() as
							| "RULES"
							| "SUMMARIES"
							| "OBSERVATIONS"
							| "TRANSCRIPTS"
							| "TEAM",
				),
		}),
		success: t.exposeBoolean("success", {
			description: "Whether the query succeeded",
		}),
		error: t.string({
			nullable: true,
			description: "Error message if query failed",
			resolve: (r) => r.error ?? null,
		}),
	}),
});
