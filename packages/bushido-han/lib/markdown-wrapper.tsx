import { Text } from "ink";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import React, { useMemo } from "react";

interface MarkdownWrapperProps {
	children: string;
}

// Configure marked globally with terminal renderer
marked.setOptions({
	// @ts-expect-error - marked-terminal types are not perfectly aligned
	renderer: new TerminalRenderer(),
});

const MarkdownWrapperInner: React.FC<MarkdownWrapperProps> = ({ children }) => {
	// Memoize the parsed markdown to prevent re-parsing on every render
	const output = useMemo(() => {
		try {
			const parsed = marked.parse(children);
			return typeof parsed === "string" ? parsed.trim() : "";
		} catch (_error) {
			// Fallback to plain text if markdown parsing fails
			return children;
		}
	}, [children]);

	return <Text>{output}</Text>;
};

// Memoize the entire component to prevent re-renders when children haven't changed
export const MarkdownWrapper = React.memo(MarkdownWrapperInner);
