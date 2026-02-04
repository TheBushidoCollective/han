import type { CSSProperties, ReactNode } from "react";
import { Text as RNText, type TextStyle } from "react-native-web";
import {
	colors,
	type FontSizeKey,
	type FontWeightKey,
	fontSizes,
	fonts,
	fontWeights,
	StyleSheet,
} from "../../theme.ts";

type TextColorKey =
	| "primary"
	| "secondary"
	| "muted"
	| "heading"
	| "accent"
	| "success"
	| "warning"
	| "danger";

/** Extended style type allowing both TextStyle and web CSSProperties */
type TextStyleExtended = TextStyle | CSSProperties;

export interface TextProps {
	children?: ReactNode;
	style?: TextStyleExtended;
	className?: string;
	size?: FontSizeKey;
	color?: TextColorKey;
	weight?: FontWeightKey | number;
	truncate?: boolean;
	title?: string;
	mono?: boolean;
	italic?: boolean;
	lineHeight?: TextStyle["lineHeight"];
	numberOfLines?: number;
	accessibilityLabel?: string;
}

const colorMap: Record<TextColorKey, string> = {
	primary: colors.text.primary,
	secondary: colors.text.secondary,
	muted: colors.text.muted,
	heading: colors.text.heading,
	accent: colors.text.accent,
	success: colors.success,
	warning: colors.warning,
	danger: colors.danger,
};

export function Text({
	children,
	style,
	className,
	size = "md",
	color = "primary",
	weight,
	truncate,
	title,
	mono,
	italic,
	lineHeight,
	numberOfLines,
	accessibilityLabel,
}: TextProps) {
	// Handle both string keys and numeric weights
	const resolvedWeight =
		weight !== undefined
			? typeof weight === "number"
				? String(weight)
				: fontWeights[weight]
			: undefined;

	const computedStyle = StyleSheet.flatten(
		[
			{ fontSize: fontSizes[size], color: colorMap[color] },
			resolvedWeight && { fontWeight: resolvedWeight },
			mono && { fontFamily: fonts.mono },
			italic && { fontStyle: "italic" },
			lineHeight && { lineHeight },
			style,
		].filter(Boolean) as unknown as TextStyle[],
	);

	return (
		<RNText
			style={computedStyle}
			className={className}
			title={title}
			numberOfLines={truncate ? 1 : numberOfLines}
			ellipsizeMode={truncate ? "tail" : undefined}
			accessibilityLabel={accessibilityLabel}
		>
			{children}
		</RNText>
	);
}
