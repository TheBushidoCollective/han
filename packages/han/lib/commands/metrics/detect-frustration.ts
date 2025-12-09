import Sentiment from "sentiment";
import { JsonlMetricsStorage } from "../../metrics/jsonl-storage.ts";
import type { FrustrationLevel } from "../../metrics/types.ts";

const sentiment = new Sentiment();

/**
 * Additional frustration indicators beyond sentiment analysis
 */
const additionalIndicators = {
	caps: /[A-Z]{5,}/,
	exclamation: /[!?]{2,}/,
	repeated: /\b(\w+)\s+\1\b/gi,
	negativeCommands: /\b(stop|quit|never mind|forget it|give up)\b/gi,
};

/**
 * Frustration detection result
 */
interface FrustrationResult {
	detected: boolean;
	level: FrustrationLevel;
	score: number;
	signals: string[];
}

/**
 * Detect frustration in user message and return results
 */
export function detectFrustration(message: string): FrustrationResult | null {
	if (!message.trim()) {
		return null;
	}

	// Analyze sentiment
	const result = sentiment.analyze(message);

	// Check for additional indicators
	const isTerse =
		message.trim().length < 15 &&
		message.trim().length > 0 &&
		!message.includes(" ");

	const additionalMatches = {
		caps: additionalIndicators.caps.test(message),
		exclamation: additionalIndicators.exclamation.test(message),
		terse: isTerse,
		repeated: (message.match(additionalIndicators.repeated) || []).length,
		negativeCommands: (
			message.match(additionalIndicators.negativeCommands) || []
		).length,
	};

	// Calculate combined frustration score
	// Sentiment score is typically -5 (very negative) to +5 (very positive)
	// Convert to 0-10 scale where lower sentiment = higher frustration
	const sentimentScore = Math.max(0, (-result.score / 5) * 5);

	const additionalScore =
		(additionalMatches.caps ? 2 : 0) +
		(additionalMatches.exclamation ? 1 : 0) +
		(additionalMatches.terse ? 1 : 0) +
		additionalMatches.repeated * 1 +
		additionalMatches.negativeCommands * 2;

	const totalScore = sentimentScore + additionalScore;

	// Threshold for frustration detection
	const FRUSTRATION_THRESHOLD = 2;

	if (totalScore >= FRUSTRATION_THRESHOLD || result.score < -2) {
		// Determine frustration level
		const frustrationLevel: FrustrationLevel =
			totalScore >= 6 || result.score <= -4
				? "high"
				: totalScore >= 3 || result.score <= -3
					? "moderate"
					: "low";

		// Collect detected signals
		const signals: string[] = [];

		// Add sentiment analysis results
		if (result.score < 0) {
			signals.push(
				`Negative sentiment (score: ${result.score}, comparative: ${result.comparative.toFixed(2)})`,
			);
		}

		if (result.negative.length > 0) {
			signals.push(
				`${result.negative.length} negative word(s): ${result.negative.slice(0, 3).join(", ")}${result.negative.length > 3 ? "..." : ""}`,
			);
		}

		// Add additional indicators
		if (additionalMatches.caps) {
			signals.push("ALL CAPS detected");
		}
		if (additionalMatches.exclamation) {
			signals.push("Multiple punctuation marks (!!!/???)");
		}
		if (additionalMatches.terse) {
			signals.push("Very terse message");
		}
		if (additionalMatches.repeated > 0) {
			signals.push(`${additionalMatches.repeated} repeated word(s)`);
		}
		if (additionalMatches.negativeCommands > 0) {
			signals.push(`${additionalMatches.negativeCommands} negative command(s)`);
		}

		return {
			detected: true,
			level: frustrationLevel,
			score: totalScore,
			signals,
		};
	}

	return null;
}

/**
 * Hook event schema from stdin
 */
interface HookEvent {
	session_id: string;
	transcript_path: string;
	cwd: string;
	permission_mode: string;
	hook_event_name: string;
	prompt: string;
}

/**
 * Detect frustration from stdin hook event and record to metrics
 */
export async function detectFrustrationFromStdin(): Promise<void> {
	// Read JSON from stdin
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk);
	}

	const input = Buffer.concat(chunks).toString("utf-8");
	if (!input.trim()) {
		return;
	}

	try {
		const event: HookEvent = JSON.parse(input);
		if (!event.prompt) {
			return;
		}

		const result = detectFrustration(event.prompt);
		if (!result) {
			return;
		}

		// Record to JSONL metrics (fast atomic append)
		try {
			const storage = new JsonlMetricsStorage();
			storage.recordFrustration({
				frustration_level: result.level,
				frustration_score: result.score,
				user_message: event.prompt,
				detected_signals: result.signals,
			});
		} catch {
			// Silently ignore storage errors - don't block the hook
		}

		// Output to console for hook display
		console.log(
			`\n⚠️  Frustration detected (level: ${result.level}, score: ${result.score.toFixed(1)})`,
		);
		console.log("\nDetected signals:");
		for (const signal of result.signals) {
			console.log(`  • ${signal}`);
		}
		console.log(
			"\nThis interaction has been recorded in metrics for quality improvement.\n",
		);
	} catch {
		// Silently ignore parse errors - not all hooks will have valid JSON
	}
}
