import type { CSSProperties, ReactNode } from "react";
import { colors, fontSizes, radii } from "../../theme.ts";

export interface BadgeProps {
	children?: ReactNode;
	style?: CSSProperties;
	variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
}

const variantStyles: Record<string, CSSProperties> = {
	default: {
		backgroundColor: colors.bg.tertiary,
		color: colors.text.muted,
	},
	success: {
		backgroundColor: "rgba(63, 185, 80, 0.15)",
		color: colors.success,
	},
	warning: {
		backgroundColor: "rgba(210, 153, 34, 0.15)",
		color: colors.warning,
	},
	danger: {
		backgroundColor: "rgba(248, 81, 73, 0.15)",
		color: colors.danger,
	},
	info: {
		backgroundColor: "rgba(88, 166, 255, 0.15)",
		color: colors.primary,
	},
	purple: {
		backgroundColor: "rgba(163, 113, 247, 0.15)",
		color: colors.purple,
	},
};

export function Badge({ children, style, variant = "default" }: BadgeProps) {
	const computedStyle: CSSProperties = {
		display: "inline-block",
		padding: "2px 8px",
		borderRadius: radii.lg,
		fontSize: fontSizes.xs,
		fontWeight: 500,
		textTransform: "lowercase",
		...variantStyles[variant],
		...style,
	};

	return <span style={computedStyle}>{children}</span>;
}
