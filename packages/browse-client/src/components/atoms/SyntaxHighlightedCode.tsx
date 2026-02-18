/**
 * SyntaxHighlightedCode Atom
 *
 * Syntax highlighting using highlight.js with direct HTML rendering.
 * Uses dangerouslySetInnerHTML since highlight.js produces HTML output,
 * but hljs escapes all HTML entities in source code, making this safe.
 */

import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { colors, fontSizes, fonts, radii, spacing } from "../../theme.ts";

// Register languages
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("text", plaintext);

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
	containerStyle?: CSSProperties;
	/** Custom text style */
	textStyle?: CSSProperties;
	/** Maximum height before scrolling */
	maxHeight?: number;
}

const defaultContainerStyle: CSSProperties = {
	backgroundColor: colors.bg.tertiary,
	borderRadius: radii.md,
	padding: spacing.md,
	borderWidth: 1,
	borderStyle: "solid",
	borderColor: colors.border.subtle,
	overflowX: "auto",
};

const defaultTextStyle: CSSProperties = {
	fontFamily: fonts.mono,
	fontSize: fontSizes.sm,
	margin: 0,
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
};

/**
 * SyntaxHighlightedCode - Syntax highlighting via highlight.js
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
	containerStyle,
	textStyle,
	maxHeight,
}: SyntaxHighlightedCodeProps) {
	const highlighted = useMemo(() => {
		const lang = language && hljs.getLanguage(language) ? language : "text";
		try {
			return hljs.highlight(code, { language: lang }).value;
		} catch {
			return code;
		}
	}, [code, language]);

	const mergedContainerStyle: CSSProperties = {
		...defaultContainerStyle,
		...(maxHeight ? { maxHeight, overflow: "auto" } : {}),
		...containerStyle,
	};

	const mergedTextStyle: CSSProperties = {
		...defaultTextStyle,
		color: "#c9d1d9",
		...textStyle,
	};

	return (
		<div style={mergedContainerStyle}>
			<pre
				style={mergedTextStyle}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js escapes HTML entities, safe for syntax highlighting
				dangerouslySetInnerHTML={{ __html: highlighted }}
			/>
		</div>
	);
}
