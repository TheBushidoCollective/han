"use client";

import { diffLines, diffWords } from "diff";
import { useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { Mermaid } from "./Mermaid";
import { usePaperChanges } from "./PaperChangesContext";

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

interface SectionChange {
	section: string;
	originalSection?: string;
	isNew: boolean;
	isRemoved?: boolean;
	renamedFrom?: string;
	linesAdded: number;
	linesRemoved: number;
}

function normalizeSection(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, "")
		.trim();
}

function getSectionBadge(
	headingText: string,
	sectionChanges: SectionChange[],
): "new" | "updated" | null {
	const normalized = normalizeSection(headingText);

	for (const change of sectionChanges) {
		const normalizedSection = normalizeSection(change.section);
		if (
			normalized === normalizedSection ||
			normalizedSection.includes(normalized) ||
			normalized.includes(normalizedSection)
		) {
			return change.isNew ? "new" : "updated";
		}
	}
	return null;
}

function SectionBadge({ type }: { type: "new" | "updated" }) {
	return (
		<span
			className={`px-2 py-0.5 text-xs font-bold uppercase rounded-full ${
				type === "new"
					? "bg-green-500 text-white"
					: "bg-yellow-400 text-yellow-900"
			}`}
		>
			{type}
		</span>
	);
}

interface MermaidBlock {
	content: string;
	placeholder: string;
}

interface ExtractedContent {
	text: string;
	mermaidBlocks: MermaidBlock[];
}

/**
 * Extract mermaid code blocks and replace with placeholders
 * Uses a div with data attribute, surrounded by blank lines to ensure block-level
 * treatment and prevent being wrapped in <p> tags (which causes hydration errors)
 */
function extractMermaidBlocks(content: string): ExtractedContent {
	const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
	const blocks: MermaidBlock[] = [];
	let index = 0;

	const text = content.replace(mermaidRegex, (_, mermaidContent) => {
		const placeholder = `MERMAID_PLACEHOLDER_${index}`;
		blocks.push({ content: mermaidContent.trim(), placeholder });
		index++;
		// Use a div with blank lines to ensure block-level treatment
		return `\n\n<div data-mermaid-index="${index - 1}"></div>\n\n`;
	});

	return { text, mermaidBlocks: blocks };
}

interface MermaidDiff {
	type: "unchanged" | "added" | "removed" | "modified";
	current?: string;
	previous?: string;
}

/**
 * Compare mermaid blocks between versions
 * Returns a map keyed by index (0, 1, 2, etc.)
 */
function compareMermaidBlocks(
	currentBlocks: MermaidBlock[],
	previousBlocks: MermaidBlock[],
): Map<number, MermaidDiff> {
	const diffs = new Map<number, MermaidDiff>();

	// Match blocks by index (simple approach)
	const maxLen = Math.max(currentBlocks.length, previousBlocks.length);

	for (let i = 0; i < maxLen; i++) {
		const current = currentBlocks[i];
		const previous = previousBlocks[i];

		if (current && previous) {
			if (current.content === previous.content) {
				diffs.set(i, { type: "unchanged", current: current.content });
			} else {
				diffs.set(i, {
					type: "modified",
					current: current.content,
					previous: previous.content,
				});
			}
		} else if (current && !previous) {
			diffs.set(i, { type: "added", current: current.content });
		} else if (!current && previous) {
			diffs.set(i, { type: "removed", previous: previous.content });
		}
	}

	return diffs;
}

/**
 * Check if content should use block diff (code blocks, tables)
 * These structures break when word-diffed
 */
function shouldUseBlockDiff(content: string): boolean {
	const trimmed = content.trim();
	// Code blocks
	if (trimmed.startsWith("```") || trimmed.startsWith("    ")) {
		return true;
	}
	// Tables (contain pipe characters in a structured way)
	if (trimmed.includes("|") && trimmed.includes("---")) {
		return true;
	}
	// Lines starting with pipe (table rows)
	if (/^\s*\|/.test(trimmed)) {
		return true;
	}
	return false;
}

/**
 * Escape HTML special characters in text for inline diffs
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/**
 * Apply word-level diff within a block, preserving markdown structure
 */
function wordDiffBlock(oldText: string, newText: string): string {
	const words = diffWords(oldText, newText);
	let result = "";

	for (const part of words) {
		if (part.added) {
			result += `<ins class="diff-added">${escapeHtml(part.value)}</ins>`;
		} else if (part.removed) {
			result += `<del class="diff-removed">${escapeHtml(part.value)}</del>`;
		} else {
			result += part.value;
		}
	}

	return result;
}

/**
 * Build markdown content with hybrid diff strategy:
 * - Word-level diff for minor edits within existing blocks
 * - Block-level diff for entirely new/removed sections
 * - Code blocks always use block diff to preserve formatting
 * - Mermaid blocks compared as complete diagrams
 */
