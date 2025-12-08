import Sentiment from "sentiment";

type FrustrationLevel = "low" | "moderate" | "high";

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
 * Detect frustration in user message and output results
 */
export function detectFrustration(message: string): void {
	if (!message.trim()) {
		return;
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
				`Negative sentiment detected (score: ${result.score}, comparative: ${result.comparative.toFixed(2)})`,
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

		// Output to console for hook display
		// Note: Actual metrics storage is handled by the hashi-han-metrics MCP server
		console.log(
			`\n⚠️  Frustration detected (level: ${frustrationLevel}, score: ${totalScore.toFixed(1)})`,
		);
		console.log("\nSentiment Analysis:");
		console.log(
			`  • Score: ${result.score} (${result.comparative.toFixed(2)} comparative)`,
		);
		if (result.negative.length > 0) {
			console.log(`  • Negative words: ${result.negative.join(", ")}`);
		}

		if (signals.length > 0) {
			console.log("\nAdditional signals:");
			for (const signal of signals.filter(
				(s) => !s.startsWith("Negative sentiment"),
			)) {
				console.log(`  • ${signal}`);
			}
		}

		console.log(
			"\nThis interaction will be tracked in metrics for quality improvement.",
		);
		console.log(
			"The agent will work to better understand and address your needs.\n",
		);
	}
}

/**
 * Detect frustration from USER_MESSAGE environment variable
 */
export function detectFrustrationFromEnv(): void {
	const message = process.env.USER_MESSAGE || "";
	if (message) {
		detectFrustration(message);
	}
}
