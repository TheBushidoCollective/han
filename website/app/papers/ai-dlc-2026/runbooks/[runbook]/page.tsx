import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
	formatPhaseName,
	getAllRunbookSlugs,
	getPhaseIcon,
	getRunbook,
	getRunbookGroups,
	getRunbooksForPaper,
} from "../../../../../lib/runbooks";
import Header from "../../../../components/Header";
import { PaperChangesProvider } from "../../../../components/PaperChangesContext";
import PaperContent from "../../../../components/PaperContent";
import PaperRevisionHistory from "../../../../components/PaperRevisionHistory";
import PaperTableOfContents from "../../../../components/PaperTableOfContents";

const PAPER_SLUG = "ai-dlc-2026";

interface SectionChange {
	section: string;
	originalSection?: string;
	isNew: boolean;
	isRemoved?: boolean;
	renamedFrom?: string;
	linesAdded: number;
	linesRemoved: number;
}

interface RunbookRevisions {
	slug: string;
	currentVersion: string;
	revisions: Array<{
		sectionChanges: SectionChange[];
	}>;
	newSections: string[];
}

/**
 * Load runbook revision data at build time
 */
function getRunbookRevisions(
	paperSlug: string,
	runbookSlug: string,
): RunbookRevisions | null {
	try {
		const filePath = path.join(
			process.cwd(),
			"public",
			"data",
			"runbook-revisions.json",
		);
		if (!fs.existsSync(filePath)) {
			return null;
		}
		const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		const key = `${paperSlug}/${runbookSlug}`;
		return data[key] || null;
	} catch {
		return null;
	}
}

export async function generateStaticParams() {
	return getAllRunbookSlugs(PAPER_SLUG);
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ runbook: string }>;
}): Promise<Metadata> {
	const { runbook: runbookSlug } = await params;
	const runbook = getRunbook(PAPER_SLUG, runbookSlug);

	if (!runbook) {
		return {
			title: "Runbook Not Found - Han",
		};
	}

	const sourceUrl = `https://raw.githubusercontent.com/TheBushidoCollective/han/main/website/content/papers/${PAPER_SLUG}/runbooks/${runbook.phase}/${runbookSlug}.md`;

	return {
		title: `${runbook.title} - AI-DLC 2026 Runbooks - Han`,
		description:
			runbook.description || `${runbook.title} runbook for AI-DLC 2026`,
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

export default async function RunbookPage({
	params,
}: {
	params: Promise<{ runbook: string }>;
}) {
	const { runbook: runbookSlug } = await params;
	const runbook = getRunbook(PAPER_SLUG, runbookSlug);

	if (!runbook) {
		notFound();
	}

	// Load revision data
	const revisions = getRunbookRevisions(PAPER_SLUG, runbookSlug);
	const latestRevision = revisions?.revisions[0];
	const sectionChanges = latestRevision?.sectionChanges || [];

	// Get all runbooks and groups for navigation
	const allRunbooks = getRunbooksForPaper(PAPER_SLUG);
	const groups = getRunbookGroups(PAPER_SLUG);
	const currentIndex = allRunbooks.findIndex((r) => r.slug === runbookSlug);
	const prevRunbook = currentIndex > 0 ? allRunbooks[currentIndex - 1] : null;
	const nextRunbook =
		currentIndex < allRunbooks.length - 1
			? allRunbooks[currentIndex + 1]
			: null;

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-12">
					{/* TOC Sidebar */}
					<aside className="hidden lg:block">
						<div className="sticky top-24">
							<PaperTableOfContents
								content={runbook.content}
								sectionChanges={sectionChanges}
							>
								{/* Runbook Navigation */}
								<div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
									<Link
										href="/papers/ai-dlc-2026/runbooks"
										className="text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition mb-4 block"
									>
										All Runbooks →
									</Link>
									<div className="space-y-4">
										{groups.map((group) => {
											const groupRunbooks = allRunbooks.filter(
												(r) => r.phase === group.id,
											);
											if (groupRunbooks.length === 0) return null;

											return (
												<div key={group.id}>
													<h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
														<span>{group.icon}</span>
														<span>{group.name.replace(" Phase", "")}</span>
													</h4>
													<div className="space-y-1">
														{groupRunbooks.map((r) => (
															<Link
																key={r.slug}
																href={`/papers/ai-dlc-2026/runbooks/${r.slug}`}
																className={`block px-3 py-1.5 text-sm rounded-md transition ${
																	r.slug === runbookSlug
																		? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium"
																		: "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
																}`}
															>
																{r.title}
															</Link>
														))}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							</PaperTableOfContents>
						</div>
					</aside>

					{/* Main Content */}
					<div className="max-w-4xl">
						{/* Header */}
						<header className="mb-6">
							<div className="flex items-center gap-2 mb-6">
								<Link
									href="/papers/ai-dlc-2026"
									className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
								>
									AI-DLC 2026
								</Link>
								<span className="text-gray-400">/</span>
								<Link
									href="/papers/ai-dlc-2026/runbooks"
									className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
								>
									Runbooks
								</Link>
								<span className="text-gray-400">/</span>
								<span className="text-gray-600 dark:text-gray-400">
									{runbook.title}
								</span>
							</div>

							<div className="flex items-center gap-3 mb-4">
								<span className="text-3xl">{getPhaseIcon(runbook.phase)}</span>
								<span className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">
									{formatPhaseName(runbook.phase)}
								</span>
							</div>

							<h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
								{runbook.title}
							</h1>

							{runbook.description && (
								<p className="text-xl text-gray-600 dark:text-gray-300">
									{runbook.description}
								</p>
							)}
						</header>

						{/* Revision History and Content */}
						<PaperChangesProvider sectionChanges={sectionChanges}>
							{/* Revision History */}
							<div className="mb-6">
								<PaperRevisionHistory
									slug={`${PAPER_SLUG}/runbooks/${runbook.phase}/${runbookSlug}`}
								/>
							</div>

							{/* Content */}
							<PaperContent
								content={runbook.content}
								initialSectionChanges={sectionChanges}
							/>
						</PaperChangesProvider>

						{/* Navigation Footer */}
						<footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
							<div className="flex items-center justify-between">
								<div>
									{prevRunbook ? (
										<Link
											href={`/papers/ai-dlc-2026/runbooks/${prevRunbook.slug}`}
											className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
										>
											← {prevRunbook.title}
										</Link>
									) : (
										<Link
											href="/papers/ai-dlc-2026/runbooks"
											className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
										>
											← All Runbooks
										</Link>
									)}
								</div>

								<div>
									{nextRunbook && (
										<Link
											href={`/papers/ai-dlc-2026/runbooks/${nextRunbook.slug}`}
											className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
										>
											{nextRunbook.title} →
										</Link>
									)}
								</div>
							</div>
						</footer>
					</div>
				</div>
			</div>
		</div>
	);
}
