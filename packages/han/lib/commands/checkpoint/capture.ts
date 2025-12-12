import {
	captureCheckpoint,
	collectIfChangedPatterns,
} from "../../checkpoint.ts";

/**
 * Capture a checkpoint for a session or agent
 * This is called from hook dispatch in a background process
 */
export async function captureCheckpointCommand(options: {
	type: "session" | "agent";
	id: string;
}): Promise<void> {
	const { type, id } = options;

	// Collect patterns from all enabled plugins
	const patterns = collectIfChangedPatterns();

	// Capture the checkpoint
	const success = captureCheckpoint(type, id, patterns);

	if (!success) {
		throw new Error(`Failed to capture ${type} checkpoint for ${id}`);
	}
}
