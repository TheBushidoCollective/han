/**
 * Task Type Badge Component
 *
 * Displays a badge for task type with appropriate color.
 */

import type React from "react";
import { Badge } from "@/components/atoms/Badge.tsx";

interface TaskTypeBadgeProps {
	type: string;
}

export function TaskTypeBadge({
	type,
}: TaskTypeBadgeProps): React.ReactElement {
	const variants: Record<
		string,
		"default" | "success" | "warning" | "danger" | "purple"
	> = {
		IMPLEMENTATION: "default",
		FIX: "danger",
		REFACTOR: "purple",
		RESEARCH: "success",
	};
	return (
		<Badge variant={variants[type] || "default"}>{type.toLowerCase()}</Badge>
	);
}
