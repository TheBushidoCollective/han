import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Checkpoint, getCheckpointDir } from "../../checkpoint.ts";

/**
 * List all checkpoints in the checkpoint directory
 */
export async function listCheckpoints(): Promise<void> {
	const checkpointDir = getCheckpointDir();

	// Check if checkpoint directory exists
	if (!existsSync(checkpointDir)) {
		console.log("No checkpoints found.");
		return;
	}

	// Read all files in checkpoint directory
	const files = readdirSync(checkpointDir);
	const jsonFiles = files.filter((f) => f.endsWith(".json"));

	if (jsonFiles.length === 0) {
		console.log("No checkpoints found.");
		return;
	}

	// Parse and categorize checkpoints
	const sessionCheckpoints: Array<{
		id: string;
		created_at: string;
		fileCount: number;
	}> = [];
	const agentCheckpoints: Array<{
		id: string;
		created_at: string;
		fileCount: number;
	}> = [];

	for (const file of jsonFiles) {
		try {
			const filePath = join(checkpointDir, file);
			const content = readFileSync(filePath, "utf-8");
			const checkpoint = JSON.parse(content) as Checkpoint;

			// Extract ID from filename (remove type_ prefix and .json suffix)
			const id = file.replace(/^(session|agent)_/, "").replace(/\.json$/, "");

			const entry = {
				id,
				created_at: checkpoint.created_at,
				fileCount: Object.keys(checkpoint.files).length,
			};

			if (checkpoint.type === "session") {
				sessionCheckpoints.push(entry);
			} else if (checkpoint.type === "agent") {
				agentCheckpoints.push(entry);
			}
		} catch {}
	}

	// Sort by created_at (newest first)
	sessionCheckpoints.sort(
		(a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
	);
	agentCheckpoints.sort(
		(a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
	);

	// Display results
	if (sessionCheckpoints.length > 0) {
		console.log("Session Checkpoints:");
		for (const cp of sessionCheckpoints) {
			const fileCountStr = cp.fileCount.toLocaleString();
			console.log(
				`  ${cp.id.padEnd(20)}  ${cp.created_at}  (${fileCountStr} files)`,
			);
		}
		console.log();
	}

	if (agentCheckpoints.length > 0) {
		console.log("Agent Checkpoints:");
		for (const cp of agentCheckpoints) {
			const fileCountStr = cp.fileCount.toLocaleString();
			console.log(
				`  ${cp.id.padEnd(20)}  ${cp.created_at}  (${fileCountStr} files)`,
			);
		}
		console.log();
	}

	const total = sessionCheckpoints.length + agentCheckpoints.length;
	console.log(`Total: ${total} checkpoint${total === 1 ? "" : "s"}`);
}
