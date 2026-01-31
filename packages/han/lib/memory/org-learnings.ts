/**
 * Org Learnings Aggregation
 *
 * Provides aggregated patterns and learnings across an organization's sessions.
 * CRITICAL: Only exposes aggregate data - never raw session content.
 *
 * Security principles:
 * - Aggregation only (counts, frequencies, patterns)
 * - No direct quotes or excerpts from sessions
 * - Minimum threshold for pattern reporting (prevents fingerprinting)
 */

import type { Session } from "../db/index.ts";
import { sessions as dbSessions, messages } from "../db/index.ts";
import type { UserPermissionContext } from "./permission-filter.ts";
import { filterSessionsByPermission } from "./permission-filter.ts";
import {
	cacheOrgLearnings,
	getCachedOrgLearnings,
	type OrgLearningsCacheEntry,
} from "./team-memory-cache.ts";

/**
 * Minimum occurrences for a pattern to be reported
 * Prevents rare patterns from being used to identify specific sessions
 */
const MIN_PATTERN_OCCURRENCES = 3;

/**
 * Maximum patterns to return per domain
 */
const MAX_PATTERNS_PER_DOMAIN = 20;

/**
 * Aggregated learning/pattern detected across sessions
 */
export interface OrgLearning {
	/** Pattern or convention observed */
	pattern: string;
	/** How many sessions exhibited this pattern */
	frequency: number;
	/** Domain/category (e.g., "api", "testing", "database") */
	domain: string;
	/** When this pattern was last observed (timestamp) */
	lastSeen: number;
	/** Confidence level based on consistency */
	confidence: "high" | "medium" | "low";
}

/**
 * Result of org learnings query
 */
export interface OrgLearningsResult {
	/** Aggregated learnings */
	learnings: OrgLearning[];
	/** Total sessions analyzed */
	sessionsAnalyzed: number;
	/** Time range of analysis */
	timeRange: {
		start: number;
		end: number;
	};
	/** Whether results are from cache */
	cached: boolean;
}

/**
 * Pattern extraction from message content
 *
 * These patterns are designed to extract conventions without exposing
 * specific code or sensitive information.
 */
