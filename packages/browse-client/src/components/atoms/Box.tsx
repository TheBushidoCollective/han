import {
	forwardRef,
	type KeyboardEvent,
	type ReactNode,
	type UIEvent,
} from "react";
import { View, type ViewStyle } from "react-native-web";
import {
	type BackgroundKey,
	colors,
	type RadiusKey,
	radii,
	type SpacingKey,
	StyleSheet,
	spacing,
} from "../../theme.ts";

/**
 * Extended style type for Box component.
 * Allows both React Native ViewStyle and web-specific CSSProperties.
 * This is needed because react-native-web handles CSS properties at runtime,
 * but ViewStyle doesn't include web-only properties like wordBreak, whiteSpace, etc.
 */
type BoxStyle = ViewStyle;

export interface BoxProps {
	children?: ReactNode;
	style?: BoxStyle;
	className?: string;
	id?: string;
	bg?: BackgroundKey;
	p?: SpacingKey;
	px?: SpacingKey;
	py?: SpacingKey;
	pt?: SpacingKey;
	pb?: SpacingKey;
	pl?: SpacingKey;
	pr?: SpacingKey;
	m?: SpacingKey;
	mx?: SpacingKey;
	my?: SpacingKey;
	mt?: SpacingKey;
	mb?: SpacingKey;
	ml?: SpacingKey;
	mr?: SpacingKey;
	borderRadius?: RadiusKey;
	border?: boolean;
	flex?: ViewStyle["flex"];
	display?: ViewStyle["display"];
	position?: ViewStyle["position"];
	overflow?: ViewStyle["overflow"];
	overflowY?: "auto" | "scroll" | "hidden" | "visible";
	overflowX?: "auto" | "scroll" | "hidden" | "visible";
	width?: ViewStyle["width"];
	height?: ViewStyle["height"];
	minWidth?: ViewStyle["minWidth"];
	minHeight?: ViewStyle["minHeight"];
	maxWidth?: ViewStyle["maxWidth"];
	maxHeight?: ViewStyle["maxHeight"];
	onClick?: () => void;
	onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}

export const Box = forwardRef<HTMLDivElement, BoxProps>(function Box(
	{
		children,
		style,
		className,
		id,
		bg,
		p,
		px,
		py,
		pt,
		pb,
		pl,
		pr,
		m,
		mx,
		my,
		mt,
		mb,
		ml,
		mr,
		borderRadius,
		border,
		flex,
		display,
		position,
		overflow,
		overflowY,
		overflowX,
		width,
		height,
		minWidth,
		minHeight,
		maxWidth,
		maxHeight,
		onClick,
		onScroll,
	},
	ref,
) {
	// Cast to allow both ViewStyle and CSSProperties - react-native-web handles this at runtime
	const computedStyle = StyleSheet.flatten(
		[
			bg && { backgroundColor: colors.bg[bg] },
			p && { padding: spacing[p] },
			px && { paddingHorizontal: spacing[px] },
			py && { paddingVertical: spacing[py] },
			pt && { paddingTop: spacing[pt] },
			pb && { paddingBottom: spacing[pb] },
			pl && { paddingLeft: spacing[pl] },
			pr && { paddingRight: spacing[pr] },
			m && { margin: spacing[m] },
			mx && { marginHorizontal: spacing[mx] },
			my && { marginVertical: spacing[my] },
			mt && { marginTop: spacing[mt] },
			mb && { marginBottom: spacing[mb] },
			ml && { marginLeft: spacing[ml] },
			mr && { marginRight: spacing[mr] },
			borderRadius && { borderRadius: radii[borderRadius] },
			border && { borderWidth: 1, borderColor: colors.border.default },
			flex !== undefined && { flex },
			display && { display },
			position && { position },
			overflow && { overflow },
			overflowY && { overflowY },
			overflowX && { overflowX },
			width !== undefined && { width },
			height !== undefined && { height },
			minWidth !== undefined && { minWidth },
			minHeight !== undefined && { minHeight },
			maxWidth !== undefined && { maxWidth },
			maxHeight !== undefined && { maxHeight },
			onClick && { cursor: "pointer" },
			style,
		].filter(Boolean) as unknown as ViewStyle[],
	);

	const handleKeyDown = onClick
		? (e: KeyboardEvent<HTMLDivElement>) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick();
				}
			}
		: undefined;

	return (
		<View
			ref={ref}
			id={id}
			className={className}
			style={computedStyle}
			onClick={onClick}
			onKeyDown={handleKeyDown}
			onScroll={onScroll}
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
		>
			{children}
		</View>
	);
});
