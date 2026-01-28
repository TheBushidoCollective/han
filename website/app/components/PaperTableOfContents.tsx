"use client";

import { useEffect, useRef, useState } from "react";
import { usePaperChanges } from "./PaperChangesContext";

interface TocItem {
	id: string;
	text: string;
	level: number;
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

interface PaperTableOfContentsProps {
	content: string;
	sectionChanges?: SectionChange[];
	children?: React.ReactNode;
}

/**
 * Normalize section name for comparison (matching the script's normalization)
 */
function normalizeSection(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, "")
		.trim();
}

/**
 * Get badge type for a heading based on section changes
 */
function getHeadingBadge(
	headingText: string,
	sectionChanges: SectionChange[],
): "new" | "updated" | null {
	const normalized = normalizeSection(headingText);

	for (const change of sectionChanges) {
		const normalizedSection = normalizeSection(change.section);
		// Check for match (allowing partial matches)
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
 * Extract headings from markdown content
 */
function extractHeadings(content: string): TocItem[] {
	const headings: TocItem[] = [];
	const lines = content.split("\n");
	let inCodeBlock = false;

	for (const line of lines) {
		// Track code blocks
		if (line.trim().startsWith("```") || line.trim().startsWith("~~~")) {
			inCodeBlock = !inCodeBlock;
			continue;
		}

		if (inCodeBlock) continue;

		// Match ## and ### headings
		const match = line.match(/^(#{2,3})\s+(.+)$/);
		if (match) {
			const level = match[1].length;
			const text = match[2].trim();

			// Generate ID matching rehype-slug (github-slugger)
			// Note: github-slugger does NOT collapse multiple dashes
			const id = text
				.toLowerCase()
				.replace(/[^\p{L}\p{N}\s-]/gu, "")
				.trim()
				.replace(/\s/g, "-")
				.replace(/^-|-$/g, "");

			headings.push({ id, text, level });
		}
	}

	return headings;
}

export default function PaperTableOfContents({
	content,
	sectionChanges = [],
	children,
}: PaperTableOfContentsProps) {
	const [activeId, setActiveId] = useState<string>("");
	const { showChanges, setShowChanges } = usePaperChanges();
	const navRef = useRef<HTMLElement>(null);
	const headings = extractHeadings(content);

	// Get new and updated sections for the "What's New" summary
	const newSections = sectionChanges.filter((s) => s.isNew && !s.isRemoved);
	const updatedSections = sectionChanges.filter(
		(s) => !s.isNew && !s.isRemoved,
	);

	useEffect(() => {
		if (headings.length === 0) return;

		// Find the heading that's closest to (but above) the current scroll position
		const findActiveHeading = () => {
			const scrollTop = window.scrollY;
			const offset = 120; // Account for sticky header

			let activeHeading = headings[0].id;

			for (const heading of headings) {
				const element = document.getElementById(heading.id);
				if (element) {
					const top = element.getBoundingClientRect().top + scrollTop;
					if (top <= scrollTop + offset) {
						activeHeading = heading.id;
					} else {
						break;
					}
				}
			}

			setActiveId(activeHeading);
		};

		// Run on mount
		findActiveHeading();

		// Run on scroll with throttling
		let ticking = false;
		const handleScroll = () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					findActiveHeading();
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, [headings]);

	// Auto-scroll TOC to keep active item visible near top
	useEffect(() => {
		if (!activeId || !navRef.current) return;

		const activeButton = navRef.current.querySelector(
			`[data-toc-id="${activeId}"]`,
		);
		if (activeButton) {
			activeButton.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			});
		}
	}, [activeId]);

	const handleClick = (id: string) => {
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
			window.history.pushState(null, "", `#${id}`);
		}
	};

	if (headings.length === 0) {
		return null;
	}

	const hasChanges = newSections.length > 0 || updatedSections.length > 0;

	return (
		<nav ref={navRef} className="max-h-[calc(100vh-8rem)] overflow-y-auto pr-4">
			{/* What's New Summary - Collapsible */}
			{hasChanges && (
				<div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
					<button
						type="button"
						onClick={() => setShowChanges(!showChanges)}
						className="flex items-center justify-between w-full text-left group"
					>
						<h4 className="text-sm font-semibold text-gray-900 dark:text-white">
							What&apos;s New
						</h4>
						<span className="flex items-center gap-2">
							<span className="text-xs text-gray-500 dark:text-gray-400">
								{newSections.length + updatedSections.length}
							</span>
							<svg
								className={`w-4 h-4 text-gray-400 transition-transform ${showChanges ? "rotate-180" : ""}`}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</span>
					</button>
					{showChanges && (
						<div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
							{newSections.length > 0 && (
								<div className="flex items-center gap-2">
									<span className="w-2 h-2 rounded-full bg-green-500" />
									<span>
										{newSections.length} new section
										{newSections.length > 1 ? "s" : ""}
									</span>
								</div>
							)}
							{updatedSections.length > 0 && (
								<div className="flex items-center gap-2">
									<span className="w-2 h-2 rounded-full bg-yellow-400" />
									<span>
										{updatedSections.length} updated section
										{updatedSections.length > 1 ? "s" : ""}
									</span>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			<h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
				On this page
			</h4>
			<ul className="space-y-1 text-sm">
				{headings.map((heading) => {
					const badge = showChanges
						? getHeadingBadge(heading.text, sectionChanges)
						: null;
					return (
						<li
							key={heading.id}
							style={{ paddingLeft: `${(heading.level - 2) * 12}px` }}
						>
							<button
								type="button"
								data-toc-id={heading.id}
								onClick={() => handleClick(heading.id)}
								className={`flex items-center gap-2 w-full text-left py-1 px-2 rounded transition-colors ${
									activeId === heading.id
										? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 font-medium"
										: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
								}`}
							>
								{badge && (
									<span
										className={`flex-shrink-0 w-2 h-2 rounded-full ${
											badge === "new" ? "bg-green-500" : "bg-yellow-400"
										}`}
									/>
								)}
								<span className="flex-1 truncate">{heading.text}</span>
							</button>
						</li>
					);
				})}
			</ul>
			{children}
		</nav>
	);
}
