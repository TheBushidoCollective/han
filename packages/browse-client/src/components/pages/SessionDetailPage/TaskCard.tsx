/**
 * Task Card Component
 *
 * Displays task information with type, status, and outcome badges.
 */

import type React from "react";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import type { Task } from "./types.ts";
import { formatDate, formatTaskDuration } from "./utils.ts";

/**
 * Get task type badge variant
 */
function getTaskTypeBadgeVariant(
	type: Task["type"],
): "success" | "danger" | "warning" | "default" {
	switch (type) {
		case "IMPLEMENTATION":
			return "success";
		case "FIX":
			return "danger";
		case "REFACTOR":
			return "warning";
		case "RESEARCH":
			return "default";
		default:
			return "default";
	}
}

/**
 * Get task status badge variant
 */
function getTaskStatusBadgeVariant(
	status: Task["status"],
): "info" | "success" | "danger" | "default" {
	switch (status) {
		case "ACTIVE":
			return "info";
		case "COMPLETED":
			return "success";
		case "FAILED":
			return "danger";
		default:
			return "default";
	}
}

interface TaskCardProps {
	task: Task;
}

export function TaskCard({ task }: TaskCardProps): React.ReactElement {
	return (
		<Box
			className={`task-card ${task.status === "ACTIVE" ? "task-active" : ""}`}
		>
			<HStack className="task-header" gap="sm" style={{ flexWrap: "wrap" }}>
				<Badge variant={getTaskTypeBadgeVariant(task.type)}>
					{task.type.toLowerCase()}
				</Badge>
				<Badge variant={getTaskStatusBadgeVariant(task.status)}>
					{task.status.toLowerCase()}
				</Badge>
				{task.outcome && (
					<Badge
						variant={
							task.outcome === "SUCCESS"
								? "success"
								: task.outcome === "PARTIAL"
									? "warning"
									: "danger"
						}
					>
						{task.outcome.toLowerCase()}
					</Badge>
				)}
			</HStack>
			<Text className="task-description">{task.description}</Text>
			<HStack className="task-meta" gap="md" style={{ flexWrap: "wrap" }}>
				<Text className="task-time" size="sm" color="muted">
					{formatDate(task.startedAt)}
				</Text>
				{task.durationSeconds !== null && (
					<Text className="task-duration" size="sm" color="muted">
						{formatTaskDuration(task.durationSeconds)}
					</Text>
				)}
				{task.confidence !== null && (
					<Text className="task-confidence" size="sm" color="muted">
						{Math.round(task.confidence * 100)}% confidence
					</Text>
				)}
			</HStack>
		</Box>
	);
}
