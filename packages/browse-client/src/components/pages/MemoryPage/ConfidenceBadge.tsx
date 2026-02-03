/**
 * Confidence Badge Component
 *
 * Displays confidence level with appropriate color variant.
 */

import type React from "react";
import { Badge } from "@/components/atoms/Badge.tsx";

interface ConfidenceBadgeProps {
	confidence: string;
}

export function ConfidenceBadge({
	confidence,
}: ConfidenceBadgeProps): React.ReactElement {
	const variants: Record<string, "success" | "warning" | "danger" | "default"> =
		{
			HIGH: "success",
			MEDIUM: "warning",
			LOW: "danger",
		};
	return (
		<Badge variant={variants[confidence] || "default"}>
			{confidence.toLowerCase()}
		</Badge>
	);
}
