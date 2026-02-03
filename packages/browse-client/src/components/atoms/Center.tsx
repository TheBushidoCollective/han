import type { CSSProperties, ReactNode } from "react";
import { type SpacingKey, spacing } from "../../theme.ts";

export interface CenterProps {
	children?: ReactNode;
	style?: CSSProperties;
	className?: string;
	p?: SpacingKey;
	height?: CSSProperties["height"];
}

export function Center({ children, style, className, p, height }: CenterProps) {
	const computedStyle: CSSProperties = {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		...(p && { padding: spacing[p] }),
		...(height && { height }),
		...style,
	};

	return (
		<div className={className} style={computedStyle}>
			{children}
		</div>
	);
}
