"use client";

import { useEffect, useState } from "react";

/**
 * Convert a section name to a URL-friendly anchor ID
 * Matches rehype-slug's GitHub-style slugify algorithm
 */
function sectionToAnchor(section: string): string {
	return section
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s-]/gu, "") // Remove non-letter, non-number chars (Unicode-aware)
		.trim()
		.replace(/\s+/g, "-") // Replace spaces with hyphens
		.replace(/-+/g, "-") // Collapse multiple hyphens
		.replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Section link component that scrolls to the section
 */
function SectionLink({
	section,
	className,
	children,
}: {
	section: string;
	className?: string;
	children: React.ReactNode;
}) {
	const anchor = sectionToAnchor(section);

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		const element = document.getElementById(anchor);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
			// Update URL without triggering navigation
			window.history.pushState(null, "", `#${anchor}`);
		}
	};

	return (
		<a
			href={`#${anchor}`}
			onClick={handleClick}
			className={`${className} cursor-pointer hover:underline`}
		>
			{children}
		</a>
	);
}

interface RevisionChange {
	type: "added" | "removed" | "unchanged";
	content: string;
	lineNumber?: number;
}

interface SectionChange {
	section: string;
	isNew: boolean;
	linesAdded: number;
	linesRemoved: number;
}

interface Revision {
	version: string;
	date: string;
	commitHash: string;
	commitMessage: string;
	stats: {
		linesAdded: number;
		linesRemoved: number;
	};
	sectionChanges: SectionChange[];
	diff: RevisionChange[];
}

interface PaperRevisions {
	slug: string;
	currentVersion: string;
	revisions: Revision[];
	newSections: string[];
}

interface PaperRevisionHistoryProps {
	slug: string;
}