const PATTERN_EXTRACTORS: Array<{
	domain: string;
	regex: RegExp;
	extract: (match: RegExpMatchArray) => string;
}> = [
	// Testing patterns
	{
		domain: "testing",
		regex: /\b(test|spec|should|describe|it|expect)\b.*\b(mock|stub|spy)\b/i,
		extract: () => "Uses mocking in tests",
	},
	{
		domain: "testing",
		regex: /\b(vitest|jest|mocha|playwright|cypress)\b/i,
		extract: (m) => `Uses ${m[1].toLowerCase()} for testing`,
	},

	// API patterns
	{
		domain: "api",
		regex: /\b(zod|yup|joi)\.?[a-z]*\(/i,
		extract: (m) => `Uses ${m[1].toLowerCase()} for validation`,
	},
	{
		domain: "api",
		regex: /\b(GraphQL|REST|gRPC)\b/i,
		extract: (m) => `Uses ${m[1]} API style`,
	},

	// Database patterns
	{
		domain: "database",
		regex: /\b(prisma|drizzle|typeorm|sequelize|knex)\b/i,
		extract: (m) => `Uses ${m[1].toLowerCase()} ORM`,
	},
	{
		domain: "database",
		regex: /\b(postgres|mysql|sqlite|mongodb|redis)\b/i,
		extract: (m) => `Uses ${m[1].toLowerCase()} database`,
	},

	// Architecture patterns
	{
		domain: "architecture",
		regex: /\b(monorepo|microservice|serverless|edge)\b/i,
		extract: (m) =>
			`${m[1].charAt(0).toUpperCase() + m[1].slice(1)} architecture`,
	},

	// Error handling patterns
	{
		domain: "errors",
		regex: /\b(try|catch|finally|throw|Error)\b.*\b(custom|typed|domain)\b/i,
		extract: () => "Uses typed/custom errors",
	},

	// Documentation patterns
	{
		domain: "documentation",
		regex: /\b(JSDoc|TSDoc|Swagger|OpenAPI)\b/i,
		extract: (m) => `Uses ${m[1]} documentation`,
	},
];

/**
 * Extract patterns from message content
 *
 * Returns anonymized patterns - no direct content exposure
 */
function extractPatternsFromContent(content: string): Array<{
	pattern: string;
	domain: string;
}> {
	const patterns: Array<{ pattern: string; domain: string }> = [];

	for (const extractor of PATTERN_EXTRACTORS) {
		const match = content.match(extractor.regex);
		if (match) {
			patterns.push({
				pattern: extractor.extract(match),
				domain: extractor.domain,
			});
		}
	}

	return patterns;
}

/**
 * Aggregate patterns across sessions
 */
async function aggregatePatternsFromSessions(
	permittedSessions: Session[],
): Promise<Map<string, { count: number; domain: string; lastSeen: number }>> {
	const patternCounts = new Map<
		string,
		{ count: number; domain: string; lastSeen: number }
	>();

	// Process each session
	for (const session of permittedSessions) {
		try {
			// Get messages for session (limit to prevent memory issues)
			const sessionMessages = await messages.list({
				sessionId: session.id,
				limit: 500, // Sample messages per session
			});

			const sessionPatterns = new Set<string>();

			for (const msg of sessionMessages) {
				if (!msg.content) continue;

				const patterns = extractPatternsFromContent(msg.content);
				for (const { pattern, domain } of patterns) {
					// Only count each pattern once per session
					if (!sessionPatterns.has(pattern)) {
						sessionPatterns.add(pattern);

						const existing = patternCounts.get(pattern);
						const timestamp = new Date(msg.timestamp).getTime();

						if (existing) {
							existing.count++;
							if (timestamp > existing.lastSeen) {
								existing.lastSeen = timestamp;
							}
						} else {
							patternCounts.set(pattern, {
								count: 1,
								domain,
								lastSeen: timestamp,
							});
						}
					}
				}
			}
		} catch (error) {
			// Skip sessions that fail to load
			console.warn(
				`[OrgLearnings] Failed to process session ${session.id}:`,
				error,
			);
		}
	}

	return patternCounts;
}

/**
 * Calculate confidence level based on frequency
 */
function calculateConfidence(
	frequency: number,
	totalSessions: number,
): "high" | "medium" | "low" {
	const ratio = frequency / totalSessions;

	if (ratio >= 0.5) return "high"; // 50%+ sessions
	if (ratio >= 0.2) return "medium"; // 20-50% sessions
	return "low"; // <20% sessions
}

/**
 * Get aggregated org learnings
 *
 * @param context - User permission context
 * @param options - Query options
 */
export async function getOrgLearnings(
	context: UserPermissionContext,
	options: {
		limit?: number;
		domain?: string;
		minConfidence?: "high" | "medium" | "low";
		useCache?: boolean;
	} = {},
): Promise<OrgLearningsResult> {
	const { limit = 50, domain, minConfidence, useCache = true } = options;

	// Check cache first
	if (useCache && context.orgId) {
		const cached = getCachedOrgLearnings(context.orgId);
		if (cached) {
			// Filter cached results by domain/confidence if needed
			let learnings = cached.learnings.map((l) => ({
				...l,
				confidence: calculateConfidence(l.frequency, cached.totalSessions),
			}));

			if (domain) {
				learnings = learnings.filter((l) => l.domain === domain);
			}
			if (minConfidence) {
				const confidenceOrder = { high: 3, medium: 2, low: 1 };
				learnings = learnings.filter(
					(l) =>
						confidenceOrder[l.confidence] >= confidenceOrder[minConfidence],
				);
			}

			return {
				learnings: learnings.slice(0, limit),
				sessionsAnalyzed: cached.totalSessions,
				timeRange: {
					start: cached.cachedAt - 30 * 24 * 60 * 60 * 1000, // Assume 30 days
					end: cached.cachedAt,
				},
				cached: true,
			};
		}
	}

	// Get permitted sessions for the user's org
	const allSessions = await dbSessions.list({ limit: 1000 });

	// Filter by permissions
	const filterResult = filterSessionsByPermission(
		allSessions,
		context,
		"team", // Team scope for org-wide learnings
	);

	const permittedSessions = allSessions.filter((s) =>
		filterResult.sessionIds.includes(s.id),
	);

	if (permittedSessions.length === 0) {
		return {
			learnings: [],
			sessionsAnalyzed: 0,
			timeRange: { start: Date.now(), end: Date.now() },
			cached: false,
		};
	}

	// Aggregate patterns
	const patternCounts = await aggregatePatternsFromSessions(permittedSessions);

	// Filter patterns below minimum threshold (privacy protection)
	const validPatterns: OrgLearning[] = [];

	for (const [pattern, data] of patternCounts) {
		if (data.count < MIN_PATTERN_OCCURRENCES) {
			continue; // Skip rare patterns
		}

		const confidence = calculateConfidence(
			data.count,
			permittedSessions.length,
		);

		// Filter by confidence if specified
		if (minConfidence) {
			const confidenceOrder = { high: 3, medium: 2, low: 1 };
			if (confidenceOrder[confidence] < confidenceOrder[minConfidence]) {
				continue;
			}
		}

		// Filter by domain if specified
		if (domain && data.domain !== domain) {
			continue;
		}

		validPatterns.push({
			pattern,
			frequency: data.count,
			domain: data.domain,
			lastSeen: data.lastSeen,
			confidence,
		});
	}

	// Sort by frequency (most common first)
	validPatterns.sort((a, b) => b.frequency - a.frequency);

	// Group by domain and limit per domain
	const byDomain = new Map<string, OrgLearning[]>();
	for (const learning of validPatterns) {
		const domainLearnings = byDomain.get(learning.domain) || [];
		if (domainLearnings.length < MAX_PATTERNS_PER_DOMAIN) {
			domainLearnings.push(learning);
			byDomain.set(learning.domain, domainLearnings);
		}
	}

	// Flatten and re-sort
	const learnings = Array.from(byDomain.values())
		.flat()
		.sort((a, b) => b.frequency - a.frequency)
		.slice(0, limit);

	// Calculate time range from sessions using session timestamps
	// Note: Sessions don't have createdAt/updatedAt directly, so we use lastSeen from patterns
	// or fall back to current time if no patterns found
	const patternTimestamps = validPatterns
		.map((p) => p.lastSeen)
		.filter((t) => t > 0);

	const timeRange = {
		start:
			patternTimestamps.length > 0
				? Math.min(...patternTimestamps)
				: Date.now(),
		end:
			patternTimestamps.length > 0
				? Math.max(...patternTimestamps)
				: Date.now(),
	};

	// Cache the results
	if (context.orgId) {
		const cacheEntry: OrgLearningsCacheEntry = {
			learnings: validPatterns.map((l) => ({
				pattern: l.pattern,
				frequency: l.frequency,
				domain: l.domain,
				lastSeen: l.lastSeen,
			})),
			totalSessions: permittedSessions.length,
			cachedAt: Date.now(),
		};
		cacheOrgLearnings(context.orgId, cacheEntry);
	}

	return {
		learnings,
		sessionsAnalyzed: permittedSessions.length,
		timeRange,
		cached: false,
	};
}

/**
 * Get conventions for a specific domain
 *
 * Convenience wrapper for domain-specific queries
 */
export async function getOrgConventions(
	context: UserPermissionContext,
	domain: string,
	limit = 10,
): Promise<OrgLearning[]> {
	const result = await getOrgLearnings(context, {
		domain,
		limit,
		minConfidence: "medium", // Only return reasonably confident patterns
	});

	return result.learnings;
}

/**
 * Get all domains with learnings
 */
export async function getOrgLearningDomains(
	context: UserPermissionContext,
): Promise<Array<{ domain: string; patternCount: number }>> {
	const result = await getOrgLearnings(context, {
		limit: 500, // Get all patterns
		useCache: true,
	});

	// Count patterns per domain
	const domainCounts = new Map<string, number>();
	for (const learning of result.learnings) {
		domainCounts.set(
			learning.domain,
			(domainCounts.get(learning.domain) || 0) + 1,
		);
	}

	return Array.from(domainCounts.entries())
		.map(([domain, patternCount]) => ({ domain, patternCount }))
		.sort((a, b) => b.patternCount - a.patternCount);
}
