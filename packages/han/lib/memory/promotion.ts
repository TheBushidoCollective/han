/**
 * Han Memory Auto-Promotion Engine
 *
 * Automatically promotes high-confidence patterns to .claude/rules/
 * No suggestions - just learns and writes.
 *
 * Promotion criteria:
 * - Pattern appears 3+ times across different sources
 * - Confidence score >= 0.8
 * - Not already documented in rules
 *
 * Self-learning principle:
 * > Claude should actively learn, not just suggest.
 * > Low-stakes (git-tracked, reviewable, revertible)
 * > Additive, not destructive
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Evidence, IndexedObservation } from "./types.ts";

/**
 * Pattern detected from observations
 */
export interface DetectedPattern {
	/** Unique pattern identifier */
	id: string;
	/** Domain (testing, api, auth, etc.) */
	domain: string;
	/** The pattern description */
	description: string;
	/** Confidence score (0-1) */
	confidence: number;
	/** Number of occurrences */
	occurrences: number;
	/** Sources where pattern was found */
	sources: Array<{
		type: string;
		id: string;
		author?: string;
		timestamp?: number;
	}>;
	/** Suggested rule content */
	ruleContent: string;
}

/**
 * Promotion result
 */
export interface PromotionResult {
	promoted: boolean;
	domain: string;
	pattern: string;
	filePath?: string;
	reason: string;
}

/**
 * Pattern tracking store
 */
interface PatternStore {
	patterns: Map<string, DetectedPattern>;
	lastUpdated: number;
}

// In-memory pattern store (persisted per-session)
const patternStore: PatternStore = {
	patterns: new Map(),
	lastUpdated: Date.now(),
};

/**
 * Domain keywords for classification
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
	testing: [
		"test",
		"spec",
		"mock",
		"fixture",
		"assert",
		"expect",
		"describe",
		"it",
		"jest",
		"vitest",
		"bun:test",
	],
	api: [
		"endpoint",
		"route",
		"handler",
		"request",
		"response",
		"api",
		"rest",
		"graphql",
		"fetch",
	],
	auth: [
		"auth",
		"login",
		"logout",
		"session",
		"token",
		"jwt",
		"oauth",
		"permission",
		"role",
	],
	database: [
		"db",
		"database",
		"query",
		"migration",
		"schema",
		"table",
		"model",
		"orm",
		"sql",
	],
	error: [
		"error",
		"exception",
		"catch",
		"throw",
		"try",
		"finally",
		"handle",
		"fallback",
	],
	logging: ["log", "logger", "debug", "info", "warn", "trace", "console"],
	config: ["config", "env", "environment", "settings", "options", "parameter"],
	build: ["build", "compile", "bundle", "webpack", "vite", "esbuild", "rollup"],
	deploy: ["deploy", "release", "ci", "cd", "pipeline", "github actions"],
	commands: ["command", "cli", "script", "npm", "bun", "yarn", "pnpm"],
};

/**
 * Infer domain from text content
 */
export function inferDomain(text: string): string {
	const lower = text.toLowerCase();
	let bestDomain = "general";
	let bestScore = 0;

	for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
		let score = 0;
		for (const keyword of keywords) {
			if (lower.includes(keyword)) {
				score++;
			}
		}
		if (score > bestScore) {
			bestScore = score;
			bestDomain = domain;
		}
	}

	return bestDomain;
}

/**
 * Generate a pattern ID from content
 */
function generatePatternId(domain: string, description: string): string {
	const normalized = description
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.slice(0, 50);
	return `${domain}:${normalized}`;
}

/**
 * Extract patterns from observations
 */
export function extractPatterns(
	observations: IndexedObservation[],
): DetectedPattern[] {
	const patternMap = new Map<string, DetectedPattern>();

	for (const obs of observations) {
		// Skip low-quality observations
		if (!obs.summary || obs.summary.length < 10) continue;

		const domain = inferDomain(`${obs.summary} ${obs.detail || ""}`);
		const patternId = generatePatternId(domain, obs.summary);

		const existing = patternMap.get(patternId);
		if (existing) {
			existing.occurrences++;
			existing.sources.push({
				type: obs.type,
				id: obs.source,
				author: obs.author,
				timestamp: obs.timestamp,
			});
			// Increase confidence with more sources
			existing.confidence = Math.min(1, existing.confidence + 0.1);
		} else {
			patternMap.set(patternId, {
				id: patternId,
				domain,
				description: obs.summary,
				confidence: 0.5,
				occurrences: 1,
				sources: [
					{
						type: obs.type,
						id: obs.source,
						author: obs.author,
						timestamp: obs.timestamp,
					},
				],
				ruleContent: formatAsRule(domain, obs.summary, obs.detail),
			});
		}
	}

	return Array.from(patternMap.values());
}

