import {
	captureCheckpointAsync,
	collectIfChangedPatterns,
} from "../../hooks/checkpoint.ts";

/**
 * Capture a checkpoint for a session or agent
 * This is called from hook dispatch in a background process
 *
 * Uses DB-backed storage for checkpoints.
 */
export async function captureCheckpointCommand(options: {
	type: "session" | "agent";
	id: string;
}): Promise<void> {
	const { type, id } = options;

	// Collect patterns from all enabled plugins
	const patterns = collectIfChangedPatterns();

	// Build checkpoint ID (prefix with "agent-" for agent checkpoints)
	const checkpointId = type === "agent" ? `agent-${id}` : id;

	// Capture the checkpoint using DB storage
	const results = await captureCheckpointAsync(checkpointId, patterns);

	if (results.length === 0 && patterns.length > 0) {
		// Only error if we expected files but captured none
		console.warn(
			`Warning: No files captured for ${type} checkpoint ${id} (patterns: ${patterns.join(", ")})`,
		);
	}
}
