/**
 * SyntaxHighlightedCode Atom
 *
 * Cross-platform syntax highlighting using react-native-code-highlighter.
 * Works on both web (via react-native-web) and native platforms.
 *
 * Uses react-syntax-highlighter under the hood with support for
 * multiple languages and themes.
 */

import CodeHighlighter from "react-native-code-highlighter";
import type { TextStyle, ViewStyle } from "react-native-web";
import {
	atomOneDark,
	atomOneLight,
} from "react-syntax-highlighter/dist/esm/styles/hljs";
import { colors, fontSizes, fonts, radii, spacing } from "../../theme.ts";

export type SyntaxTheme = "dark" | "light";

export interface SyntaxHighlightedCodeProps {
	/** The code to highlight */
	code: string;
	/** Programming language for syntax highlighting */
	language?: string;
	/** Color theme */
	theme?: SyntaxTheme;
	/** Whether to show line numbers */
	showLineNumbers?: boolean;
	/** Custom container style */
	containerStyle?: ViewStyle;
	/** Custom text style */
	textStyle?: TextStyle;
	/** Maximum height before scrolling */
	maxHeight?: number;
}

/**
 * Default container style matching our design system
 */
const defaultContainerStyle: ViewStyle = {
	backgroundColor: colors.bg.tertiary,
	borderRadius: radii.md,
	padding: spacing.md,
	borderWidth: 1,
	borderColor: colors.border.subtle,
};

/**
 * Default text style for code
 */
const defaultTextStyle: TextStyle = {
	fontFamily: fonts.mono,
	fontSize: fontSizes.sm,
};

/**
 * SyntaxHighlightedCode - Cross-platform syntax highlighting component
 *
 * @example
 * ```tsx
 * <SyntaxHighlightedCode
 *   code="const x = 1;"
 *   language="javascript"
 * />
 * ```
 */
export function SyntaxHighlightedCode({
	code,
	language = "text",
	theme = "dark",
	showLineNumbers = false,
	containerStyle,
	textStyle,
	maxHeight,
}: SyntaxHighlightedCodeProps) {
	const syntaxTheme = theme === "dark" ? atomOneDark : atomOneLight;

	const mergedContainerStyle: ViewStyle = {
		...defaultContainerStyle,
		...(maxHeight && { maxHeight, overflow: "scroll" as const }),
		...containerStyle,
	};

	const mergedTextStyle: TextStyle = {
		...defaultTextStyle,
		...textStyle,
	};

	return (
		<CodeHighlighter
			hljsStyle={syntaxTheme}
			language={language}
			scrollViewProps={{
				// biome-ignore lint/suspicious/noExplicitAny: react-native-web ViewStyle differs from react-native ViewStyle
				contentContainerStyle: mergedContainerStyle as any,
			}}
			// biome-ignore lint/suspicious/noExplicitAny: react-native-web TextStyle differs from react-native TextStyle
			textStyle={mergedTextStyle as any}
			showLineNumbers={showLineNumbers}
		>
			{code}
		</CodeHighlighter>
	);
}
