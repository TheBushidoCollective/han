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
}

interface SearchResultsProps {
	index: SearchResult[];
}

export default function SearchResults({ index }: SearchResultsProps) {
	const searchParams = useSearchParams();
	const query = searchParams.get("q") || "";
	const [results, setResults] = useState<SearchResult[]>([]);
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

		if (query.trim().length < 2) {
			// Show all plugins when no query
			setResults(index);
			return;
		}

		const searchResults = fuse.current.search(query);
		setResults(searchResults.map((r) => r.item));
	}, [query, index]);

	const highlightMatch = (text: string, query: string): React.ReactNode => {
		if (!query.trim()) return text;

		const parts = text.split(new RegExp(`(${query})`, "gi"));
		return (
			<>
				{parts.map((part, idx) =>
					part.toLowerCase() === query.toLowerCase() ? (
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
					<p className="text-gray-600 dark:text-gray-400">
						{results.length} result{results.length !== 1 ? "s" : ""} for "
						<span className="font-semibold text-gray-900 dark:text-white">
							{query}
						</span>
						"
					</p>
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
									{highlightMatch(result.name, query)}
								</h3>
								<span className="ml-4 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded capitalize">
									{result.category}
								</span>
							</div>
							<p className="text-gray-600 dark:text-gray-400 mb-3">
								{highlightMatch(result.description, query)}
							</p>
							{result.tags.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{result.tags.map((tag) => (
										<span
											key={tag}
											className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
										>
											{tag}
										</span>
									))}
								</div>
							)}
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
