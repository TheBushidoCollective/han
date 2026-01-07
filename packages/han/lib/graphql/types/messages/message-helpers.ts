/**
 * GraphQL Message Helper Functions
 *
 * Shared utilities for parsing message content and metadata.
 */

/**
 * Content block types from Claude API
 */
export interface ContentBlock {
	type: string;
	text?: string;
	name?: string;
	input?: Record<string, unknown>;
}

/**
 * Extract text content from a message
 */
export function getMessageText(content: string | ContentBlock[] | undefined): {
	text: string;
	isToolOnly: boolean;
} {
	if (!content) return { text: "", isToolOnly: false };

	if (typeof content === "string") {
		return { text: content, isToolOnly: false };
	}

	if (Array.isArray(content)) {
		const textParts = content
			.filter((c) => c.type === "text" && c.text)
			.map((c) => c.text || "");

		if (textParts.length > 0) {
			return { text: textParts.join("\n"), isToolOnly: false };
		}

		const toolUses = content.filter((c) => c.type === "tool_use" && c.name);
		if (toolUses.length > 0) {
			const toolSummary = toolUses
				.map((t) => {
					const name = t.name || "unknown";
					const input = t.input || {};
					const detail =
						input.file_path || input.command || input.pattern || "";
					return detail ? `${name}: ${String(detail)}` : name;
				})
				.join("\n");
			return { text: toolSummary, isToolOnly: true };
		}

		const hasThinking = content.some((c) => c.type === "thinking");
		if (hasThinking) {
			return { text: "", isToolOnly: true };
		}
	}

	return { text: "", isToolOnly: false };
}

/**
 * Parse raw JSON to extract user message metadata
 */
export interface UserMessageMetadata {
	isMeta: boolean;
	isInterrupt: boolean;
	isCommand: boolean;
	commandName: string | null;
}

