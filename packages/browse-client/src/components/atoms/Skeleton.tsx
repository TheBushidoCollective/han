import type { CSSProperties } from "react";
import { colors, type RadiusKey, radii } from "../../theme.ts";

interface SkeletonProps {
	width?: string | number;
	height?: string | number;
	borderRadius?: RadiusKey;
	style?: CSSProperties;
}

export function Skeleton({
	width = "100%",
	height = 20,
	borderRadius = "md",
	style,
}: SkeletonProps) {
	const computedStyle: CSSProperties = {
		backgroundColor: colors.bg.tertiary,
		borderRadius: radii[borderRadius],
		width,
		height,
		animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
		...style,
	};

	return (
		<>
			<style>
				{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
			</style>
			<div style={computedStyle} />
		</>
	);
}
