/**
 * Session Summary Generator
 *
 * Uses Claude Haiku to generate semantic summaries of Claude Code sessions.
 * Extracts topics, files modified, tools used, and outcome assessment.
 */

import Anthropic from "@anthropic-ai/sdk";
import { homedir } from "node:os";
import { join } from "node:path";
import { tryGetNativeModule } from "../native.ts";

/**
 * Generated summary structure
 */
export interface GeneratedSummary {
	summaryText: string; // 2-3 sentences
	topics: string[]; // 3-7 keywords
	filesModified: string[];
	toolsUsed: string[];
	outcome: "completed" | "partial" | "abandoned";
}

/**
 * Options for summary generation
 */
export interface SummaryGenerationOptions {
	/** Maximum messages to include in transcript (default: 100) */
	maxMessages?: number;
	/** Whether to include tool inputs in transcript (default: false for privacy) */
	includeToolInputs?: boolean;
}

/**
 * Summary generation prompt for Haiku
 */
const SUMMARY_PROMPT = `Analyze this Claude Code session and provide:
1. A 2-3 sentence summary of what was accomplished
2. 3-7 topic keywords/tags (lowercase, hyphenated)
3. Outcome: 'completed' (task finished successfully), 'partial' (work in progress or partial success), or 'abandoned' (user stopped mid-task or gave up)

Session transcript (last messages):
{transcript}

Files modified during session: {files}
Tools used during session: {tools}

Respond ONLY with valid JSON in this exact format:
{"summary": "2-3 sentence summary here", "topics": ["topic-1", "topic-2"], "outcome": "completed|partial|abandoned"}`;

/**
 * Validate API key format
 * Anthropic API keys typically start with sk-ant- and are 40+ characters
 */
function isValidApiKeyFormat(apiKey: string): boolean {
	// Must be a non-empty string with reasonable length
	if (!apiKey || apiKey.length < 20) return false;

	// Anthropic keys start with sk-ant- (public) or similar patterns
	// Allow any sk- prefix for flexibility with different key types
	if (apiKey.startsWith("sk-")) return true;

	// Also accept test keys that might use different patterns
	return /^[a-zA-Z0-9_-]{20,}$/.test(apiKey);
}

/**
 * Build a transcript summary for LLM analysis
 */
function buildTranscriptForSummary(
	messages: Array<{
		role?: string;
		messageType: string;
		content?: string;
		toolName?: string;
		toolResult?: string;
	}>,
	includeToolInputs = false,
): string {
	const lines: string[] = [];

	for (const msg of messages) {
		if (msg.messageType === "user" && msg.content) {
			// User messages - include full content
			lines.push(`User: ${msg.content.slice(0, 500)}`);
		} else if (msg.messageType === "assistant" && msg.content) {
			// Assistant text responses
			lines.push(`Assistant: ${msg.content.slice(0, 500)}`);
		} else if (msg.messageType === "tool_use" && msg.toolName) {
			// Tool usage
			lines.push(`Tool: ${msg.toolName}`);
		} else if (msg.messageType === "tool_result" && msg.toolResult) {
			// Tool results - truncate for privacy
			const result = msg.toolResult.slice(0, 200);
			lines.push(`Result: ${result}${msg.toolResult.length > 200 ? "..." : ""}`);
		}
	}

	// Limit total transcript size for Haiku
	const transcript = lines.join("\n");
	if (transcript.length > 8000) {
		return `${transcript.slice(0, 8000)}...\n[truncated]`;
	}
	return transcript;
}

/**
 * Parse LLM response into GeneratedSummary
 */
function parseSummaryResponse(
	response: Anthropic.Message,
	filesModified: string[],
	toolsUsed: string[],
): GeneratedSummary {
	const text =
		response.content[0].type === "text" ? response.content[0].text : "";

	try {
		// Extract JSON from response (may have extra text)
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error("No JSON found in response");
		}

		const parsed = JSON.parse(jsonMatch[0]) as {
			summary?: string;
			topics?: string[];
			outcome?: string;
		};

		// Validate and normalize outcome
		let outcome: "completed" | "partial" | "abandoned" = "partial";
		if (
			parsed.outcome === "completed" ||
			parsed.outcome === "partial" ||
			parsed.outcome === "abandoned"
		) {
			outcome = parsed.outcome;
		}

		return {
			summaryText: parsed.summary || "Session summary unavailable.",
			topics: (parsed.topics || [])
				.slice(0, 7)
				.map((t: string) => t.toLowerCase().replace(/\s+/g, "-")),
			filesModified,
			toolsUsed,
			outcome,
		};
	} catch (error) {
		console.error("[summary-generator] Failed to parse response:", error);
		// Return a default summary
		return {
			summaryText: text.slice(0, 300) || "Session summary unavailable.",
			topics: [],
			filesModified,
			toolsUsed,
			outcome: "partial",
		};
	}
}

