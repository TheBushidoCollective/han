/**
 * Feature Badge Component
 *
 * Displays feature toggle status.
 */

import type React from "react";
import { Badge } from "@/components/atoms/Badge.tsx";

interface FeatureBadgeProps {
	label: string;
	enabled: boolean;
}

export function FeatureBadge({
	label,
	enabled,
}: FeatureBadgeProps): React.ReactElement {
	return (
		<Badge variant={enabled ? "success" : "default"}>
			{label}: {enabled ? "On" : "Off"}
		</Badge>
	);
}
