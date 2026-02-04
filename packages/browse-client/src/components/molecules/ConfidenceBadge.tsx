/**
 * Confidence Badge Molecule
 *
 * Displays confidence level with appropriate color variant.
 * Maps HIGH/MEDIUM/LOW to success/warning/danger badge variants.
 */

import type React from "react";
import { Badge } from "../atoms/index.ts";

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