/**
 * Extract unique tool names from messages
 */
function extractToolsUsed(
	messages: Array<{ toolName?: string; messageType: string }>,
): string[] {
	const tools = new Set<string>();
	for (const msg of messages) {
		if (msg.messageType === "tool_use" && msg.toolName) {
			tools.add(msg.toolName);
		}
	}
	return Array.from(tools);
}

/**
 * Generate a session summary using Claude Haiku
 */
export async function generateSessionSummary(
	sessionId: string,
	options: SummaryGenerationOptions = {},
): Promise<GeneratedSummary> {
	const { maxMessages = 100, includeToolInputs = false } = options;

	const nativeModule = tryGetNativeModule();
	if (!nativeModule) {
		throw new Error("Native module not available");
	}

	const dbPath = join(homedir(), ".claude", "han", "han.db");

	// Get session messages (most recent first, then we'll reverse)
	const messages = nativeModule.listSessionMessages(
		dbPath,
		sessionId,
		null, // No type filter
		null, // All messages (main + agents)
		maxMessages,
		0,
	);

	if (messages.length === 0) {
		return {
			summaryText: "Empty session - no messages found.",
			topics: [],
			filesModified: [],
			toolsUsed: [],
			outcome: "abandoned",
		};
	}

	// Get file changes for the session
	const fileChanges = nativeModule.getSessionFileChanges(dbPath, sessionId);
	const filesModified = [...new Set(fileChanges.map((f) => f.filePath))];

	// Extract tools used
	const toolsUsed = extractToolsUsed(messages);

	// Build transcript for LLM
	// Reverse to get chronological order (messages come newest first)
	const chronologicalMessages = [...messages].reverse();
	const transcript = buildTranscriptForSummary(
		chronologicalMessages,
		includeToolInputs,
	);

	// Check for API key and validate format
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey || !isValidApiKeyFormat(apiKey)) {
		// Return a basic summary without LLM
		if (process.env.HAN_DEBUG && apiKey && !isValidApiKeyFormat(apiKey)) {
			console.warn("[summary] ANTHROPIC_API_KEY appears malformed - expected sk-ant-* or similar format");
		}
		return {
			summaryText: `Session with ${messages.length} messages. ${filesModified.length} files modified.`,
			topics: toolsUsed.slice(0, 5).map((t) => t.toLowerCase()),
			filesModified,
			toolsUsed,
			outcome: "partial",
		};
	}

	// Call Haiku for fast, cheap summarization
	const client = new Anthropic({ apiKey });
	const response = await client.messages.create({
		model: "claude-3-5-haiku-20241022",
		max_tokens: 500,
		messages: [
			{
				role: "user",
				content: SUMMARY_PROMPT.replace("{transcript}", transcript)
					.replace("{files}", JSON.stringify(filesModified.slice(0, 20)))
					.replace("{tools}", JSON.stringify(toolsUsed)),
			},
		],
	});

	return parseSummaryResponse(response, filesModified, toolsUsed);
}

/**
 * Save a generated summary to the database
 */
export async function saveGeneratedSummary(
	sessionId: string,
	summary: GeneratedSummary,
	messageCount?: number,
	durationSeconds?: number,
): Promise<void> {
	const nativeModule = tryGetNativeModule();
	if (!nativeModule) {
		throw new Error("Native module not available");
	}

	const dbPath = join(homedir(), ".claude", "han", "han.db");

	nativeModule.upsertGeneratedSummary(dbPath, {
		sessionId,
		summaryText: summary.summaryText,
		topics: summary.topics,
		filesModified: summary.filesModified.length > 0 ? summary.filesModified : undefined,
		toolsUsed: summary.toolsUsed.length > 0 ? summary.toolsUsed : undefined,
		outcome: summary.outcome,
		messageCount: messageCount,
		durationSeconds: durationSeconds,
	});
}
