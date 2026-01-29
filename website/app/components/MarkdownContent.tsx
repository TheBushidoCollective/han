"use client";

import { useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Mermaid } from "./Mermaid";

// Import highlight.js theme
import "highlight.js/styles/github-dark.css";

/**
 * Copy to clipboard button for code blocks
 */
function CopyButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
			aria-label="Copy code to clipboard"
		>
			{copied ? "Copied!" : "Copy"}
		</button>
	);
}

/**
 * Extract text content from code block children
 */
function extractCodeText(children: React.ReactNode): string {
	if (typeof children === "string") return children;
	if (Array.isArray(children)) {
		return children.map(extractCodeText).join("");
	}
	if (children && typeof children === "object" && "props" in children) {
		return extractCodeText(
			(children as React.ReactElement<{ children?: React.ReactNode }>).props
				.children,
		);
	}
	return "";
}

interface MarkdownContentProps {
	content: string;
	className?: string;
}

/**
 * Shared markdown renderer with Mermaid diagram support.
 * Use this component for rendering markdown content with:
 * - GitHub Flavored Markdown (tables, task lists, etc.)
 * - Syntax highlighting for code blocks
 * - Mermaid diagram rendering
 * - Copy button for code blocks
 */
export default function MarkdownContent({
	content,
	className = "",
}: MarkdownContentProps) {
	const markdownComponents: Components = {
		pre(props) {
			const { children, ...rest } = props;
			const child = children as
				| React.ReactElement<{ className?: string; children?: React.ReactNode }>
				| undefined;
			const isMermaid =
				child?.props?.className?.includes("language-mermaid") ||
				child?.type === Mermaid;

			if (isMermaid) {
				return <>{children}</>;
			}

			// Extract language from className
			const className = child?.props?.className || "";
			const langMatch = /language-(\w+)/.exec(className);
			const language = langMatch ? langMatch[1] : "";

			// Extract code text for copy button
			const codeText = extractCodeText(child?.props?.children);

			return (
				<div className="group relative not-prose my-4 rounded-lg overflow-hidden shadow-xl border border-gray-700/50">
					{/* Title bar */}
					<div className="flex items-center justify-between px-4 py-2 bg-[#1e293b] border-b border-gray-600/50 shadow-sm">
						<div className="flex items-center gap-2">
							{/* macOS-style dots */}
							<div className="flex gap-1.5">
								<span className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-sm" />
								<span className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-sm" />
								<span className="w-3 h-3 rounded-full bg-[#27c93f] shadow-sm" />
							</div>
							{language && (
								<span className="ml-3 text-xs text-gray-400 font-mono">
									{language}
								</span>
							)}
						</div>
						<CopyButton code={codeText} />
					</div>
					{/* Code content */}
					<pre
						{...rest}
						className="!m-0 !bg-[#0d1117] overflow-x-auto p-4 text-sm leading-relaxed"
						style={{ margin: 0, background: "#0d1117" }}
					>
						{children}
					</pre>
				</div>
			);
		},
		code(props) {
			const { children, className, ...rest } = props;
			const match = /language-(\w+)/.exec(className || "");
			const language = match ? match[1] : "";

			if (language === "mermaid") {
				return <Mermaid chart={String(children).replace(/\n$/, "")} />;
			}

			return (
				<code className={className} {...rest}>
					{children}
				</code>
			);
		},
	};

	return (
		<article
			className={`prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600 dark:prose-a:text-blue-400 ${className}`}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeHighlight]}
				components={markdownComponents}
			>
				{content}
			</ReactMarkdown>
		</article>
	);
}
