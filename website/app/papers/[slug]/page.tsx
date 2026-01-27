import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, getAllPapers, getPaper } from "../../../lib/papers";
import Header from "../../components/Header";
import { PaperChangesProvider } from "../../components/PaperChangesContext";
import PaperContent from "../../components/PaperContent";
import PaperRevisionHistory from "../../components/PaperRevisionHistory";
import PaperTableOfContents from "../../components/PaperTableOfContents";

interface SectionChange {
	section: string;
	originalSection?: string;
	isNew: boolean;
	isRemoved?: boolean;
	renamedFrom?: string;
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

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-12">
					{/* TOC Sidebar - Hidden on mobile */}
					<aside className="hidden lg:block">
						<div className="sticky top-24">
							<PaperTableOfContents
								content={paper.content}
								sectionChanges={sectionChanges}
							/>
						</div>
					</aside>

					{/* Main Content */}
					<div className="max-w-4xl">
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

						{/* Revision History and Content - wrapped in context provider */}
						<PaperChangesProvider sectionChanges={sectionChanges}>
							{/* Revision History */}
							<div className="mb-6">
								<PaperRevisionHistory slug={paper.slug} />
							</div>

							{/* Content */}
							<PaperContent
								content={paper.content}
								initialSectionChanges={sectionChanges}
							/>
						</PaperChangesProvider>

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
		</div>
	);
}
