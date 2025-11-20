import { Text } from "ink";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import type React from "react";

interface MarkdownWrapperProps {
	children: string;
}

// Configure marked globally with terminal renderer
marked.setOptions({
	// @ts-expect-error - marked-terminal types are not perfectly aligned
	renderer: new TerminalRenderer(),
});

export const MarkdownWrapper: React.FC<MarkdownWrapperProps> = ({
	children,
}) => {
	try {
		const parsed = marked.parse(children);
		const output = typeof parsed === "string" ? parsed.trim() : "";
		return <Text>{output}</Text>;
	} catch (_error) {
		// Fallback to plain text if markdown parsing fails
		return <Text wrap="wrap">{children}</Text>;
	}
};