/**
 * Extract patterns from research evidence
 */
export function extractPatternsFromEvidence(
	evidence: Evidence[],
): DetectedPattern[] {
	const patternMap = new Map<string, DetectedPattern>();

	for (const ev of evidence) {
		if (!ev.claim || ev.claim.length < 10) continue;

		const domain = inferDomain(ev.claim);
		const patternId = generatePatternId(
			domain,
			ev.citation.excerpt || ev.claim,
		);

		const existing = patternMap.get(patternId);
		if (existing) {
			existing.occurrences++;
			existing.sources.push({
				type: "evidence",
				id: ev.citation.source,
				author: ev.citation.author,
				timestamp: ev.citation.timestamp,
			});
			existing.confidence = Math.min(1, existing.confidence + 0.15);
		} else {
			patternMap.set(patternId, {
				id: patternId,
				domain,
				description: ev.citation.excerpt || ev.claim.slice(0, 100),
				confidence: ev.confidence,
				occurrences: 1,
				sources: [
					{
						type: "evidence",
						id: ev.citation.source,
						author: ev.citation.author,
						timestamp: ev.citation.timestamp,
					},
				],
				ruleContent: formatAsRule(
					domain,
					ev.citation.excerpt || "Pattern from research",
					ev.claim,
				),
			});
		}
	}

	return Array.from(patternMap.values());
}

/**
 * Format pattern as a rule for .claude/rules/
 */
function formatAsRule(
	_domain: string,
	summary: string,
	detail?: string,
): string {
	const lines: string[] = [];

	// Clean summary for rule format
	const cleanSummary = summary
		.replace(/^(feat|fix|refactor|chore|docs|test|style)(\([^)]+\))?:\s*/i, "")
		.trim();

	lines.push(`- ${cleanSummary}`);

	if (detail && detail.length > 0 && detail.length < 200) {
		// Add detail as sub-point if concise
		lines.push(`  - ${detail.trim()}`);
	}

	return lines.join("\n");
}

/**
 * Track a pattern for potential promotion
 */
export function trackPattern(pattern: DetectedPattern): void {
	const existing = patternStore.patterns.get(pattern.id);

	if (existing) {
		existing.occurrences += pattern.occurrences;
		existing.sources.push(...pattern.sources);
		// 0.15 per occurrence: 3 occurrences (0.5 + 0.15 + 0.15 = 0.8) reaches threshold
		existing.confidence = Math.min(
			1,
			existing.confidence + 0.15 * pattern.occurrences,
		);
	} else {
		patternStore.patterns.set(pattern.id, { ...pattern });
	}

	patternStore.lastUpdated = Date.now();
}

/**
 * Get patterns ready for promotion
 */