function buildDiffMarkdown(
	currentContent: string,
	previousContent: string,
): { markdown: string; mermaidDiffs: Map<number, MermaidDiff> } {
	// Extract mermaid blocks first
	const currentExtracted = extractMermaidBlocks(currentContent);
	const previousExtracted = extractMermaidBlocks(previousContent);

	// Compare mermaid blocks
	const mermaidDiffs = compareMermaidBlocks(
		currentExtracted.mermaidBlocks,
		previousExtracted.mermaidBlocks,
	);

	// Use line-level diff to identify changes
	const lineDiff = diffLines(previousExtracted.text, currentExtracted.text);
	let result = "";
	let i = 0;

	while (i < lineDiff.length) {
		const part = lineDiff[i];

		// Skip empty parts
		if (!part.value) {
			i++;
			continue;
		}

		// Check for mermaid placeholder
		const hasMermaidPlaceholder = part.value.includes("data-mermaid-index=");

		if (!part.added && !part.removed) {
			// Unchanged - pass through
			result += part.value;
			i++;
		} else if (part.removed && lineDiff[i + 1]?.added) {
			// Consecutive remove + add = likely an edit to existing content
			const removed = part.value;
			const added = lineDiff[i + 1].value;

			// Check if either is a code block - use block diff
			if (shouldUseBlockDiff(removed) || shouldUseBlockDiff(added)) {
				result += `<div class="diff-removed-block">\n\n${removed}\n</div>\n\n`;
				result += `<div class="diff-added-block">\n\n${added}\n</div>\n\n`;
			} else if (
				hasMermaidPlaceholder ||
				added.includes("data-mermaid-index=")
			) {
				// Mermaid placeholders - pass through, MermaidDiffBlock handles display
				result += added;
			} else {
				// Use word-level diff for inline changes
				result += wordDiffBlock(removed, added);
			}
			i += 2;
		} else if (part.added) {
			if (hasMermaidPlaceholder) {
				result += part.value;
			} else if (shouldUseBlockDiff(part.value)) {
				result += `<div class="diff-added-block">\n\n${part.value}\n</div>\n\n`;
			} else {
				// New block added - use block styling
				result += `<div class="diff-added-block">\n\n${part.value}\n</div>\n\n`;
			}
			i++;
		} else if (part.removed) {
			if (hasMermaidPlaceholder) {
				// Skip - MermaidDiffBlock handles removed diagrams
				i++;
				continue;
			}
			if (shouldUseBlockDiff(part.value)) {
				result += `<div class="diff-removed-block">\n\n${part.value}\n</div>\n\n`;
			} else {
				// Block removed - use block styling
				result += `<div class="diff-removed-block">\n\n${part.value}\n</div>\n\n`;
			}
			i++;
		} else {
			i++;
		}
	}

	return { markdown: result, mermaidDiffs };
}

/**
 * Component to render a mermaid diagram with diff status
 */
function MermaidDiffBlock({ diff }: { diff: MermaidDiff }) {
	if (diff.type === "unchanged" && diff.current) {
		return <Mermaid chart={diff.current} />;
	}

	if (diff.type === "added" && diff.current) {
		return (
			<div className="border-l-4 border-green-500 pl-4 my-4 bg-green-50 dark:bg-green-900/20 rounded-r p-4">
				<div className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
					New Diagram
				</div>
				<Mermaid chart={diff.current} />
			</div>
		);
	}

	if (diff.type === "removed" && diff.previous) {
		return (
			<div className="border-l-4 border-red-500 pl-4 my-4 bg-red-50 dark:bg-red-900/20 rounded-r p-4 opacity-60">
				<div className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
					Removed Diagram
				</div>
				<Mermaid chart={diff.previous} />
			</div>
		);
	}

	if (diff.type === "modified" && diff.current && diff.previous) {
		return (
			<div className="my-4 space-y-4">
				<div className="border-l-4 border-red-500 pl-4 bg-red-50 dark:bg-red-900/20 rounded-r p-4 opacity-60">
					<div className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
						Previous Diagram
					</div>
					<Mermaid chart={diff.previous} />
				</div>
				<div className="border-l-4 border-green-500 pl-4 bg-green-50 dark:bg-green-900/20 rounded-r p-4">
					<div className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
						Updated Diagram
					</div>
					<Mermaid chart={diff.current} />
				</div>
			</div>
		);
	}

	return null;
}

interface PaperContentProps {
	content: string;
	initialSectionChanges: SectionChange[];
}

