/**
 * Text Block Component
 *
 * Renders regular text content with markdown formatting.
 */

import type React from "react";
import { MarkdownContent } from "@/components/organisms/MarkdownContent.tsx";

interface TextBlockProps {
	text: string;
}

export function TextBlock({ text }: TextBlockProps): React.ReactElement {
	return <MarkdownContent>{text}</MarkdownContent>;
}
