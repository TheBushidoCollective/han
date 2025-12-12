import { cleanupOldCheckpoints } from "../../checkpoint.ts";

/**
 * Clean stale checkpoints older than specified age
 */
export async function cleanCheckpoints(options: {
	maxAge: string;
}): Promise<void> {
	// Parse maxAge in hours and convert to milliseconds
	const maxAgeHours = Number.parseFloat(options.maxAge);

	if (Number.isNaN(maxAgeHours) || maxAgeHours <= 0) {
		throw new Error(
			`Invalid max-age value: "${options.maxAge}". Must be a positive number.`,
		);
	}

	const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

	// Clean checkpoints
	const removed = cleanupOldCheckpoints(maxAgeMs);

	console.log(
		`Cleaned ${removed} checkpoint${removed === 1 ? "" : "s"} older than ${maxAgeHours} hours`,
	);
}
