import type { CSSProperties, ReactNode } from "react";
import { View, type ViewStyle } from "react-native-web";
import { type SpacingKey, StyleSheet, spacing } from "../../theme.ts";

/** Extended style type allowing both ViewStyle and web CSSProperties */
type StackStyle = ViewStyle | CSSProperties;

export interface HStackProps {
	children?: ReactNode;
	style?: StackStyle;
	className?: string;
	gap?: SpacingKey;
	align?: ViewStyle["alignItems"];
	justify?: ViewStyle["justifyContent"];
	wrap?: boolean;
	flex?: ViewStyle["flex"];
	width?: ViewStyle["width"];
	p?: SpacingKey;
	px?: SpacingKey;
	py?: SpacingKey;
}

const baseStyle = StyleSheet.create({
	container: {
		display: "flex",
		flexDirection: "row",
	},
});

export function HStack({
	children,
	style,
	className,
	gap,
	align,
	justify,
	wrap,
	flex,
	width,
	p,
	px,
	py,
}: HStackProps) {
	const computedStyle = StyleSheet.flatten(
		[
			baseStyle.container,
			gap && { gap: spacing[gap] },
			align && { alignItems: align },
			justify && { justifyContent: justify },
			wrap && { flexWrap: "wrap" },
			flex !== undefined && { flex },
			width !== undefined && { width },
			p && { padding: spacing[p] },
			px && { paddingHorizontal: spacing[px] },
			py && { paddingVertical: spacing[py] },
			style,
		].filter(Boolean) as unknown as ViewStyle[],
	);

	return (
		<View className={className} style={computedStyle}>
			{children}
		</View>
	);
}
