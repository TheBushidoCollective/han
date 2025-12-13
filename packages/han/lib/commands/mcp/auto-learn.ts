/**
 * Auto-Learn MCP Tool
 *
 * Provides visibility into the self-learning system and allows
 * manual triggering of pattern promotion.
 */

import {
	autoPromotePatterns,
	getPatternStats,
	getPromotionCandidates,
	type PromotionResult,
} from "../../memory/index.ts";

/**
 * Auto-learn query parameters
 */
export interface AutoLearnParams {
	/** Action to perform */
	action: "status" | "promote" | "candidates";
}

/**
 * Auto-learn result
 */
export interface AutoLearnResult {
	success: boolean;
	action: string;
	stats?: {
		totalPatterns: number;
		readyForPromotion: number;
		topDomains: Array<{ domain: string; count: number }>;
	};
	candidates?: Array<{
		domain: string;
		description: string;
		confidence: number;
		occurrences: number;
	}>;
	promotions?: PromotionResult[];
	message: string;
}

/**
 * Query or trigger auto-learning
 */
export function autoLearn(params: AutoLearnParams): AutoLearnResult {
	const { action } = params;

	switch (action) {
		case "status": {
			const stats = getPatternStats();
			return {
				success: true,
				action: "status",
				stats,
				message:
					stats.readyForPromotion > 0
						? `${stats.readyForPromotion} patterns ready for promotion`
						: `Tracking ${stats.totalPatterns} patterns, none ready yet`,
			};
		}

		case "candidates": {
			const candidates = getPromotionCandidates();
			return {
				success: true,
				action: "candidates",
				candidates: candidates.map((c) => ({
					domain: c.domain,
					description: c.description,
					confidence: c.confidence,
					occurrences: c.occurrences,
				})),
				message:
					candidates.length > 0
						? `${candidates.length} patterns ready for promotion`
						: "No patterns ready for promotion yet",
			};
		}

		case "promote": {
			const promotions = autoPromotePatterns();
			const promotedCount = promotions.filter((p) => p.promoted).length;
			return {
				success: true,
				action: "promote",
				promotions,
				message:
					promotedCount > 0
						? `Promoted ${promotedCount} patterns to .claude/rules/`
						: "No patterns promoted (none ready or already documented)",
			};
		}

		default:
			return {
				success: false,
				action: action || "unknown",
				message: `Unknown action: ${action}. Use 'status', 'candidates', or 'promote'.`,
			};
	}
}

/**
 * Format auto-learn result for display
 */
export function formatAutoLearnResult(result: AutoLearnResult): string {
	const lines: string[] = [];

	lines.push(`## Auto-Learn: ${result.action}`);
	lines.push("");
	lines.push(result.message);
	lines.push("");

	if (result.stats) {
		lines.push("### Statistics");
		lines.push(`- Total patterns tracked: ${result.stats.totalPatterns}`);
		lines.push(`- Ready for promotion: ${result.stats.readyForPromotion}`);

		if (result.stats.topDomains.length > 0) {
			lines.push("");
			lines.push("**Top domains:**");
			for (const { domain, count } of result.stats.topDomains) {
				lines.push(`- ${domain}: ${count} patterns`);
			}
		}
	}

	if (result.candidates && result.candidates.length > 0) {
		lines.push("### Candidates for Promotion");
		for (const c of result.candidates) {
			lines.push(
				`- **${c.domain}**: ${c.description.slice(0, 60)}${c.description.length > 60 ? "..." : ""}`,
			);
			lines.push(
				`  - Confidence: ${(c.confidence * 100).toFixed(0)}% | Occurrences: ${c.occurrences}`,
			);
		}
	}

	if (result.promotions && result.promotions.length > 0) {
		lines.push("### Promotion Results");
		for (const p of result.promotions) {
			const status = p.promoted ? "+" : "-";
			lines.push(`[${status}] **${p.domain}**: ${p.pattern.slice(0, 50)}...`);
			lines.push(`    ${p.reason}`);
		}
	}

	return lines.join("\n");
}
