/**
 * InlineCode Atom
 *
 * React Native compatible replacement for <code> HTML element.
 * Displays inline monospace text with subtle background styling.
 */

import type { CSSProperties, ReactNode } from "react";
import { Text as RNText, type TextStyle } from "react-native-web";
import {
	colors,
	type FontSizeKey,
	fontSizes,
	fonts,
	radii,
	StyleSheet,
} from "../../theme.ts";

/** Extended style type allowing both TextStyle and web CSSProperties */
type InlineCodeStyleExtended = TextStyle | CSSProperties;

export interface InlineCodeProps {
	children?: ReactNode;
	style?: InlineCodeStyleExtended;
	size?: FontSizeKey;
	/** Whether to show background styling (default: true) */
	showBackground?: boolean;
}

export function InlineCode({
	children,
	style,
	size = "sm",
	showBackground = true,
}: InlineCodeProps) {
	const computedStyle = StyleSheet.flatten(
		[
			{
				fontFamily: fonts.mono,
				fontSize: fontSizes[size],
				color: colors.text.primary,
			},
			showBackground && {
				backgroundColor: colors.bg.tertiary,
				paddingLeft: 4,
				paddingRight: 4,
				paddingTop: 2,
				paddingBottom: 2,
				borderRadius: radii.sm,
			},
			style,
		].filter(Boolean) as unknown as TextStyle[],
	);

	return <RNText style={computedStyle}>{children}</RNText>;
}
