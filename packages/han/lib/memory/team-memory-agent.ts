/**
 * Team Memory Agent
 *
 * A privacy-aware agent for synthesizing team memory queries.
 * Uses Claude Agent SDK to provide intelligent answers with proper
 * source attribution and visibility metadata.
 *
 * Key principles:
 * - Double-checks permissions on all retrieved content
 * - Source attribution with visibility levels
 * - Privacy guidelines in agent prompt
 * - Never exposes content from unauthorized sessions
 */

import { type Options, query } from "@anthropic-ai/claude-agent-sdk";
import { findClaudeExecutable } from "../shared/shared.ts";
import type {
	MemoryScope,
	UserPermissionContext,
} from "./permission-filter.ts";
import { enforceRateLimit } from "./rate-limiter.ts";
import { queryTeamMemory, type TeamCitation } from "./team-memory-query.ts";

/**
 * Team memory agent output schema
 */
const TEAM_MEMORY_AGENT_OUTPUT_SCHEMA = {
	type: "object",
	properties: {
		answer: {
			type: "string",
			description: "Synthesized answer based on team memory search",
		},
		confidence: {
			type: "string",
			enum: ["high", "medium", "low"],
			description: "Confidence level based on quality and quantity of sources",
		},
		citations: {
			type: "array",
			items: {
				type: "object",
				properties: {
					source: {
						type: "string",
						description: "Source identifier",
					},
					excerpt: {
						type: "string",
						description: "Relevant excerpt (sanitized)",
					},
					visibility: {
						type: "string",
						enum: ["public", "team", "private"],
						description: "Visibility level",
					},
				},
				required: ["source", "excerpt", "visibility"],
			},
			description: "Citations with visibility metadata",
		},
		privacyNotes: {
			type: "array",
			items: { type: "string" },
			description: "Notes about privacy considerations in the response",
		},
	},
	required: ["answer", "confidence", "citations"],
} as const;

/**
 * Privacy-aware system prompt for team memory agent
 */
const TEAM_MEMORY_AGENT_PROMPT = `You are a Team Memory Agent with READ-ONLY access to your organization's shared memory. Your job is to research questions and synthesize answers with proper source attribution.

## CRITICAL PRIVACY RULES

1. **Never expose unauthorized content**: You can only access sessions the user has permission to view
2. **Sanitize all excerpts**: Remove passwords, API keys, tokens, and other secrets
3. **Respect visibility levels**:
   - "public": Safe to share broadly within the org
   - "team": Visible to team members with repo access
   - "private": Only visible to the session owner
4. **Attribution is mandatory**: Every claim must have a citation
5. **When uncertain, be conservative**: If you're not sure about privacy, err on the side of caution

## Privacy Patterns to REDACT
- Passwords, secrets, tokens, API keys
- Personal email addresses (non-work)
- Internal URLs with sensitive paths
- Specific user data or PII
- Credentials in any format

## How to Answer
1. Search team memory for relevant information
2. Filter results by visibility level
3. Sanitize excerpts before including them
4. Synthesize a clear, privacy-aware answer
5. Include citations with visibility levels

## Citation Format
Use this format for citations:
- [transcript:sessionId:msgId] (visibility: team) - from team session
- [rules:domain] (visibility: public) - from project rules
- [team:git:sha] (visibility: team) - from git history

Your response should be helpful, accurate, and privacy-conscious.`;

/**
 * Team memory agent parameters
 */
export interface TeamMemoryAgentParams {
	/** The question to research */
	question: string;
	/** User permission context */
	context: UserPermissionContext;
	/** Memory scope to search */
	scope?: MemoryScope;
	/** Project path for context */
	projectPath?: string;
	/** Model to use */
	model?: "haiku" | "sonnet" | "opus";
}

/**
 * Team memory agent response
 */
export interface TeamMemoryAgentResponse {
	/** Session ID for tracking */
	sessionId: string;
	/** Synthesized answer */
	answer: string;
	/** Confidence level */
	confidence: "high" | "medium" | "low";
	/** Citations with visibility */
	citations: TeamCitation[];
	/** Sessions that were searched */
	sessionsSearched: number;
	/** Privacy notes from the agent */
	privacyNotes: string[];
	/** Whether the query succeeded */
	success: boolean;
	/** Error message if failed */
	error?: string;
}

/**
 * Generate a unique session ID for tracking
 */
