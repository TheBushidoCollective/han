/**
 * SubwayLine - Visual connector for parent-child message pairs.
 *
 * Renders a vertical colored bar on the left edge of a message
 * to indicate it belongs to a group (parent → child relationship).
 */

import type React from "react";
import { Box } from "./Box.tsx";
import { radii, spacing } from "@/theme.ts";

interface SubwayLineProps {
	/** Color of the subway line */
	color: string;
	/** Whether this is the parent (top of the group) */
	isParent: boolean;
	/** Whether this is a child (bottom/continuation) */
	isChild: boolean;
}

export function SubwayLine({
	color,
	isParent,
	isChild,
}: SubwayLineProps): React.ReactElement {
	return (
		<Box
			style={{
				width: 3,
				alignSelf: "stretch",
				backgroundColor: color,
				opacity: 0.7,
				borderTopLeftRadius: isParent && !isChild ? radii.sm : 0,
				borderTopRightRadius: isParent && !isChild ? radii.sm : 0,
				borderBottomLeftRadius: isChild && !isParent ? radii.sm : 0,
				borderBottomRightRadius: isChild && !isParent ? radii.sm : 0,
				marginRight: spacing.sm,
				flexShrink: 0,
			}}
		/>
	);
}
