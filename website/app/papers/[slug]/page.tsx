import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
	formatAuthors,
	formatDate,
	getAllPapers,
	getPaper,
} from "../../../lib/papers";
import {
	formatPhaseName,
	getPhaseIcon,
	getRunbookCategories,
	getRunbooksForPaper,
} from "../../../lib/runbooks";
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

	const sourceUrl = `https://raw.githubusercontent.com/TheBushidoCollective/han/main/website/content/papers/${slug}.md`;

	return {
		title: `${paper.title} - Han Research`,
		description: paper.description,
		alternates: {
			types: {
				"text/markdown": sourceUrl,
			},
		},
		other: {
			"source-document": sourceUrl,
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

	// Load runbooks for this paper (if any)
	const runbooks = getRunbooksForPaper(slug);
	const runbookCategories = getRunbookCategories(slug);
	const runbooksByCategory = runbooks.reduce(
		(acc, runbook) => {
			if (!acc[runbook.phase]) {
				acc[runbook.phase] = [];
			}
			acc[runbook.phase].push(runbook);
			return acc;
		},
		{} as Record<string, typeof runbooks>,
	);

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<PaperChangesProvider sectionChanges={sectionChanges}>
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
					<div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-12">
						{/* TOC Sidebar - Hidden on mobile */}
						<aside className="hidden lg:block">
							<div className="sticky top-24">
								<PaperTableOfContents
									content={paper.content}
									sectionChanges={sectionChanges}
								>
									{/* Runbooks Section */}
									{runbooks.length > 0 && (
										<div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
											<div className="flex items-center justify-between mb-4">
												<h4 className="text-sm font-semibold text-gray-900 dark:text-white">
													Runbooks
												</h4>
												<Link
													href={`/papers/${slug}/runbooks`}
													className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
												>
													View all
												</Link>
											</div>
											<div className="space-y-4">
												{runbookCategories.map((category) => {
													const categoryRunbooks =
														runbooksByCategory[category] || [];
													if (categoryRunbooks.length === 0) return null;

													return (
														<div key={category}>
															<h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
																<span>{getPhaseIcon(category)}</span>
																<span>
																	{formatPhaseName(category).replace(
																		" Phase",
																		"",
																	)}
																</span>
															</h5>
															<ul className="space-y-1">
																{categoryRunbooks.map((runbook) => (
																	<li key={runbook.slug}>
																		<Link
																			href={`/papers/${slug}/runbooks/${runbook.slug}`}
																			className="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition truncate"
																		>
																			{runbook.title}
																		</Link>
																	</li>
																))}
															</ul>
														</div>
													);
												})}
											</div>
										</div>
									)}
								</PaperTableOfContents>
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
											<span>By {formatAuthors(paper.authors)}</span>
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

							{/* Hook + Quick Start - Only show for papers with runbooks */}
							{runbooks.length > 0 && (
								<section className="mb-10">
									{/* The Hook */}
									<div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-t-xl border border-b-0 border-gray-200 dark:border-gray-700">
										<p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
											You didn&apos;t fail at AI.
											<br />
											<span className="text-blue-600 dark:text-blue-400">
												You just handed it a human&apos;s job description.
											</span>
										</p>
										<h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
											Does this sound familiar?
										</h2>
										<ul className="space-y-2 text-gray-600 dark:text-gray-400">
											<li className="flex items-start gap-2">
												<span className="text-red-500 mt-0.5">✗</span>
												<span>
													AI generates code faster than you can review it
												</span>
											</li>
											<li className="flex items-start gap-2">
												<span className="text-red-500 mt-0.5">✗</span>
												<span>
													You&apos;re not sure when to trust AI vs. when to
													verify every line
												</span>
											</li>
											<li className="flex items-start gap-2">
												<span className="text-red-500 mt-0.5">✗</span>
												<span>
													Your team has no shared language for AI collaboration
												</span>
											</li>
											<li className="flex items-start gap-2">
												<span className="text-red-500 mt-0.5">✗</span>
												<span>
													Requirements are too vague for AI to execute
													autonomously
												</span>
											</li>
										</ul>
									</div>

									{/* The Transformation */}
									<div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-b-xl">
										<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
											What if you could...
										</h3>
										<ul className="space-y-2 text-gray-700 dark:text-gray-300 mb-6">
											<li className="flex items-start gap-2">
												<span className="text-green-500 mt-0.5">✓</span>
												<span>
													Know exactly when AI can work autonomously vs. when
													you need to be in the loop
												</span>
											</li>
											<li className="flex items-start gap-2">
												<span className="text-green-500 mt-0.5">✓</span>
												<span>
													Write requirements that AI can execute and verify
													without ambiguity
												</span>
											</li>
											<li className="flex items-start gap-2">
												<span className="text-green-500 mt-0.5">✓</span>
												<span>
													Trust AI output because your tests and types catch
													mistakes automatically
												</span>
											</li>
										</ul>

										<p className="text-gray-600 dark:text-gray-400 mb-6">
											That&apos;s what AI-DLC gives you. Start with the
											practical runbooks or dive into the theory.
										</p>

										<div className="flex flex-col sm:flex-row gap-4">
											<Link
												href={`/papers/${slug}/runbooks`}
												className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
											>
												<span>🚀</span>
												<span>Show me how</span>
											</Link>
											<a
												href="#paper-content"
												className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
											>
												<span>📖</span>
												<span>I want the theory first</span>
											</a>
										</div>
									</div>
								</section>
							)}

							{/* Revision History */}
							<div className="mb-6">
								<PaperRevisionHistory slug={paper.slug} />
							</div>

							{/* Content */}
							<div id="paper-content" className="scroll-mt-24" />
							<PaperContent
								content={paper.content}
								initialSectionChanges={sectionChanges}
							/>

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
			</PaperChangesProvider>
		</div>
	);
}
