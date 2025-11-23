"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface SearchResult {
	id: string;
	name: string;
	description: string;
	category: string;
	tags: string[];
	path: string;
	components: string[];
}

interface SearchResultsProps {
	index: SearchResult[];
}

interface ParsedQuery {
	textQuery: string;
	tagFilters: string[];
	componentFilters: string[];
}

function parseQuery(query: string): ParsedQuery {
	const parsed: ParsedQuery = {
		textQuery: "",
		tagFilters: [],
		componentFilters: [],
	};

	// Split query into parts
	const parts = query.split(/\s+/);
	const textParts: string[] = [];

	for (const part of parts) {
		// Check for tag: or tags:
		const tagMatch = part.match(/^tags?:(.+)$/i);
		if (tagMatch) {
			parsed.tagFilters.push(...tagMatch[1].split(","));
			continue;
		}

		// Check for component: or components:
		const componentMatch = part.match(/^components?:(.+)$/i);
		if (componentMatch) {
			parsed.componentFilters.push(...componentMatch[1].split(","));
			continue;
		}

		// Regular text query
		textParts.push(part);
	}

	parsed.textQuery = textParts.join(" ").trim();
	return parsed;
}

function hasComponent(result: SearchResult, component: string): boolean {
	return result.components
		.map((c) => c.toLowerCase())
		.includes(component.toLowerCase());
}

export default function SearchResults({ index }: SearchResultsProps) {
	const searchParams = useSearchParams();
	const query = searchParams.get("q") || "";
	const [results, setResults] = useState<SearchResult[]>([]);
	const [activeFilters, setActiveFilters] = useState<ParsedQuery>({
		textQuery: "",
		tagFilters: [],
		componentFilters: [],
	});
	const fuse = useRef<Fuse<SearchResult> | null>(null);

	// Initialize Fuse.js
	useEffect(() => {
		fuse.current = new Fuse(index, {
			keys: [
				{ name: "name", weight: 2 },
				{ name: "description", weight: 1 },
				{ name: "tags", weight: 1.5 },
			],
			threshold: 0.3,
			minMatchCharLength: 2,
		});
	}, [index]);

	// Perform search when query changes
	useEffect(() => {
		if (!fuse.current) return;

		const parsed = parseQuery(query);
		setActiveFilters(parsed);

		let filteredResults = index;

		// Apply tag filters
		if (parsed.tagFilters.length > 0) {
			filteredResults = filteredResults.filter((result) =>
				parsed.tagFilters.some((tag) =>
					result.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase()),
				),
			);
		}

		// Apply component filters (TODO: implement proper component detection)
		if (parsed.componentFilters.length > 0) {
			filteredResults = filteredResults.filter((result) =>
				parsed.componentFilters.some((comp) => hasComponent(result, comp)),
			);
		}

		// Apply text search if present
		if (parsed.textQuery.trim().length >= 2) {
			const searchResults = fuse.current.search(parsed.textQuery);
			const searchIds = new Set(searchResults.map((r) => r.item.id));
			filteredResults = filteredResults.filter((r) => searchIds.has(r.id));
		} else if (
			parsed.textQuery.trim().length === 0 &&
			parsed.tagFilters.length === 0 &&
			parsed.componentFilters.length === 0
		) {
			// Show all plugins when no filters
			filteredResults = index;
		}

		setResults(filteredResults);
	}, [query, index]);

	const highlightMatch = (text: string): React.ReactNode => {
		const highlightQuery = activeFilters.textQuery;
		if (!highlightQuery.trim()) return text;

		const parts = text.split(new RegExp(`(${highlightQuery})`, "gi"));
		return (
			<>
				{parts.map((part, idx) =>
					part.toLowerCase() === highlightQuery.toLowerCase() ? (
						<mark
							key={`match-${text.slice(0, 20)}-${idx}-${Math.random()}`}
							className="bg-yellow-200 dark:bg-yellow-800"
						>
							{part}
						</mark>
					) : (
						part
					),
				)}
			</>
		);
	};

	return (
		<div>
			{query && (
				<div className="mb-6">
					<p className="text-gray-600 dark:text-gray-400 mb-3">
						{results.length} result{results.length !== 1 ? "s" : ""}{" "}
						{activeFilters.textQuery && (
							<>
								for "
								<span className="font-semibold text-gray-900 dark:text-white">
									{activeFilters.textQuery}
								</span>
								"
							</>
						)}
					</p>

					{(activeFilters.tagFilters.length > 0 ||
						activeFilters.componentFilters.length > 0) && (
						<div className="flex flex-wrap gap-2">
							{activeFilters.tagFilters.map((tag) => (
								<span
									key={tag}
									className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
								>
									<span className="font-semibold mr-1">tag:</span>
									{tag}
								</span>
							))}
							{activeFilters.componentFilters.map((comp) => (
								<span
									key={comp}
									className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
								>
									<span className="font-semibold mr-1">component:</span>
									{comp}
								</span>
							))}
						</div>
					)}
				</div>
			)}

			{results.length === 0 ? (
				<div className="text-center py-12">
					<div className="text-gray-400 dark:text-gray-500 mb-4">
						<svg
							className="w-16 h-16 mx-auto"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<title>No results icon</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
						No results found
					</h3>
					<p className="text-gray-600 dark:text-gray-400">
						Try searching with different keywords
					</p>
				</div>
			) : (
				<div className="grid gap-6">
					{results.map((result) => (
						<Link
							key={result.id}
							href={result.path}
							className="block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-900 dark:hover:border-white transition"
						>
							<div className="flex items-start justify-between mb-2">
								<h3 className="text-xl font-semibold text-gray-900 dark:text-white">
									{highlightMatch(result.name)}
								</h3>
								<span className="ml-4 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded capitalize">
									{result.category}
								</span>
							</div>
							<p className="text-gray-600 dark:text-gray-400 mb-3">
								{highlightMatch(result.description)}
							</p>
							<div className="flex flex-wrap gap-2">
								{result.tags.length > 0 &&
									result.tags.map((tag) => (
										<span
											key={`tag-${tag}`}
											className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
										>
											{tag}
										</span>
									))}
								{result.components.length > 0 &&
									result.components.map((comp) => (
										<span
											key={`comp-${comp}`}
											className="inline-block px-2 py-1 text-xs bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200 rounded"
										>
											{comp}
										</span>
									))}
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
