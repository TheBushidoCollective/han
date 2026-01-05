/**
 * GraphQL Checkpoint types
 *
 * Represents checkpoint data.
 */

import {
	type CheckpointSummary,
	getCheckpointStats,
	listCheckpointSummaries,
} from "../../api/checkpoints.ts";
import { builder } from "../builder.ts";

/**
 * Checkpoint type enum
 */
export const CheckpointTypeEnum = builder.enumType("CheckpointType", {
	values: ["SESSION", "AGENT"] as const,
	description: "Type of checkpoint",
});

/**
 * Checkpoint type ref
 */
const CheckpointRef = builder.objectRef<CheckpointSummary>("Checkpoint");

/**
 * Checkpoint type implementation
 */
export const CheckpointType = CheckpointRef.implement({
	description: "A captured checkpoint of file state",
	fields: (t) => ({
		id: t.id({
			description: "Checkpoint ID",
			resolve: (cp) =>
				Buffer.from(`Checkpoint:${cp.type}_${cp.id}`).toString("base64"),
		}),
		checkpointId: t.exposeString("id", {
			description: "Original checkpoint ID",
		}),
		type: t.field({
			type: CheckpointTypeEnum,
			description: "Checkpoint type",
			resolve: (cp) => (cp.type === "session" ? "SESSION" : "AGENT"),
		}),
		createdAt: t.field({
			type: "DateTime",
			description: "When the checkpoint was created",
			resolve: (cp) => cp.createdAt,
		}),
		fileCount: t.exposeInt("fileCount", {
			description: "Number of files in checkpoint",
		}),
		patternCount: t.exposeInt("patternCount", {
			description: "Number of glob patterns used",
		}),
		patterns: t.exposeStringList("patterns", {
			description: "Glob patterns used to capture files",
		}),
		path: t.exposeString("path", {
			description: "Path to checkpoint file",
		}),
	}),
});

/**
 * Checkpoint stats type
 */
interface CheckpointStatsData {
	totalCheckpoints: number;
	sessionCheckpoints: number;
	agentCheckpoints: number;
	totalFiles: number;
}

const CheckpointStatsRef =
	builder.objectRef<CheckpointStatsData>("CheckpointStats");

export const CheckpointStatsType = CheckpointStatsRef.implement({
	description: "Aggregate checkpoint statistics",
	fields: (t) => ({
		totalCheckpoints: t.exposeInt("totalCheckpoints", {
			description: "Total number of checkpoints",
		}),
		sessionCheckpoints: t.exposeInt("sessionCheckpoints", {
			description: "Number of session checkpoints",
		}),
		agentCheckpoints: t.exposeInt("agentCheckpoints", {
			description: "Number of agent checkpoints",
		}),
		totalFiles: t.exposeInt("totalFiles", {
			description: "Total files tracked across all checkpoints",
		}),
	}),
});

/**
 * Get all checkpoints
 */
export function getAllCheckpoints(): CheckpointSummary[] {
	return listCheckpointSummaries();
}

/**
 * Get checkpoint statistics
 */
export function queryCheckpointStats(): CheckpointStatsData {
	return getCheckpointStats();
}
