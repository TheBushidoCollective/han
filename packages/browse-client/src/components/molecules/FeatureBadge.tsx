/**
 * Feature Badge Molecule
 *
 * Displays feature toggle status with label.
 * Shows On/Off state for configuration options.
 */

import type React from "react";
import { Badge } from "../atoms/index.ts";

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