function generateSessionId(): string {
	return `team-mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Query team memory using the agent for synthesis
 *
 * This uses the Claude Agent SDK to provide intelligent synthesis
 * with privacy-aware processing.
 */
export async function queryTeamMemoryWithAgent(
	params: TeamMemoryAgentParams,
): Promise<TeamMemoryAgentResponse> {
	const {
		question,
		context,
		scope = "team",
		projectPath,
		model = "haiku",
	} = params;

	const sessionId = generateSessionId();

	// Validate input
	if (!question || question.trim().length === 0) {
		return {
			sessionId,
			answer: "Question cannot be empty",
			confidence: "low",
			citations: [],
			sessionsSearched: 0,
			privacyNotes: [],
			success: false,
			error: "Empty question",
		};
	}

	// Rate limit check
	try {
		enforceRateLimit(context.userId, "query");
	} catch (error) {
		return {
			sessionId,
			answer: error instanceof Error ? error.message : "Rate limit exceeded",
			confidence: "low",
			citations: [],
			sessionsSearched: 0,
			privacyNotes: [],
			success: false,
			error: "Rate limit exceeded",
		};
	}

	try {
		// First, get the raw search results using permission-aware query
		const searchResult = await queryTeamMemory({
			question,
			context,
			scope,
			limit: 20,
			useCache: true,
			projectPath,
		});

		// If no results, return early
		if (searchResult.citations.length === 0) {
			return {
				sessionId,
				answer: searchResult.answer,
				confidence: "low",
				citations: [],
				sessionsSearched: searchResult.sessionsSearched,
				privacyNotes: ["No accessible content found for this query"],
				success: true,
			};
		}

		// Build context for the agent
		const searchContext = searchResult.citations
			.map(
				(c, i) =>
					`[${i + 1}] Source: ${c.source} (visibility: ${c.visibility})\n` +
					`Excerpt: ${c.excerpt}\n`,
			)
			.join("\n");

		// Build the agent prompt
		const agentPrompt = `${TEAM_MEMORY_AGENT_PROMPT}

## User Question
${question}

## Search Results (${searchResult.citations.length} results from ${searchResult.sessionsSearched} sessions)
${searchContext}

## Instructions
Based on these search results:
1. Synthesize a clear, helpful answer
2. Include citations for each claim using [number] format
3. Note any privacy concerns in privacyNotes
4. Set confidence based on source quality and coverage

IMPORTANT: Only use information from the search results provided. Do not make up information.`;

		// Find Claude executable
		const claudePath = findClaudeExecutable();

		// Configure agent options
		const options: Options = {
			model,
			pathToClaudeCodeExecutable: claudePath,
			mcpServers: {}, // No MCP tools - we pre-fetched the results
			allowedTools: [], // No tools allowed - just synthesis
			outputFormat: {
				type: "json_schema",
				schema: TEAM_MEMORY_AGENT_OUTPUT_SCHEMA,
			},
		};

		// Run the agent
		const agent = query({
			prompt: agentPrompt,
			options,
		});

		let responseText = "";

		for await (const message of agent) {
			if (message.type === "assistant" && message.message?.content) {
				for (const block of message.message.content) {
					if (block.type === "text") {
						responseText += block.text;
					}
				}
			}
		}

		// Parse the structured response
		interface AgentResponse {
			answer: string;
			confidence: "high" | "medium" | "low";
			citations: Array<{
				source: string;
				excerpt: string;
				visibility: "public" | "team" | "private";
			}>;
			privacyNotes?: string[];
		}

		let agentResponse: AgentResponse | null = null;
		try {
			agentResponse = JSON.parse(responseText) as AgentResponse;
		} catch {
			console.warn(
				"[TeamMemoryAgent] Response was not valid JSON, using fallback",
			);
		}

		if (agentResponse) {
			// Map agent citations back to full citations with session IDs
			const enrichedCitations: TeamCitation[] = agentResponse.citations.map(
				(agentCitation) => {
					// Try to find the matching original citation
					const original = searchResult.citations.find(
						(c) =>
							c.source === agentCitation.source ||
							agentCitation.source.includes(c.sessionId || ""),
					);

					return {
						source: agentCitation.source,
						excerpt: agentCitation.excerpt,
						sessionId: original?.sessionId,
						visibility: agentCitation.visibility,
						author: original?.author,
						timestamp: original?.timestamp,
					};
				},
			);

			return {
				sessionId,
				answer: agentResponse.answer,
				confidence: agentResponse.confidence,
				citations: enrichedCitations,
				sessionsSearched: searchResult.sessionsSearched,
				privacyNotes: agentResponse.privacyNotes || [],
				success: true,
			};
		}

		// Fallback: use the search result directly
		return {
			sessionId,
			answer: searchResult.answer,
			confidence: searchResult.confidence,
			citations: searchResult.citations,
			sessionsSearched: searchResult.sessionsSearched,
			privacyNotes: [],
			success: true,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		return {
			sessionId,
			answer: `Team memory query failed: ${errorMessage}`,
			confidence: "low",
			citations: [],
			sessionsSearched: 0,
			privacyNotes: [],
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Format team memory agent result for display
 */
export function formatTeamMemoryAgentResult(
	result: TeamMemoryAgentResponse,
): string {
	const lines: string[] = [];

	// Confidence indicator
	const indicator =
		result.confidence === "high"
			? "[HIGH]"
			: result.confidence === "medium"
				? "[MEDIUM]"
				: "[LOW]";

	lines.push(`${indicator} Confidence: ${result.confidence}`);
	lines.push("");

	// Answer
	lines.push("## Answer");
	lines.push(result.answer);
	lines.push("");

	// Citations
	if (result.citations.length > 0) {
		lines.push("## Sources");
		for (const citation of result.citations.slice(0, 5)) {
			const visibility = `[${citation.visibility}]`;
			const author = citation.author ? ` by ${citation.author}` : "";
			const date = citation.timestamp
				? ` (${new Date(citation.timestamp).toLocaleDateString()})`
				: "";

			lines.push(`- ${visibility} **${citation.source}**${author}${date}`);
			if (citation.excerpt) {
				lines.push(`  > ${citation.excerpt.slice(0, 150)}...`);
			}
		}
		lines.push("");
	}

	// Privacy notes
	if (result.privacyNotes.length > 0) {
		lines.push("## Privacy Notes");
		for (const note of result.privacyNotes) {
			lines.push(`- ${note}`);
		}
		lines.push("");
	}

	// Stats
	lines.push(`*Searched ${result.sessionsSearched} sessions*`);

	return lines.join("\n");
}
