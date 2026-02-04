import {
	type CSSProperties,
	type KeyboardEvent,
	type ReactNode,
	useState,
} from "react";
import { colors, radii, spacing } from "../../theme.ts";

interface CardProps {
	children?: ReactNode;
	style?: CSSProperties;
	onClick?: () => void;
	hoverable?: boolean;
	p?: "sm" | "md" | "lg";
}

export function Card({
	children,
	style,
	onClick,
	hoverable,
	p = "lg",
}: CardProps) {
	const [isHovered, setIsHovered] = useState(false);

	const computedStyle: CSSProperties = {
		backgroundColor: colors.bg.secondary,
		border: `1px solid ${colors.border.default}`,
		borderRadius: radii.lg,
		padding: spacing[p],
		cursor: onClick ? "pointer" : "default",
		transition: "background-color 0.15s",
		...((hoverable || onClick) &&
			isHovered && {
				backgroundColor: colors.bg.tertiary,
			}),
		...style,
	};

	const handleKeyDown = onClick
		? (e: KeyboardEvent<HTMLDivElement>) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick();
				}
			}
		: undefined;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Card is a generic container that optionally supports click handlers
		<div
			style={computedStyle}
			onClick={onClick}
			onKeyDown={handleKeyDown}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
		>
			{children}
		</div>
	);
}
