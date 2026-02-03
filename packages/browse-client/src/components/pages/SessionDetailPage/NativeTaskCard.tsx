/**
 * Native Task Card Component
 *
 * Displays native Claude Code tasks from TaskCreate/TaskUpdate tools.
 * These are distinct from Han's MCP metrics tasks.
 */

import type React from "react";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { colors, radii, spacing } from "@/theme.ts";
import type { NativeTask } from "./types.ts";

/**
 * Get status badge variant
 */
function getStatusBadgeVariant(
	status: NativeTask["status"],
): "info" | "success" | "default" {
	switch (status) {
		case "in_progress":
			return "info";
		case "completed":
			return "success";
		default:
			return "default";
	}
}

/**
 * Get status display label
 */
function getStatusLabel(status: NativeTask["status"]): string {
	switch (status) {
		case "in_progress":
			return "In Progress";
		case "completed":
			return "Completed";
		default:
			return "Pending";
	}
}

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	return `${diffDays}d ago`;
}

interface NativeTaskCardProps {
	task: NativeTask;
}

export function NativeTaskCard({
	task,
}: NativeTaskCardProps): React.ReactElement {
	const isBlocked = task.blockedBy.length > 0;
	const hasBlocking = task.blocks.length > 0;

	return (
		<Box
			style={{
				padding: spacing.md,
				backgroundColor: colors.bg.tertiary,
				borderRadius: radii.md,
				borderLeft: `3px solid ${
					task.status === "completed"
						? colors.success
						: task.status === "in_progress"
							? colors.primary
							: colors.border.default
				}`,
				opacity: task.status === "completed" ? 0.8 : 1,
			}}
		>
			<VStack gap="sm" align="stretch">
				{/* Header: Status badge and task ID */}
				<HStack gap="sm" style={{ flexWrap: "wrap" }} justify="space-between">
					<HStack gap="sm">
						<Badge variant={getStatusBadgeVariant(task.status)}>
							{getStatusLabel(task.status)}
						</Badge>
						<Text size="xs" color="muted">
							#{task.id}
						</Text>
					</HStack>
					{task.owner && (
						<Text size="xs" color="muted">
							{task.owner}
						</Text>
					)}
				</HStack>

				{/* Subject */}
				<Text
					weight="medium"
					style={{
						textDecoration:
							task.status === "completed" ? "line-through" : "none",
						color:
							task.status === "completed"
								? colors.text.muted
								: colors.text.primary,
					}}
				>
					{task.subject}
				</Text>

				{/* Description if present */}
				{task.description && (
					<Text size="sm" color="secondary" style={{ whiteSpace: "pre-wrap" }}>
						{task.description}
					</Text>
				)}

				{/* Active form (shown when in progress) */}
				{task.status === "in_progress" && task.activeForm && (
					<Text size="xs" color="muted" style={{ fontStyle: "italic" }}>
						{task.activeForm}...
					</Text>
				)}

				{/* Dependencies info */}
				{(isBlocked || hasBlocking) && (
					<HStack gap="md" style={{ flexWrap: "wrap" }}>
						{isBlocked && (
							<Text size="xs" style={{ color: colors.warning }}>
								Blocked by: {task.blockedBy.join(", ")}
							</Text>
						)}
						{hasBlocking && (
							<Text size="xs" color="muted">
								Blocks: {task.blocks.join(", ")}
							</Text>
						)}
					</HStack>
				)}

				{/* Timestamps */}
				<HStack gap="md" style={{ flexWrap: "wrap" }}>
					<Text size="xs" color="muted">
						Created {formatRelativeTime(task.createdAt)}
					</Text>
					{task.completedAt && (
						<Text size="xs" color="muted">
							Completed {formatRelativeTime(task.completedAt)}
						</Text>
					)}
				</HStack>
			</VStack>
		</Box>
	);
}