export function getPromotionCandidates(): DetectedPattern[] {
	const candidates: DetectedPattern[] = [];

	for (const pattern of patternStore.patterns.values()) {
		// Promotion criteria:
		// - 3+ occurrences
		// - 0.8+ confidence
		// - Multiple unique authors (if available)
		if (pattern.occurrences >= 3 && pattern.confidence >= 0.8) {
			const uniqueAuthors = new Set(
				pattern.sources.map((s) => s.author).filter(Boolean),
			);
			// Bonus: multiple authors increases confidence
			if (uniqueAuthors.size >= 2) {
				pattern.confidence = Math.min(1, pattern.confidence + 0.1);
			}
			candidates.push(pattern);
		}
	}

	return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if a pattern is already documented
 */
function isAlreadyDocumented(
	domain: string,
	pattern: string,
	rulesPath: string,
): boolean {
	const filePath = join(rulesPath, `${domain}.md`);

	if (!existsSync(filePath)) {
		return false;
	}

	try {
		const content = readFileSync(filePath, "utf-8").toLowerCase();
		const patternLower = pattern.toLowerCase();

		// Extract bullet point content only (skip headers, etc.)
		const bulletLines = content
			.split("\n")
			.filter((line) => line.trim().startsWith("-"))
			.join(" ");

		// Stop words - common words that shouldn't determine uniqueness
		const stopWords = new Set([
			"always",
			"never",
			"should",
			"must",
			"when",
			"make",
			"sure",
			"rule",
			"pattern",
			"code",
			"file",
			"files",
			"tests",
			"test",
			"write",
			"using",
			"with",
			"that",
			"this",
			"from",
			"have",
			"will",
			"each",
			"them",
		]);

		// Check if main keywords from pattern exist in bullet points
		// Filter out domain name, short words, and stop words
		const keywords = patternLower
			.split(/\s+/)
			.filter(
				(w) => w.length > 3 && w !== domain.toLowerCase() && !stopWords.has(w),
			);

		if (keywords.length === 0) {
			// If no meaningful keywords, check exact substring match
			return bulletLines.includes(patternLower);
		}

		let matchCount = 0;
		for (const keyword of keywords) {
			if (bulletLines.includes(keyword)) {
				matchCount++;
			}
		}

		// Require at least 2 keywords to match, or all if only 1-2 keywords
		const threshold = keywords.length <= 2 ? 1.0 : 0.6;
		return matchCount / keywords.length >= threshold;
	} catch {
		return false;
	}
}

/**
 * Auto-promote a pattern to .claude/rules/
 * Returns the promotion result
 */
export function promotePattern(
	pattern: DetectedPattern,
	projectRoot: string = process.cwd(),
): PromotionResult {
	const rulesPath = join(projectRoot, ".claude", "rules");

	// Check if already documented
	if (isAlreadyDocumented(pattern.domain, pattern.description, rulesPath)) {
		return {
			promoted: false,
			domain: pattern.domain,
			pattern: pattern.description,
			reason: "Pattern already documented in rules",
		};
	}

	// Ensure rules directory exists
	if (!existsSync(rulesPath)) {
		mkdirSync(rulesPath, { recursive: true });
	}

	const filePath = join(rulesPath, `${pattern.domain}.md`);
	let existingContent = "";

	if (existsSync(filePath)) {
		existingContent = readFileSync(filePath, "utf-8");
	} else {
		// Create new file with header
		existingContent = `# ${pattern.domain.charAt(0).toUpperCase() + pattern.domain.slice(1)} Conventions\n\n`;
	}

	// Append the new rule
	const newContent = `${existingContent.trimEnd()}\n${pattern.ruleContent}\n`;

	try {
		writeFileSync(filePath, newContent);

		// Remove from tracking after successful promotion
		patternStore.patterns.delete(pattern.id);

		return {
			promoted: true,
			domain: pattern.domain,
			pattern: pattern.description,
			filePath,
			reason: `Promoted: ${pattern.occurrences} occurrences, ${(pattern.confidence * 100).toFixed(0)}% confidence`,
		};
	} catch (error) {
		return {
			promoted: false,
			domain: pattern.domain,
			pattern: pattern.description,
			reason: `Failed to write: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Auto-promote all ready patterns
 * This is the main entry point for self-learning
 */
export function autoPromotePatterns(
	projectRoot: string = process.cwd(),
): PromotionResult[] {
	const candidates = getPromotionCandidates();
	const results: PromotionResult[] = [];

	for (const pattern of candidates) {
		const result = promotePattern(pattern, projectRoot);
		results.push(result);
	}

	return results;
}

/**
 * Learn from research results
 * Called after research completes to track patterns
 */
export function learnFromResearch(
	evidence: Evidence[],
	projectRoot: string = process.cwd(),
): PromotionResult[] {
	// Extract patterns from evidence
	const patterns = extractPatternsFromEvidence(evidence);

	// Track all patterns
	for (const pattern of patterns) {
		trackPattern(pattern);
	}

	// Auto-promote any that are ready
	return autoPromotePatterns(projectRoot);
}

/**
 * Learn from indexed observations
 * Called after indexing new data
 */
export function learnFromObservations(
	observations: IndexedObservation[],
	projectRoot: string = process.cwd(),
): PromotionResult[] {
	const patterns = extractPatterns(observations);

	for (const pattern of patterns) {
		trackPattern(pattern);
	}

	return autoPromotePatterns(projectRoot);
}

/**
 * Get current pattern statistics
 */
export function getPatternStats(): {
	totalPatterns: number;
	readyForPromotion: number;
	topDomains: Array<{ domain: string; count: number }>;
} {
	const domainCounts = new Map<string, number>();

	for (const pattern of patternStore.patterns.values()) {
		const current = domainCounts.get(pattern.domain) || 0;
		domainCounts.set(pattern.domain, current + 1);
	}

	const topDomains = Array.from(domainCounts.entries())
		.map(([domain, count]) => ({ domain, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 5);

	return {
		totalPatterns: patternStore.patterns.size,
		readyForPromotion: getPromotionCandidates().length,
		topDomains,
	};
}

/**
 * Clear pattern store (for testing)
 */
export function clearPatternStore(): void {
	patternStore.patterns.clear();
	patternStore.lastUpdated = Date.now();
}
