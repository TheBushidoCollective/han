/**
 * GraphQL Activity types
 *
 * Represents activity metrics for dashboard visualizations including:
 * - Daily activity heatmap (GitHub-style contribution chart)
 * - Hourly activity distribution (time-of-day patterns)
 * - Token usage and cost statistics
 * - Model usage trends from Claude Code stats-cache.json
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { listSessions, messages } from "../../db/index.ts";
import { builder } from "../builder.ts";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Activity for a single day (for heatmap)
 */
export interface DailyActivity {
	date: string; // YYYY-MM-DD format
	sessionCount: number;
	messageCount: number;
	inputTokens: number;
	outputTokens: number;
	cachedTokens: number;
	linesAdded: number;
	linesRemoved: number;
	filesChanged: number;
}

/**
 * Activity for an hour of the day (0-23)
 */
export interface HourlyActivity {
	hour: number; // 0-23
	sessionCount: number;
	messageCount: number;
}

/**
 * Token usage statistics
 */
export interface TokenUsageStats {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCachedTokens: number;
	totalTokens: number;
	estimatedCostUsd: number;
	messageCount: number;
	sessionCount: number;
}

/**
 * Daily token usage by model (from stats-cache.json)
 */
export interface DailyModelTokens {
	date: string; // YYYY-MM-DD format
	tokensByModel: Record<string, number>;
}

/**
 * Cumulative model usage stats (from stats-cache.json)
 */
export interface ModelUsageStats {
	model: string;
	displayName: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheCreationTokens: number;
	totalTokens: number;
}

/**
 * Activity data container
 */
export interface ActivityData {
	dailyActivity: DailyActivity[];
	hourlyActivity: HourlyActivity[];
	tokenUsage: TokenUsageStats;
	streakDays: number;
	totalActiveDays: number;
	// Model usage from stats-cache.json (long-lived data)
	dailyModelTokens: DailyModelTokens[];
	modelUsage: ModelUsageStats[];
	totalSessions: number;
	totalMessages: number;
	firstSessionDate: string | null;
}

// =============================================================================
// GraphQL Type Implementations
// =============================================================================

const DailyActivityRef = builder.objectRef<DailyActivity>("DailyActivity");

export const DailyActivityType = DailyActivityRef.implement({
	description: "Activity metrics for a single day",
	fields: (t) => ({
		date: t.exposeString("date", {
			description: "Date in YYYY-MM-DD format",
		}),
		sessionCount: t.exposeInt("sessionCount", {
			description: "Number of sessions started on this day",
		}),
		messageCount: t.exposeInt("messageCount", {
			description: "Number of messages sent on this day",
		}),
		inputTokens: t.field({
			type: "BigInt",
			description: "Total input tokens used",
			resolve: (data) => data.inputTokens,
		}),
		outputTokens: t.field({
			type: "BigInt",
			description: "Total output tokens generated",
			resolve: (data) => data.outputTokens,
		}),
		cachedTokens: t.field({
			type: "BigInt",
			description: "Total cached tokens used",
			resolve: (data) => data.cachedTokens,
		}),
		linesAdded: t.exposeInt("linesAdded", {
			description: "Lines of code added",
		}),
		linesRemoved: t.exposeInt("linesRemoved", {
			description: "Lines of code removed",
		}),
		filesChanged: t.exposeInt("filesChanged", {
			description: "Number of files changed",
		}),
	}),
});

const HourlyActivityRef = builder.objectRef<HourlyActivity>("HourlyActivity");

export const HourlyActivityType = HourlyActivityRef.implement({
	description: "Activity metrics for an hour of the day",
	fields: (t) => ({
		hour: t.exposeInt("hour", {
			description: "Hour of day (0-23)",
		}),
		sessionCount: t.exposeInt("sessionCount", {
			description: "Number of sessions started in this hour",
		}),
		messageCount: t.exposeInt("messageCount", {
			description: "Number of messages sent in this hour",
		}),
	}),
});

const TokenUsageStatsRef =
	builder.objectRef<TokenUsageStats>("TokenUsageStats");