export function parseUserMetadata(
	rawJson: string | undefined,
): UserMessageMetadata {
	const defaults: UserMessageMetadata = {
		isMeta: false,
		isInterrupt: false,
		isCommand: false,
		commandName: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		if (parsed.isMeta) defaults.isMeta = true;

		const content = parsed.message?.content;
		if (
			typeof content === "string" &&
			content.includes("[Request interrupted")
		) {
			defaults.isInterrupt = true;
		}
		if (Array.isArray(content)) {
			const textBlock = content.find(
				(c: ContentBlock) =>
					c.type === "text" && c.text?.includes("[Request interrupted"),
			);
			if (textBlock) defaults.isInterrupt = true;
		}

		if (typeof content === "string" && content.includes("<command-name>")) {
			defaults.isCommand = true;
			const match = content.match(/<command-name>([^<]+)<\/command-name>/);
			if (match) defaults.commandName = match[1];
		}

		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract assistant message metadata
 */
export interface AssistantMessageMetadata {
	model: string | null;
	hasThinking: boolean;
	thinkingCount: number;
	hasToolUse: boolean;
	toolUseCount: number;
	inputTokens: number | null;
	outputTokens: number | null;
	cachedTokens: number | null;
}

export function parseAssistantMetadata(
	rawJson: string | undefined,
): AssistantMessageMetadata {
	const defaults: AssistantMessageMetadata = {
		model: null,
		hasThinking: false,
		thinkingCount: 0,
		hasToolUse: false,
		toolUseCount: 0,
		inputTokens: null,
		outputTokens: null,
		cachedTokens: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);

		if (parsed.message?.model) {
			defaults.model = parsed.message.model;
		}

		const content = parsed.message?.content;
		if (Array.isArray(content)) {
			for (const block of content) {
				if (block.type === "thinking") {
					defaults.hasThinking = true;
					defaults.thinkingCount++;
				}
				if (block.type === "tool_use") {
					defaults.hasToolUse = true;
					defaults.toolUseCount++;
				}
			}
		}

		const usage = parsed.message?.usage;
		if (usage) {
			defaults.inputTokens = usage.input_tokens ?? null;
			defaults.outputTokens = usage.output_tokens ?? null;
			defaults.cachedTokens =
				(usage.cache_read_input_tokens ?? 0) +
					(usage.cache_creation_input_tokens ?? 0) || null;
		}

		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract system message metadata
 */
export interface SystemMessageMetadata {
	subtype: string | null;
	level: string | null;
	isMeta: boolean;
}

export function parseSystemMetadata(
	rawJson: string | undefined,
): SystemMessageMetadata {
	const defaults: SystemMessageMetadata = {
		subtype: null,
		level: null,
		isMeta: false,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		defaults.subtype = parsed.subtype ?? null;
		defaults.level = parsed.level ?? null;
		defaults.isMeta = parsed.isMeta ?? false;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract file history snapshot metadata
 */
export interface FileHistorySnapshotMetadata {
	messageId: string | null;
	isSnapshotUpdate: boolean;
	fileCount: number;
	snapshotTimestamp: Date | null;
}

export function parseFileHistorySnapshotMetadata(
	rawJson: string | undefined,
): FileHistorySnapshotMetadata {
	const defaults: FileHistorySnapshotMetadata = {
		messageId: null,
		isSnapshotUpdate: false,
		fileCount: 0,
		snapshotTimestamp: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		defaults.messageId = parsed.messageId ?? null;
		defaults.isSnapshotUpdate = parsed.isSnapshotUpdate ?? false;

		const snapshot = parsed.snapshot;
		if (snapshot) {
			if (Array.isArray(snapshot.trackedFileBackups)) {
				defaults.fileCount = snapshot.trackedFileBackups.length;
			}
			if (snapshot.timestamp) {
				defaults.snapshotTimestamp = new Date(snapshot.timestamp);
			}
		}

		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract hook run metadata
 */
export interface HookRunMetadata {
	/** UUID of the hook_run event (used to correlate with hook_result) */
	hookRunId: string | null;
	plugin: string | null;
	hook: string | null;
	/** Full directory path (cwd + relative directory, or just cwd if directory is ".") */
	directory: string | null;
	cached: boolean;
}

export function parseHookRunMetadata(
	rawJson: string | undefined,
): HookRunMetadata {
	const defaults: HookRunMetadata = {
		hookRunId: null,
		plugin: null,
		hook: null,
		directory: null,
		cached: false,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		// The uuid field of the hook_run event IS the hookRunId
		defaults.hookRunId = parsed.uuid ?? null;
		defaults.plugin = data.plugin ?? null;
		defaults.hook = data.hook ?? null;

		// Build full directory path from cwd and relative directory
		// If directory is "." or not set, use cwd directly
		const cwd = parsed.cwd ?? null;
		const relativeDir = data.directory ?? null;
		if (relativeDir && relativeDir !== "." && cwd) {
			// Join cwd with relative directory
			defaults.directory = `${cwd}/${relativeDir}`;
		} else {
			// Use cwd for "." or when no relative dir
			defaults.directory = cwd ?? relativeDir;
		}

		defaults.cached = data.cached ?? false;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract hook result metadata
 */
export interface HookResultMetadata {
	plugin: string | null;
	hook: string | null;
	directory: string | null;
	cached: boolean;
	durationMs: number | null;
	exitCode: number | null;
	success: boolean;
	output: string | null;
	error: string | null;
}

export function parseHookResultMetadata(
	rawJson: string | undefined,
): HookResultMetadata {
	const defaults: HookResultMetadata = {
		plugin: null,
		hook: null,
		directory: null,
		cached: false,
		durationMs: null,
		exitCode: null,
		success: false,
		output: null,
		error: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		defaults.hook = data.hook ?? null;
		defaults.directory = data.directory ?? null;
		defaults.cached = data.cached ?? false;
		defaults.durationMs = data.duration_ms ?? null;
		defaults.exitCode = data.exit_code ?? null;
		defaults.success = data.success ?? false;
		defaults.output = data.output ?? null;
		defaults.error = data.error ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract hook reference metadata
 */
export interface HookReferenceMetadata {
	plugin: string | null;
	filePath: string | null;
	reason: string | null;
	success: boolean;
	durationMs: number | null;
}

export function parseHookReferenceMetadata(
	rawJson: string | undefined,
): HookReferenceMetadata {
	const defaults: HookReferenceMetadata = {
		plugin: null,
		filePath: null,
		reason: null,
		success: false,
		durationMs: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		defaults.filePath = data.file_path ?? null;
		defaults.reason = data.reason ?? null;
		defaults.success = data.success ?? false;
		defaults.durationMs = data.duration_ms ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract hook validation metadata
 */
export interface HookValidationMetadata {
	plugin: string | null;
	hook: string | null;
	directory: string | null;
	cached: boolean;
	durationMs: number | null;
	exitCode: number | null;
	success: boolean;
	output: string | null;
	error: string | null;
}

export function parseHookValidationMetadata(
	rawJson: string | undefined,
): HookValidationMetadata {
	const defaults: HookValidationMetadata = {
		plugin: null,
		hook: null,
		directory: null,
		cached: false,
		durationMs: null,
		exitCode: null,
		success: false,
		output: null,
		error: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		// Extract just the base hook name (e.g., "typecheck" from "typecheck_packages_browse-client")
		const rawHook = data.hook ?? null;
		if (rawHook && data.directory) {
			// Remove directory suffix if present (e.g., "_packages_browse-client")
			const dirSuffix = `_${(data.directory as string).replace(/\//g, "_")}`;
			if (rawHook.endsWith(dirSuffix)) {
				defaults.hook = rawHook.slice(0, -dirSuffix.length);
			} else {
				defaults.hook = rawHook;
			}
		} else {
			defaults.hook = rawHook;
		}
		defaults.directory = data.directory ?? null;
		defaults.cached = data.cached ?? false;
		defaults.durationMs = data.duration_ms ?? null;
		defaults.exitCode = data.exit_code ?? null;
		defaults.success = data.success ?? false;
		defaults.output = data.output ?? null;
		defaults.error = data.error ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract hook validation cache metadata
 */
export interface HookValidationCacheMetadata {
	plugin: string | null;
	hook: string | null;
	directory: string | null;
	fileCount: number;
}

export function parseHookValidationCacheMetadata(
	rawJson: string | undefined,
): HookValidationCacheMetadata {
	const defaults: HookValidationCacheMetadata = {
		plugin: null,
		hook: null,
		directory: null,
		fileCount: 0,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		// Extract just the base hook name (e.g., "typecheck" from "typecheck_packages_browse-client")
		const rawHook = data.hook ?? null;
		if (rawHook && data.directory) {
			// Remove directory suffix if present (e.g., "_packages_browse-client")
			const dirSuffix = `_${data.directory.replace(/\//g, "_")}`;
			if (rawHook.endsWith(dirSuffix)) {
				defaults.hook = rawHook.slice(0, -dirSuffix.length);
			} else {
				defaults.hook = rawHook;
			}
		} else {
			defaults.hook = rawHook;
		}
		defaults.directory = data.directory ?? null;
		defaults.fileCount = Object.keys(data.files ?? {}).length;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract hook script metadata
 */
export interface HookScriptMetadata {
	plugin: string | null;
	command: string | null;
	durationMs: number | null;
	exitCode: number | null;
	success: boolean;
	output: string | null;
}

export function parseHookScriptMetadata(
	rawJson: string | undefined,
): HookScriptMetadata {
	const defaults: HookScriptMetadata = {
		plugin: null,
		command: null,
		durationMs: null,
		exitCode: null,
		success: false,
		output: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		defaults.command = data.command ?? null;
		defaults.durationMs = data.duration_ms ?? null;
		defaults.exitCode = data.exit_code ?? null;
		defaults.success = data.success ?? false;
		defaults.output = data.output ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract hook datetime metadata
 */
export interface HookDatetimeMetadata {
	plugin: string | null;
	datetime: string | null;
	durationMs: number | null;
}

export function parseHookDatetimeMetadata(
	rawJson: string | undefined,
): HookDatetimeMetadata {
	const defaults: HookDatetimeMetadata = {
		plugin: null,
		datetime: null,
		durationMs: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.plugin = data.plugin ?? null;
		defaults.datetime = data.datetime ?? null;
		defaults.durationMs = data.duration_ms ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract hook file change metadata
 */
export interface HookFileChangeMetadata {
	sessionId: string | null;
	toolName: string | null;
	filePath: string | null;
}

export function parseHookFileChangeMetadata(
	rawJson: string | undefined,
): HookFileChangeMetadata {
	const defaults: HookFileChangeMetadata = {
		sessionId: null,
		toolName: null,
		filePath: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.sessionId = data.session_id ?? null;
		defaults.toolName = data.tool_name ?? null;
		defaults.filePath = data.file_path ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract queue operation metadata
 */
export interface QueueOperationMetadata {
	operation: string | null;
	queueSessionId: string | null;
}

export function parseQueueOperationMetadata(
	rawJson: string | undefined,
): QueueOperationMetadata {
	const defaults: QueueOperationMetadata = {
		operation: null,
		queueSessionId: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		defaults.operation = parsed.operation ?? null;
		defaults.queueSessionId = parsed.sessionId ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract MCP tool call metadata
 */
export interface McpToolCallMetadata {
	tool: string | null;
	server: string | null;
	prefixedName: string | null;
	input: string | null;
	callId: string | null;
}

export function parseMcpToolCallMetadata(
	rawJson: string | undefined,
): McpToolCallMetadata {
	const defaults: McpToolCallMetadata = {
		tool: null,
		server: null,
		prefixedName: null,
		input: null,
		callId: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.tool = data.tool ?? null;
		defaults.server = data.server ?? null;
		defaults.prefixedName = data.prefixed_name ?? null;
		defaults.callId = data.call_id ?? null;
		if (data.input) {
			defaults.input =
				typeof data.input === "string"
					? data.input
					: JSON.stringify(data.input);
		}
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract MCP tool result metadata
 */
export interface McpToolResultMetadata {
	tool: string | null;
	server: string | null;
	prefixedName: string | null;
	durationMs: number | null;
	success: boolean;
	output: string | null;
	error: string | null;
}

export function parseMcpToolResultMetadata(
	rawJson: string | undefined,
): McpToolResultMetadata {
	const defaults: McpToolResultMetadata = {
		tool: null,
		server: null,
		prefixedName: null,
		durationMs: null,
		success: false,
		output: null,
		error: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.tool = data.tool ?? null;
		defaults.server = data.server ?? null;
		defaults.prefixedName = data.prefixed_name ?? null;
		defaults.durationMs = data.duration_ms ?? null;
		defaults.success = data.success ?? false;
		defaults.output = data.output ?? null;
		defaults.error = data.error ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract memory query metadata
 */
export interface MemoryQueryMetadata {
	question: string | null;
	route: string | null;
	durationMs: number | null;
	resultCount: number | null;
}

export function parseMemoryQueryMetadata(
	rawJson: string | undefined,
): MemoryQueryMetadata {
	const defaults: MemoryQueryMetadata = {
		question: null,
		route: null,
		durationMs: null,
		resultCount: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.question = data.question ?? null;
		defaults.route = data.route ?? null;
		defaults.durationMs = data.duration_ms ?? null;
		defaults.resultCount = data.result_count ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract memory learn metadata
 */
export interface MemoryLearnMetadata {
	domain: string | null;
	scope: string | null;
	paths: string[] | null;
	append: boolean;
}

export function parseMemoryLearnMetadata(
	rawJson: string | undefined,
): MemoryLearnMetadata {
	const defaults: MemoryLearnMetadata = {
		domain: null,
		scope: null,
		paths: null,
		append: true,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.domain = data.domain ?? null;
		defaults.scope = data.scope ?? null;
		defaults.paths = Array.isArray(data.paths) ? data.paths : null;
		defaults.append = data.append ?? true;
		return defaults;
	} catch {
		return defaults;
	}
}

/**
 * Parse raw JSON to extract sentiment analysis metadata
 */
export interface SentimentAnalysisMetadata {
	sentimentScore: number;
	sentimentLevel: string;
	frustrationScore: number | null;
	frustrationLevel: string | null;
	signals: string[];
	analyzedMessageId: string | null;
}

export function parseSentimentAnalysisMetadata(
	rawJson: string | undefined,
): SentimentAnalysisMetadata {
	const defaults: SentimentAnalysisMetadata = {
		sentimentScore: 0,
		sentimentLevel: "neutral",
		frustrationScore: null,
		frustrationLevel: null,
		signals: [],
		analyzedMessageId: null,
	};

	if (!rawJson) return defaults;

	try {
		const parsed = JSON.parse(rawJson);
		const data = parsed.data ?? parsed;
		defaults.sentimentScore = data.sentiment_score ?? 0;
		defaults.sentimentLevel = data.sentiment_level ?? "neutral";
		defaults.frustrationScore = data.frustration_score ?? null;
		defaults.frustrationLevel = data.frustration_level ?? null;
		defaults.signals = Array.isArray(data.signals) ? data.signals : [];
		defaults.analyzedMessageId = data.message_id ?? null;
		return defaults;
	} catch {
		return defaults;
	}
}