export default function PaperContent({
	content,
	initialSectionChanges,
}: PaperContentProps) {
	const { sectionChanges, compareContent, compareVersion, isLoadingCompare } =
		usePaperChanges();

	// Use context sectionChanges if available, otherwise fall back to initial
	const changes =
		sectionChanges.length > 0 ? sectionChanges : initialSectionChanges;

	// Create heading components that add badges
	const createHeading = (level: 2 | 3 | 4) => {
		const HeadingComponent = ({
			children,
			...props
		}: React.HTMLAttributes<HTMLHeadingElement> & {
			children?: React.ReactNode;
		}) => {
			const headingText =
				typeof children === "string"
					? children
					: Array.isArray(children)
						? children.filter((c) => typeof c === "string").join("")
						: "";

			const badge = getSectionBadge(headingText, changes);
			const Tag = `h${level}` as const;

			// Use flex layout for proper badge alignment
			if (badge) {
				return (
					<Tag {...props} className="flex items-center gap-3">
						<span>{children}</span>
						<SectionBadge type={badge} />
					</Tag>
				);
			}

			return <Tag {...props}>{children}</Tag>;
		};
		return HeadingComponent;
	};

	const markdownComponents: Components = {
		h2: createHeading(2),
		h3: createHeading(3),
		h4: createHeading(4),
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
				<div className="group relative not-prose my-4 rounded-lg overflow-hidden shadow-lg">
					{/* Title bar */}
					<div className="flex items-center justify-between px-4 py-2 bg-[#1e293b]">
						<div className="flex items-center gap-2">
							{/* macOS-style dots */}
							<div className="flex gap-1.5">
								<span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
								<span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
								<span className="w-3 h-3 rounded-full bg-[#27c93f]" />
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

	// Show loading state while fetching compare content
	if (isLoadingCompare) {
		return (
			<div className="prose prose-lg dark:prose-invert max-w-none">
				<div className="animate-pulse space-y-4">
					<div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
					<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
					<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
					<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
				</div>
			</div>
		);
	}

	// Show inline word-level diff when comparing versions
	if (compareVersion && compareContent) {
		const { markdown: diffMarkdown, mermaidDiffs } = buildDiffMarkdown(
			content,
			compareContent,
		);

		// Create diff-specific components - no badges needed since diff shows changes
		const diffComponents: Components = {
			...markdownComponents,
			// Use default headings in diff mode (no badges)
			h2: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
			h3: ({ children, ...props }) => <h3 {...props}>{children}</h3>,
			h4: ({ children, ...props }) => <h4 {...props}>{children}</h4>,
			// Override div to handle mermaid placeholders
			div(props) {
				const mermaidIndex = (props as { "data-mermaid-index"?: string })[
					"data-mermaid-index"
				];
				if (mermaidIndex !== undefined) {
					const index = Number.parseInt(mermaidIndex, 10);
					const diff = mermaidDiffs.get(index);
					if (diff) {
						return <MermaidDiffBlock diff={diff} />;
					}
					return null;
				}
				// Default div behavior
				return <div {...props} />;
			},
		};

		return (
			<div>
				<div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
					<div className="flex items-center gap-4 text-sm">
						<span className="flex items-center gap-2">
							<ins className="diff-added no-underline">added text</ins>
						</span>
						<span className="flex items-center gap-2">
							<del className="diff-removed">removed text</del>
						</span>
					</div>
				</div>
				{/* Inline styles for diff markers */}
				<style>{`
					.diff-added {
						background-color: rgb(187 247 208);
						border-radius: 0.125rem;
						padding: 0 0.125rem;
						text-decoration: none;
					}
					.dark .diff-added {
						background-color: rgb(20 83 45 / 0.6);
					}
					.diff-removed {
						background-color: rgb(254 202 202);
						border-radius: 0.125rem;
						padding: 0 0.125rem;
						text-decoration: line-through;
					}
					.dark .diff-removed {
						background-color: rgb(127 29 29 / 0.6);
					}
					/* Block-level diff styles for multi-line content */
					.diff-added-block {
						background-color: rgb(187 247 208 / 0.3);
						border-left: 4px solid rgb(34 197 94);
						padding: 1rem;
						margin: 1rem 0;
						border-radius: 0.25rem;
					}
					.dark .diff-added-block {
						background-color: rgb(20 83 45 / 0.3);
						border-left-color: rgb(34 197 94);
					}
					.diff-removed-block {
						background-color: rgb(254 202 202 / 0.3);
						border-left: 4px solid rgb(239 68 68);
						padding: 1rem;
						margin: 1rem 0;
						border-radius: 0.25rem;
						text-decoration: line-through;
						opacity: 0.7;
					}
					.dark .diff-removed-block {
						background-color: rgb(127 29 29 / 0.3);
						border-left-color: rgb(239 68 68);
					}
				`}</style>
				<article className="prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600 dark:prose-a:text-blue-400">
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						rehypePlugins={[rehypeRaw, rehypeSlug, rehypeHighlight]}
						components={diffComponents}
					>
						{diffMarkdown}
					</ReactMarkdown>
				</article>
			</div>
		);
	}

	// Normal markdown rendering
	return (
		<article className="prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600 dark:prose-a:text-blue-400">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeRaw, rehypeSlug, rehypeHighlight]}
				components={markdownComponents}
			>
				{content}
			</ReactMarkdown>
		</article>
	);
}