export const TokenUsageStatsType = TokenUsageStatsRef.implement({
	description: "Aggregate token usage statistics",
	fields: (t) => ({
		totalInputTokens: t.field({
			type: "BigInt",
			description: "Total input tokens across all messages",
			resolve: (data) => data.totalInputTokens,
		}),
		totalOutputTokens: t.field({
			type: "BigInt",
			description: "Total output tokens generated",
			resolve: (data) => data.totalOutputTokens,
		}),
		totalCachedTokens: t.field({
			type: "BigInt",
			description: "Total cached tokens used",
			resolve: (data) => data.totalCachedTokens,
		}),
		totalTokens: t.field({
			type: "BigInt",
			description: "Total tokens (input + output)",
			resolve: (data) => data.totalTokens,
		}),
		estimatedCostUsd: t.exposeFloat("estimatedCostUsd", {
			description: "Estimated cost in USD based on Claude pricing",
		}),
		messageCount: t.exposeInt("messageCount", {
			description: "Number of messages with token data",
		}),
		sessionCount: t.exposeInt("sessionCount", {
			description: "Number of unique sessions",
		}),
	}),
});

/**
 * Token entry for a specific model on a given day
 */
interface ModelTokenEntry {
	model: string;
	displayName: string;
	tokens: number;
}

const ModelTokenEntryRef =
	builder.objectRef<ModelTokenEntry>("ModelTokenEntry");

export const ModelTokenEntryType = ModelTokenEntryRef.implement({
	description: "Token usage for a specific model",
	fields: (t) => ({
		model: t.exposeString("model", {
			description: "Model ID (e.g., claude-opus-4-5-20251101)",
		}),
		displayName: t.exposeString("displayName", {
			description: "Human-readable model name (e.g., Opus 4.5)",
		}),
		tokens: t.field({
			type: "BigInt",
			description: "Token count for this model",
			resolve: (data) => data.tokens,
		}),
	}),
});

/**
 * Daily model tokens with parsed entries
 */
interface DailyModelTokensParsed {
	date: string;
	models: ModelTokenEntry[];
	totalTokens: number;
}

const DailyModelTokensRef =
	builder.objectRef<DailyModelTokensParsed>("DailyModelTokens");

export const DailyModelTokensType = DailyModelTokensRef.implement({
	description: "Daily token usage broken down by model",
	fields: (t) => ({
		date: t.exposeString("date", {
			description: "Date in YYYY-MM-DD format",
		}),
		models: t.field({
			type: [ModelTokenEntryType],
			description: "Token usage per model for this day",
			resolve: (data) => data.models,
		}),
		totalTokens: t.field({
			type: "BigInt",
			description: "Total tokens across all models for this day",
			resolve: (data) => data.totalTokens,
		}),
	}),
});

const ModelUsageStatsRef =
	builder.objectRef<ModelUsageStats>("ModelUsageStats");

export const ModelUsageStatsType = ModelUsageStatsRef.implement({
	description: "Cumulative usage statistics for a model",
	fields: (t) => ({
		model: t.exposeString("model", {
			description: "Model ID",
		}),
		displayName: t.exposeString("displayName", {
			description: "Human-readable model name",
		}),
		inputTokens: t.field({
			type: "BigInt",
			description: "Total input tokens",
			resolve: (data) => data.inputTokens,
		}),
		outputTokens: t.field({
			type: "BigInt",
			description: "Total output tokens",
			resolve: (data) => data.outputTokens,
		}),
		cacheReadTokens: t.field({
			type: "BigInt",
			description: "Total cache read tokens",
			resolve: (data) => data.cacheReadTokens,
		}),
		cacheCreationTokens: t.field({
			type: "BigInt",
			description: "Total cache creation tokens",
			resolve: (data) => data.cacheCreationTokens,
		}),
		totalTokens: t.field({
			type: "BigInt",
			description: "Total tokens (input + output)",
			resolve: (data) => data.totalTokens,
		}),
	}),
});

const ActivityDataRef = builder.objectRef<ActivityData>("ActivityData");

