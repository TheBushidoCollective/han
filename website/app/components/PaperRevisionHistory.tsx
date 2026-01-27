"use client";

import { useEffect, useState } from "react";
import { usePaperChanges } from "./PaperChangesContext";

/**
 * Convert a section name to a URL-friendly anchor ID
 */
function sectionToAnchor(section: string): string {
	return section
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function SectionLink({
	section,
	originalSection,
	className,
	children,
}: {
	section: string;
	originalSection?: string;
	className?: string;
	children: React.ReactNode;
}) {
	const anchor = sectionToAnchor(originalSection || section);

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		const element = document.getElementById(anchor);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
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

interface SectionChange {
	section: string;
	originalSection?: string;
	isNew: boolean;
	isRemoved?: boolean;
	renamedFrom?: string;
	linesAdded: number;
	linesRemoved: number;
}

interface Revision {
	version: string;
	date: string;
	commitHash: string;
	fullCommitHash: string;
	commitMessage: string;
	stats: {
		linesAdded: number;
		linesRemoved: number;
	};
	sectionChanges: SectionChange[];
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
	const [isExpanded, setIsExpanded] = useState(false);

	const {
		compareVersion,
		setCompareVersion,
		isLoadingCompare,
		loadCompareContent,
	} = usePaperChanges();

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
				<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
			</div>
		);
	}

	if (!data || data.revisions.length === 0) {
		return null;
	}

	const latestRevision = data.revisions[0];
	const olderRevisions = data.revisions.slice(1);
	const newSectionsInLatest = latestRevision?.sectionChanges.filter(
		(s) => s.isNew && !s.isRemoved,
	);
	const modifiedSectionsInLatest = latestRevision?.sectionChanges.filter(
		(s) => !s.isNew && !s.isRemoved,
	);
	const removedSectionsInLatest = latestRevision?.sectionChanges.filter(
		(s) => s.isRemoved,
	);

	const totalChanges =
		(newSectionsInLatest?.length || 0) +
		(modifiedSectionsInLatest?.length || 0) +
		(removedSectionsInLatest?.length || 0);

	const handleCompare = async (revision: Revision) => {
		if (compareVersion === revision.version) {
			// Toggle off
			setCompareVersion(null);
		} else {
			// Load and compare
			await loadCompareContent(slug, revision.fullCommitHash, revision.version);
		}
	};

	return (
		<div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
			{/* Collapsed Header */}
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700/50 transition"
			>
				<div className="flex items-center gap-3">
					<span className="text-sm font-medium text-gray-900 dark:text-white">
						v{data.currentVersion}
					</span>
					<span className="text-sm text-gray-500 dark:text-gray-400">
						{latestRevision.date}
					</span>
					{totalChanges > 0 && (
						<div className="flex items-center gap-2">
							{newSectionsInLatest && newSectionsInLatest.length > 0 && (
								<span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
									<span className="w-2 h-2 rounded-full bg-green-500" />
									{newSectionsInLatest.length} new
								</span>
							)}
							{modifiedSectionsInLatest &&
								modifiedSectionsInLatest.length > 0 && (
									<span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
										<span className="w-2 h-2 rounded-full bg-yellow-400" />
										{modifiedSectionsInLatest.length} updated
									</span>
								)}
						</div>
					)}
				</div>
				<svg
					aria-hidden="true"
					className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
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

			{/* Compare Mode Banner */}
			{compareVersion && (
				<div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border-t border-blue-200 dark:border-blue-800 flex items-center justify-between">
					<span className="text-sm text-blue-700 dark:text-blue-300">
						{isLoadingCompare ? (
							"Loading comparison..."
						) : (
							<>
								Comparing current (v{data.currentVersion}) with v
								{compareVersion}
							</>
						)}
					</span>
					<button
						type="button"
						onClick={() => setCompareVersion(null)}
						className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
					>
						Exit compare
					</button>
				</div>
			)}

			{/* Expanded Content */}
			{isExpanded && (
				<div className="border-t border-gray-200 dark:border-gray-700">
					{/* What's New Section */}
					{latestRevision && totalChanges > 0 && (
						<div className="px-4 py-4 bg-white dark:bg-gray-900">
							<div className="flex items-center justify-between mb-3">
								<h4 className="text-sm font-medium text-gray-900 dark:text-white">
									What's New in v{data.currentVersion}
								</h4>
								<div className="flex items-center gap-2 text-xs">
									<span className="text-green-600 dark:text-green-400">
										+{latestRevision.stats.linesAdded}
									</span>
									{latestRevision.stats.linesRemoved > 0 && (
										<span className="text-red-600 dark:text-red-400">
											-{latestRevision.stats.linesRemoved}
										</span>
									)}
								</div>
							</div>

							{/* New Sections */}
							{newSectionsInLatest && newSectionsInLatest.length > 0 && (
								<div className="mb-3">
									<h5 className="text-xs font-medium text-green-700 dark:text-green-300 mb-2">
										New Sections
									</h5>
									<div className="flex flex-wrap gap-1.5">
										{newSectionsInLatest.map((change) => (
											<SectionLink
												key={change.section}
												section={change.section}
												originalSection={change.originalSection}
												className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
											>
												{change.section}
											</SectionLink>
										))}
									</div>
								</div>
							)}

							{/* Modified Sections */}
							{modifiedSectionsInLatest &&
								modifiedSectionsInLatest.length > 0 && (
									<div className="mb-3">
										<h5 className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-2">
											Updated Sections
										</h5>
										<div className="flex flex-wrap gap-1.5">
											{modifiedSectionsInLatest.map((change) => (
												<SectionLink
													key={change.section}
													section={change.section}
													originalSection={change.originalSection}
													className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors"
												>
													{change.renamedFrom && (
														<>
															<span className="line-through opacity-60 mr-1">
																{change.renamedFrom}
															</span>
															<span className="mr-1">→</span>
														</>
													)}
													{change.section}
												</SectionLink>
											))}
										</div>
									</div>
								)}

							{/* Removed Sections */}
							{removedSectionsInLatest &&
								removedSectionsInLatest.length > 0 && (
									<div className="mb-3">
										<h5 className="text-xs font-medium text-red-700 dark:text-red-300 mb-2">
											Removed Sections
										</h5>
										<div className="flex flex-wrap gap-1.5">
											{removedSectionsInLatest.map((change) => (
												<span
													key={change.section}
													className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through"
												>
													{change.section}
												</span>
											))}
										</div>
									</div>
								)}

							{/* Links */}
							<div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
								<a
									href={`https://github.com/TheBushidoCollective/han/commits/main/website/content/papers/${slug}.md`}
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
								>
									<svg
										aria-hidden="true"
										className="w-3.5 h-3.5"
										fill="currentColor"
										viewBox="0 0 24 24"
									>
										<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
									</svg>
									View on GitHub
								</a>
							</div>
						</div>
					)}

					{/* Previous Versions with Compare buttons */}
					{olderRevisions.length > 0 && (
						<div className="border-t border-gray-200 dark:border-gray-700">
							<div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50">
								<span className="text-xs font-medium text-gray-500 dark:text-gray-400">
									Compare with Previous Version
								</span>
							</div>
							<div className="divide-y divide-gray-100 dark:divide-gray-800">
								{olderRevisions.map((revision) => (
									<div
										key={revision.commitHash}
										className="px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/30"
									>
										<div className="flex items-center gap-3">
											<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
												v{revision.version}
											</span>
											<span className="text-xs text-gray-500 dark:text-gray-400">
												{revision.date}
											</span>
											<div className="flex items-center gap-1 text-xs">
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
										</div>
										<button
											type="button"
											onClick={() => handleCompare(revision)}
											disabled={isLoadingCompare}
											className={`px-3 py-1 text-xs rounded transition-colors ${
												compareVersion === revision.version
													? "bg-blue-600 text-white"
													: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
											} disabled:opacity-50`}
										>
											{compareVersion === revision.version
												? "Comparing"
												: "Compare"}
										</button>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
