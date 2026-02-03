import type { ReactNode } from "react";
import { Text as RNText, type TextStyle } from "react-native-web";
import { colors, fontSizes, fontWeights, StyleSheet } from "../../theme.ts";

interface HeadingProps {
	children?: ReactNode;
	style?: TextStyle;
	size?: "sm" | "md" | "lg" | "xl";
	as?: "h1" | "h2" | "h3" | "h4";
}

const sizeMap = {
	sm: fontSizes.md,
	md: fontSizes.lg,
	lg: fontSizes.xl,
	xl: fontSizes.xxl,
};

const baseStyles = StyleSheet.create({
	heading: {
		color: colors.text.heading,
		fontWeight: fontWeights.semibold,
		margin: 0,
	},
});

export function Heading({
	children,
	style,
	size = "md",
	as: _Tag = "h2",
}: HeadingProps) {
	const computedStyle = StyleSheet.flatten(
		[baseStyles.heading, { fontSize: sizeMap[size] }, style].filter(
			Boolean,
		) as TextStyle[],
	);

	// React Native Web's Text doesn't support semantic HTML tags directly,
	// but it renders as a span. For accessibility, we'd need a wrapper.
	// For now, using RNText for consistency with the styling system.
	return (
		<RNText style={computedStyle} role="heading">
			{children}
		</RNText>
	);
}