export const ActivityDataType = ActivityDataRef.implement({
	description: "Complete activity data for dashboard visualizations",
	fields: (t) => ({
		dailyActivity: t.field({
			type: [DailyActivityType],
			description: "Activity by day for heatmap (last 365 days)",
			resolve: (data) => data.dailyActivity,
		}),
		hourlyActivity: t.field({
			type: [HourlyActivityType],
			description: "Activity by hour of day (0-23)",
			resolve: (data) => data.hourlyActivity,
		}),
		tokenUsage: t.field({
			type: TokenUsageStatsType,
			description: "Aggregate token usage statistics",
			resolve: (data) => data.tokenUsage,
		}),
		streakDays: t.exposeInt("streakDays", {
			description: "Current consecutive days with activity",
		}),
		totalActiveDays: t.exposeInt("totalActiveDays", {
			description: "Total number of days with activity",
		}),
		dailyModelTokens: t.field({
			type: [DailyModelTokensType],
			description:
				"Daily token usage by model (from Claude Code stats, survives session cleanup)",
			resolve: (data) =>
				data.dailyModelTokens.map((d) => ({
					date: d.date,
					models: Object.entries(d.tokensByModel).map(([model, tokens]) => ({
						model,
						displayName: getModelDisplayName(model),
						tokens,
					})),
					totalTokens: Object.values(d.tokensByModel).reduce(
						(sum, t) => sum + t,
						0,
					),
				})),
		}),
		modelUsage: t.field({
			type: [ModelUsageStatsType],
			description:
				"Cumulative model usage (from Claude Code stats, survives session cleanup)",
			resolve: (data) => data.modelUsage,
		}),
		totalSessions: t.exposeInt("totalSessions", {
			description:
				"Total sessions from Claude Code stats (survives session cleanup)",
		}),
		totalMessages: t.exposeInt("totalMessages", {
			description:
				"Total messages from Claude Code stats (survives session cleanup)",
		}),
		firstSessionDate: t.exposeString("firstSessionDate", {
			description: "Date of first session",
			nullable: true,
		}),
	}),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert model ID to human-readable display name
 */
function getModelDisplayName(modelId: string): string {
	if (modelId.includes("opus-4-5")) return "Opus 4.5";
	if (modelId.includes("opus-4-1")) return "Opus 4.1";
	if (modelId.includes("opus-4-")) return "Opus 4";
	if (modelId.includes("sonnet-4-5")) return "Sonnet 4.5";
	if (modelId.includes("sonnet-4-")) return "Sonnet 4";
	if (modelId.includes("haiku-4-5")) return "Haiku 4.5";
	if (modelId.includes("haiku-4-")) return "Haiku 4";
	if (modelId.includes("sonnet-3-5")) return "Sonnet 3.5";
	if (modelId.includes("haiku-3-5")) return "Haiku 3.5";
	if (modelId.includes("opus-3")) return "Opus 3";
	// Fallback: extract model family from ID
	const parts = modelId.split("-");
	if (parts.length >= 2) {
		return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
	}
	return modelId;
}

/**
 * Stats cache data structure from ~/.claude/stats-cache.json
 */
interface StatsCache {
	version: number;
	lastComputedDate: string;
	dailyActivity: Array<{
		date: string;
		messageCount: number;
		sessionCount: number;
		toolCallCount: number;
	}>;
	dailyModelTokens: Array<{
		date: string;
		tokensByModel: Record<string, number>;
	}>;
	modelUsage: Record<
		string,
		{
			inputTokens: number;
			outputTokens: number;
			cacheReadInputTokens: number;
			cacheCreationInputTokens: number;
			webSearchRequests: number;
			costUSD: number;
			contextWindow: number;
		}
	>;
	totalSessions: number;
	totalMessages: number;
	longestSession?: {
		sessionId: string;
		duration: number;
		messageCount: number;
		timestamp: string;
	};
	firstSessionDate?: string;
	hourCounts?: Record<string, number>;
}

/**
 * Read and parse stats-cache.json from ~/.claude/
 */
function readStatsCache(): StatsCache | null {
	try {
		const statsPath = join(homedir(), ".claude", "stats-cache.json");
		if (!existsSync(statsPath)) {
			return null;
		}
		const content = readFileSync(statsPath, "utf-8");
		return JSON.parse(content) as StatsCache;
	} catch (error) {
		console.error("Error reading stats-cache.json:", error);
		return null;
	}
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Parse token usage from raw JSONL message
 */
function parseTokensFromRawJson(rawJson: string | null): {
	inputTokens: number;
	outputTokens: number;
	cachedTokens: number;
} {
	if (!rawJson) return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

	try {
		const parsed = JSON.parse(rawJson);
		const usage = parsed.message?.usage || parsed.usage;
		if (!usage) return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

		return {
			inputTokens: usage.input_tokens || 0,
			outputTokens: usage.output_tokens || 0,
			cachedTokens:
				usage.cache_read_input_tokens || usage.cache_creation_input_tokens || 0,
		};
	} catch {
		return { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
	}
}

/**
 * Calculate estimated cost based on Claude pricing
 * Using Claude 3.5 Sonnet pricing as reference:
 * - Input: $3 / 1M tokens
 * - Output: $15 / 1M tokens
 * - Cache read: $0.30 / 1M tokens
 */
function calculateCost(
	inputTokens: number,
	outputTokens: number,
	cachedTokens: number,
): number {
	const inputCost = (inputTokens / 1_000_000) * 3.0;
	const outputCost = (outputTokens / 1_000_000) * 15.0;
	const cacheCost = (cachedTokens / 1_000_000) * 0.3;
	return inputCost + outputCost + cacheCost;
}

/**
 * Parse line changes from raw JSON message content
 * Looks for Edit tool calls and counts lines added/removed
 */
function parseLineChangesFromRawJson(rawJson: string | null): {
	linesAdded: number;
	linesRemoved: number;
	filesChanged: Set<string>;
} {
	const result = {
		linesAdded: 0,
		linesRemoved: 0,
		filesChanged: new Set<string>(),
	};
	if (!rawJson) return result;

	try {
		const parsed = JSON.parse(rawJson);
		const content = parsed.message?.content || parsed.content || [];

		if (!Array.isArray(content)) return result;

		for (const block of content) {
			// Look for tool_use blocks with Edit or Write tools
			if (block.type === "tool_use") {
				const toolName = block.name?.toLowerCase() || "";
				const input = block.input || {};

				if (toolName === "edit" && input.file_path) {
					result.filesChanged.add(input.file_path);
					// Count lines in old_string and new_string
					const oldLines = (input.old_string || "").split("\n").length;
					const newLines = (input.new_string || "").split("\n").length;
					if (newLines > oldLines) {
						result.linesAdded += newLines - oldLines;
					} else if (oldLines > newLines) {
						result.linesRemoved += oldLines - newLines;
					}
					// Also count as changes if content differs
					if (input.old_string !== input.new_string) {
						result.linesAdded += Math.max(0, newLines);
						result.linesRemoved += Math.max(0, oldLines);
					}
				} else if (toolName === "write" && input.file_path) {
					result.filesChanged.add(input.file_path);
					const contentLines = (input.content || "").split("\n").length;
					result.linesAdded += contentLines;
				}
			}
		}
	} catch {
		// Ignore parse errors
	}

	return result;
}

/**
 * Calculate streak days (consecutive days with activity)
 */
function calculateStreak(dailyActivity: DailyActivity[]): number {
	let streak = 0;
	const today = new Date().toISOString().split("T")[0];

	// Start from the end (most recent) and count backwards
	for (let i = dailyActivity.length - 1; i >= 0; i--) {
		const activity = dailyActivity[i];
		// Only count if it's today or continuing a streak
		if (i === dailyActivity.length - 1 && activity.date !== today) {
			// If today has no activity yet, start from yesterday
			continue;
		}
		if (activity.messageCount > 0) {
			streak++;
		} else {
			break;
		}
	}

	return streak;
}

/**
 * Query activity data from the database
 * Processes all sessions and messages to compute aggregations
 */
export async function queryActivityData(days = 365): Promise<ActivityData> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - days);
	const cutoffStr = cutoffDate.toISOString();

	// Initialize data structures
	const dailyMap = new Map<string, DailyActivity>();
	const hourlyMap = new Map<number, HourlyActivity>();
	const sessionSet = new Set<string>();

	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let totalCachedTokens = 0;
	let messageCount = 0;

	// Initialize hourly buckets
	for (let h = 0; h < 24; h++) {
		hourlyMap.set(h, { hour: h, sessionCount: 0, messageCount: 0 });
	}

	try {
		// Get all sessions
		const allSessions = await listSessions({ limit: 1000 });

		// Process each session's messages
		for (const session of allSessions) {
			const sessionMessages = await messages.list({
				sessionId: session.id,
				messageType: "assistant",
				limit: 10000,
			});

			for (const msg of sessionMessages) {
				// Skip if before cutoff
				if (msg.timestamp < cutoffStr) continue;

				const date = msg.timestamp.split("T")[0];
				const hour = new Date(msg.timestamp).getHours();

				// Update daily activity
				const daily = dailyMap.get(date) || {
					date,
					sessionCount: 0,
					messageCount: 0,
					inputTokens: 0,
					outputTokens: 0,
					cachedTokens: 0,
					linesAdded: 0,
					linesRemoved: 0,
					filesChanged: 0,
				};

				const tokens = parseTokensFromRawJson(msg.rawJson ?? null);
				const lineChanges = parseLineChangesFromRawJson(msg.rawJson ?? null);
				daily.messageCount++;
				daily.inputTokens += tokens.inputTokens;
				daily.outputTokens += tokens.outputTokens;
				daily.cachedTokens += tokens.cachedTokens;
				daily.linesAdded += lineChanges.linesAdded;
				daily.linesRemoved += lineChanges.linesRemoved;
				// Track unique files per day using Set
				const existingFiles =
					(daily as { _filesSet?: Set<string> })._filesSet || new Set<string>();
				for (const file of lineChanges.filesChanged) {
					existingFiles.add(file);
				}
				(daily as { _filesSet?: Set<string> })._filesSet = existingFiles;
				daily.filesChanged = existingFiles.size;
				dailyMap.set(date, daily);

				// Update hourly activity
				const hourly = hourlyMap.get(hour);
				if (hourly) hourly.messageCount++;

				// Track tokens for total
				totalInputTokens += tokens.inputTokens;
				totalOutputTokens += tokens.outputTokens;
				totalCachedTokens += tokens.cachedTokens;
				messageCount++;

				// Track unique sessions
				sessionSet.add(session.id);
			}

			// Update session counts for daily and hourly
			if (sessionMessages.length > 0) {
				const firstMsg = sessionMessages[0];
				if (firstMsg.timestamp >= cutoffStr) {
					const date = firstMsg.timestamp.split("T")[0];
					const hour = new Date(firstMsg.timestamp).getHours();

					const daily = dailyMap.get(date);
					if (daily) daily.sessionCount++;

					const hourly = hourlyMap.get(hour);
					if (hourly) hourly.sessionCount++;
				}
			}
		}
	} catch (error) {
		console.error("Error querying activity data:", error);
	}

	// Build daily activity array with all days
	const dailyActivity: DailyActivity[] = [];
	const today = new Date();

	for (let i = 0; i < days; i++) {
		const d = new Date(today);
		d.setDate(d.getDate() - i);
		const dateStr = d.toISOString().split("T")[0];

		dailyActivity.push(
			dailyMap.get(dateStr) || {
				date: dateStr,
				sessionCount: 0,
				messageCount: 0,
				inputTokens: 0,
				outputTokens: 0,
				cachedTokens: 0,
				linesAdded: 0,
				linesRemoved: 0,
				filesChanged: 0,
			},
		);
	}
	dailyActivity.reverse(); // Chronological order

	// Build hourly activity array
	const hourlyActivity = Array.from(hourlyMap.values()).sort(
		(a, b) => a.hour - b.hour,
	);

	// Calculate token usage stats
	const tokenUsage: TokenUsageStats = {
		totalInputTokens,
		totalOutputTokens,
		totalCachedTokens,
		totalTokens: totalInputTokens + totalOutputTokens,
		estimatedCostUsd: calculateCost(
			totalInputTokens,
			totalOutputTokens,
			totalCachedTokens,
		),
		messageCount,
		sessionCount: sessionSet.size,
	};

	// Calculate streak and active days
	const streakDays = calculateStreak(dailyActivity);
	const totalActiveDays = dailyActivity.filter(
		(d) => d.messageCount > 0,
	).length;

	// Read stats-cache.json for long-lived model usage data
	const statsCache = readStatsCache();

	// Parse model usage from stats cache
	const dailyModelTokens: DailyModelTokens[] =
		statsCache?.dailyModelTokens ?? [];
	const modelUsage: ModelUsageStats[] = statsCache?.modelUsage
		? Object.entries(statsCache.modelUsage).map(([model, usage]) => ({
				model,
				displayName: getModelDisplayName(model),
				inputTokens: usage.inputTokens,
				outputTokens: usage.outputTokens,
				cacheReadTokens: usage.cacheReadInputTokens,
				cacheCreationTokens: usage.cacheCreationInputTokens,
				totalTokens: usage.inputTokens + usage.outputTokens,
			}))
		: [];

	return {
		dailyActivity,
		hourlyActivity,
		tokenUsage,
		streakDays,
		totalActiveDays,
		dailyModelTokens,
		modelUsage,
		totalSessions: statsCache?.totalSessions ?? sessionSet.size,
		totalMessages: statsCache?.totalMessages ?? messageCount,
		firstSessionDate: statsCache?.firstSessionDate ?? null,
	};
}
