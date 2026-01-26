import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { formatDate, getAllPapers, getPaper } from "../../../lib/papers";
import Header from "../../components/Header";
import { Mermaid } from "../../components/Mermaid";
import PaperRevisionHistory from "../../components/PaperRevisionHistory";

interface SectionChange {
	section: string;
	isNew: boolean;
	linesAdded: number;
	linesRemoved: number;
}

interface PaperRevisions {
	slug: string;
	currentVersion: string;
	revisions: Array<{
		sectionChanges: SectionChange[];
	}>;
	newSections: string[];
}

/**
 * Load paper revision data at build time
 */
function getPaperRevisions(slug: string): PaperRevisions | null {
	try {
		const filePath = path.join(
			process.cwd(),
			"public",
			"data",
			"paper-revisions.json",
		);
		const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		return data[slug] || null;
	} catch {
		return null;
	}
}

/**
 * Normalize section name for comparison
 */
function normalizeSection(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, "")
		.trim();
}

/**
 * Check if a heading matches a section change
 */
function getSectionBadge(
	headingText: string,
	sectionChanges: SectionChange[],
): "new" | "updated" | null {
	const normalized = normalizeSection(headingText);

	for (const change of sectionChanges) {
		const normalizedSection = normalizeSection(change.section);
		// Check for match (allowing partial matches for numbered sections)
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

/**
 * Strip the leading title (H1), subtitle (H2), and horizontal rule from markdown content
 * since we already render these from frontmatter in the page header
 */
function stripLeadingTitleFromContent(content: string): string {
	// Pattern to match:
	// - Optional markdownlint disable comment
	// - H1 title (# ...)
	// - Optional H2 subtitle (## ...)
	// - Optional horizontal rule (---)
	const lines = content.split("\n");
	let startIndex = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		// Skip empty lines and comments at the start
		if (line === "" || line.startsWith("<!--")) {
			startIndex = i + 1;
			continue;
		}

		// If we hit the H1 title, skip it
		if (line.startsWith("# ")) {
			startIndex = i + 1;
			continue;
		}

		// If we hit the H2 subtitle (immediately after H1), skip it
		if (line.startsWith("## ") && startIndex === i) {
			startIndex = i + 1;
			continue;
		}

		// If we hit a horizontal rule after title/subtitle, skip it
		if (line === "---" && startIndex === i) {
			startIndex = i + 1;
			continue;
		}

		// Found actual content, stop here
		break;
	}

	return lines.slice(startIndex).join("\n").trimStart();
}

export async function generateStaticParams() {
	const papers = getAllPapers();
	return papers.map((paper) => ({
		slug: paper.slug,
	}));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const paper = getPaper(slug);

	if (!paper) {
		return {
			title: "Paper Not Found - Han",
		};
	}

	return {
		title: `${paper.title} - Han Research`,
		description: paper.description,
	};
}

/**
 * Badge component for section headings
 */
function SectionBadge({ type }: { type: "new" | "updated" }) {
	return (
		<span
			className={`ml-3 px-2 py-0.5 text-xs font-bold uppercase rounded-full align-middle ${
				type === "new"
					? "bg-green-500 text-white"
					: "bg-yellow-400 text-yellow-900"
			}`}
		>
			{type}
		</span>
	);
}

/**
 * Create custom components for ReactMarkdown with section badges
 */
function createMarkdownComponents(
	sectionChanges: SectionChange[],
): Components {
	// Create heading components that add badges
	const createHeading = (level: 2 | 3 | 4) => {
		const HeadingComponent = ({
			children,
			...props
		}: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => {
			const headingText =
				typeof children === "string"
					? children
					: Array.isArray(children)
						? children
								.filter((c) => typeof c === "string")
								.join("")
						: "";

			const badge = getSectionBadge(headingText, sectionChanges);
			const Tag = `h${level}` as const;

			return (
				<Tag {...props}>
					{children}
					{badge && <SectionBadge type={badge} />}
				</Tag>
			);
		};
		return HeadingComponent;
	};

	return {
		h2: createHeading(2),
		h3: createHeading(3),
		h4: createHeading(4),
		pre(props) {
			const { children, ...rest } = props;
			// Check if this pre contains a mermaid code block
			const child = children as
				| React.ReactElement<{ className?: string }>
				| undefined;
			const isMermaid =
				child?.props?.className?.includes("language-mermaid") ||
				child?.type === Mermaid;

			// If it's a Mermaid diagram, render without the pre wrapper
			if (isMermaid) {
				return <>{children}</>;
			}

			// Regular pre blocks
			return <pre {...rest}>{children}</pre>;
		},
		code(props) {
			const { children, className, ...rest } = props;
			const match = /language-(\w+)/.exec(className || "");
			const language = match ? match[1] : "";

			// Render Mermaid diagrams
			if (language === "mermaid") {
				return <Mermaid chart={String(children).replace(/\n$/, "")} />;
			}

			// Regular code blocks
			return (
				<code className={className} {...rest}>
					{children}
				</code>
			);
		},
	};
}

export default async function PaperPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const paper = getPaper(slug);

	if (!paper) {
		notFound();
	}

	// Load revision data and get section changes from latest revision
	const revisions = getPaperRevisions(slug);
	const latestRevision = revisions?.revisions[0];
	const sectionChanges = latestRevision?.sectionChanges || [];

	// Create markdown components with section badges
	const markdownComponents = createMarkdownComponents(sectionChanges);

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="max-w-4xl mx-auto">
					{/* Header */}
					<header className="mb-6">
						<Link
							href="/papers"
							className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition mb-6"
						>
							← Back to Papers
						</Link>

						<div className="mb-6">
							<h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-3">
								{paper.title}
							</h1>
							{paper.subtitle && (
								<p className="text-2xl text-gray-600 dark:text-gray-400">
									{paper.subtitle}
								</p>
							)}
						</div>

						<div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
							<time dateTime={paper.date}>{formatDate(paper.date)}</time>
							{paper.authors.length > 0 && (
								<>
									<span>•</span>
									<span>By {paper.authors.join(", ")}</span>
								</>
							)}
						</div>

						<p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
							{paper.description}
						</p>

						{paper.tags.length > 0 && (
							<div className="flex flex-wrap gap-2 mb-8">
								{paper.tags.map((tag) => (
									<span
										key={tag}
										className="inline-block px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full"
									>
										{tag}
									</span>
								))}
							</div>
						)}

						</header>

					{/* Revision History */}
					<div className="mb-6">
						<PaperRevisionHistory slug={paper.slug} />
					</div>

					{/* Content */}
					<article className="prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600 dark:prose-a:text-blue-400">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							rehypePlugins={[rehypeRaw, rehypeSlug]}
							components={markdownComponents}
						>
							{stripLeadingTitleFromContent(paper.content)}
						</ReactMarkdown>
					</article>

					{/* Footer */}
					<footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
						<div className="flex items-center justify-between">
							<Link
								href="/papers"
								className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
							>
								← Back to all papers
							</Link>

							<div className="flex items-center gap-4">
								<a
									href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(paper.title)}&url=${encodeURIComponent(`https://han.guru/papers/${paper.slug}`)}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
								>
									Share on Twitter
								</a>
							</div>
						</div>
					</footer>
				</div>
			</div>
		</div>
	);
}