export default function PaperRevisionHistory({
	slug,
}: PaperRevisionHistoryProps) {
	const [data, setData] = useState<PaperRevisions | null>(null);
	const [loading, setLoading] = useState(true);
	const [showHistory, setShowHistory] = useState(false);
	const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
	const [showDiff, setShowDiff] = useState(false);

	useEffect(() => {
		fetch("/data/paper-revisions.json")
			.then((res) => res.json())
			.then((allData: Record<string, PaperRevisions>) => {
				setData(allData[slug] || null);
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, [slug]);

	if (loading) {
		return (
			<div className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
				<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
				<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
			</div>
		);
	}

	if (!data || data.revisions.length === 0) {
		return null;
	}

	const latestRevision = data.revisions[0];
	const olderRevisions = data.revisions.slice(1);
	const newSectionsInLatest = latestRevision?.sectionChanges.filter(
		(s) => s.isNew,
	);
	const modifiedSectionsInLatest = latestRevision?.sectionChanges.filter(
		(s) => !s.isNew,
	);

	return (
		<div className="space-y-4">
			{/* What's New Card - Prominent at top */}
			{latestRevision && (
				<div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg overflow-hidden">
					<div className="px-5 py-4">
						<div className="flex items-start justify-between mb-3">
							<div className="flex items-center gap-3">
								<div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full">
									<svg
										className="w-4 h-4 text-green-600 dark:text-green-300"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
											clipRule="evenodd"
										/>
									</svg>
								</div>
								<div>
									<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
										What's New in v{data.currentVersion}
									</h3>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										{latestRevision.date}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200">
									+{latestRevision.stats.linesAdded} lines
								</span>
								{latestRevision.stats.linesRemoved > 0 && (
									<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200">
										-{latestRevision.stats.linesRemoved}
									</span>
								)}
							</div>
						</div>

						{/* New Sections */}
						{newSectionsInLatest && newSectionsInLatest.length > 0 && (
							<div className="mb-4">
								<h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
									New Sections
								</h4>
								<div className="flex flex-wrap gap-2">
									{newSectionsInLatest.map((change) => (
										<SectionLink
											key={change.section}
											section={change.section}
											className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-green-800/50 text-green-700 dark:text-green-200 border border-green-200 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-800 transition-colors"
										>
											{change.section}
										</SectionLink>
									))}
								</div>
							</div>
						)}

						{/* Modified Sections */}
						{modifiedSectionsInLatest && modifiedSectionsInLatest.length > 0 && (
							<div className="mb-4">
								<h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
									Updated Sections
								</h4>
								<div className="flex flex-wrap gap-2">
									{modifiedSectionsInLatest.slice(0, 8).map((change) => (
										<SectionLink
											key={change.section}
											section={change.section}
											className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors"
										>
											{change.section}
											<span className="ml-1 opacity-75">
												(+{change.linesAdded}/-{change.linesRemoved})
											</span>
										</SectionLink>
									))}
									{modifiedSectionsInLatest.length > 8 && (
										<span className="text-xs text-gray-500 dark:text-gray-400 self-center">
											+{modifiedSectionsInLatest.length - 8} more
										</span>
									)}
								</div>
							</div>
						)}

						{/* Links */}
						<div className="flex items-center gap-4 text-sm pt-2 border-t border-green-200 dark:border-green-700/50">
							<a
								href={`https://github.com/TheBushidoCollective/han/commits/main/website/content/papers/${slug}.md`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-green-700 dark:text-green-300 hover:underline flex items-center gap-1"
							>
								<svg
									className="w-4 h-4"
									fill="currentColor"
									viewBox="0 0 24 24"
								>
									<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
								</svg>
								View on GitHub
							</a>
							<a
								href={`https://github.com/TheBushidoCollective/han/commit/${latestRevision.commitHash}`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-green-700 dark:text-green-300 hover:underline font-mono"
							>
								{latestRevision.commitHash}
							</a>
						</div>
					</div>
				</div>
			)}

			{/* Collapsible Version History */}
			{olderRevisions.length > 0 && (
				<div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
					<button
						type="button"
						onClick={() => setShowHistory(!showHistory)}
						className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700/50 transition"
					>
						<div className="flex items-center gap-2">
							<svg
								className="w-4 h-4 text-gray-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Version History
							</span>
							<span className="text-xs text-gray-500 dark:text-gray-400">
								({olderRevisions.length} previous{" "}
								{olderRevisions.length === 1 ? "version" : "versions"})
							</span>
						</div>
						<svg
							className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>

					{showHistory && (
						<div className="divide-y divide-gray-200 dark:divide-gray-700">
							{olderRevisions.map((revision) => (
								<div key={revision.commitHash} className="relative">
									<button
										type="button"
										onClick={() =>
											setExpandedVersion(
												expandedVersion === revision.version
													? null
													: revision.version,
											)
										}
										className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition flex items-center justify-between"
									>
										<div className="flex items-center gap-3">
											<div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
											<div>
												<div className="flex items-center gap-2">
													<span className="font-medium text-gray-900 dark:text-white">
														v{revision.version}
													</span>
													<span className="text-sm text-gray-500 dark:text-gray-400">
														{revision.date}
													</span>
												</div>
												<p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-md">
													{revision.commitMessage}
												</p>
											</div>
										</div>

										<div className="flex items-center gap-3">
											<div className="flex items-center gap-2 text-sm">
												{revision.stats.linesAdded > 0 && (
													<span className="text-green-600 dark:text-green-400">
														+{revision.stats.linesAdded}
													</span>
												)}
												{revision.stats.linesRemoved > 0 && (
													<span className="text-red-600 dark:text-red-400">
														-{revision.stats.linesRemoved}
													</span>
												)}
											</div>
											<svg
												className={`w-4 h-4 text-gray-400 transition-transform ${
													expandedVersion === revision.version
														? "rotate-180"
														: ""
												}`}
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M19 9l-7 7-7-7"
												/>
											</svg>
										</div>
									</button>

									{expandedVersion === revision.version && (
										<div className="px-4 pb-4 bg-gray-50 dark:bg-gray-800/30">
											{revision.sectionChanges.length > 0 && (
												<div className="mb-4">
													<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
														Sections Changed
													</h4>
													<div className="flex flex-wrap gap-2">
														{revision.sectionChanges.map((change) => (
															<SectionLink
																key={change.section}
																section={change.section}
																className={`inline-flex items-center px-2 py-1 rounded text-xs transition-colors ${
																	change.isNew
																		? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900"
																		: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900"
																}`}
															>
																{change.section}
																{!change.isNew && (
																	<span className="ml-1 opacity-75">
																		(+{change.linesAdded}/-{change.linesRemoved})
																	</span>
																)}
															</SectionLink>
														))}
													</div>
												</div>
											)}

											{revision.diff.length > 0 && (
												<div>
													<button
														type="button"
														onClick={() => setShowDiff(!showDiff)}
														className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2"
													>
														{showDiff ? "Hide" : "Show"} diff
													</button>

													{showDiff && (
														<div className="rounded-lg overflow-hidden max-h-96 overflow-y-auto border border-gray-700">
															<div className="text-xs font-mono">
																{revision.diff.slice(0, 100).map((change, i) => (
																	<div
																		key={`${change.lineNumber ?? "removed"}-${i}`}
																		className={`px-3 py-0.5 border-l-4 ${
																			change.type === "added"
																				? "bg-green-950 border-green-500 text-green-200"
																				: change.type === "removed"
																					? "bg-red-950 border-red-500 text-red-200"
																					: "bg-gray-900 border-transparent text-gray-400"
																		}`}
																	>
																		<span className="inline-block w-8 text-right mr-3 text-gray-500 select-none">
																			{change.lineNumber ?? " "}
																		</span>
																		<span
																			className={`inline-block w-4 select-none font-bold ${
																				change.type === "added"
																					? "text-green-400"
																					: change.type === "removed"
																						? "text-red-400"
																						: "text-gray-600"
																			}`}
																		>
																			{change.type === "added"
																				? "+"
																				: change.type === "removed"
																					? "−"
																					: " "}
																		</span>
																		<span className="whitespace-pre-wrap break-all">
																			{change.content || " "}
																		</span>
																	</div>
																))}
																{revision.diff.length > 100 && (
																	<div className="text-gray-500 text-center py-2 bg-gray-800">
																		... {revision.diff.length - 100} more lines
																	</div>
																)}
															</div>
														</div>
													)}
												</div>
											)}

											<div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
												Commit:{" "}
												<a
													href={`https://github.com/TheBushidoCollective/han/commit/${revision.commitHash}`}
													target="_blank"
													rel="noopener noreferrer"
													className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
												>
													{revision.commitHash}
												</a>
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Badge component for inline "NEW" markers in content
 */
export function NewBadge({ section }: { section: string }) {
	return (
		<span
			className="inline-flex items-center px-1.5 py-0.5 ml-2 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded"
			title={`New in latest version`}
		>
			NEW
		</span>
	);
}
