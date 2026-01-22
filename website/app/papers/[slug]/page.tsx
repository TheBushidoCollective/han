import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { formatDate, getAllPapers, getPaper } from "../../../lib/papers";
import Header from "../../components/Header";
import { Mermaid } from "../../components/Mermaid";

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

// Custom components for ReactMarkdown
const markdownComponents: Components = {
	pre(props) {
		const { children, ...rest } = props;
		// Check if this pre contains a mermaid code block
		const child = children as any;
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
		const { children, className, node, ...rest } = props;
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

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="max-w-4xl mx-auto">
					{/* Header */}
					<header className="mb-12">
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

						<div className="border-t border-gray-200 dark:border-gray-800 pt-8" />
					</header>

					{/* Content */}
					<article className="prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600 dark:prose-a:text-blue-400">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							rehypePlugins={[rehypeRaw]}
							components={markdownComponents}
						>
							{paper.content}
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
