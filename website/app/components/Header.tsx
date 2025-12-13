"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function Header() {
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [showDropdown, setShowDropdown] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const [_searchIndex, setSearchIndex] = useState<SearchResult[]>([]);
	const searchRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const fuse = useRef<Fuse<SearchResult> | null>(null);

	// Load search index on mount
	useEffect(() => {
		fetch("/search-index.json")
			.then((res) => res.json())
			.then((data: SearchResult[]) => {
				setSearchIndex(data);
				// Initialize Fuse.js
				fuse.current = new Fuse(data, {
					keys: [
						{ name: "name", weight: 2 },
						{ name: "description", weight: 1 },
						{ name: "tags", weight: 1.5 },
					],
					threshold: 0.3,
					minMatchCharLength: 2,
				});
			})
			.catch((error) => console.error("Failed to load search index:", error));
	}, []);

	// Generate suggestions when query changes
	useEffect(() => {
		if (!fuse.current || searchQuery.trim().length < 2) {
			setResults([]);
			setShowDropdown(false);
			return;
		}

		const searchResults = fuse.current.search(searchQuery).slice(0, 8);
		setResults(searchResults.map((r) => r.item));
		setShowDropdown(searchResults.length > 0);
		setSelectedIndex(-1);
	}, [searchQuery]);

	// Handle click outside to close dropdown
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				searchRef.current &&
				!searchRef.current.contains(event.target as Node)
			) {
				setShowDropdown(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSearch = () => {
		if (searchQuery.trim()) {
			router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
			setShowDropdown(false);
			inputRef.current?.blur();
		} else {
			router.push("/search");
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		handleSearch();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!showDropdown || results.length === 0) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex((prev) =>
					prev < results.length - 1 ? prev + 1 : prev,
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
				break;
			case "Enter":
				e.preventDefault();
				if (selectedIndex >= 0 && results[selectedIndex]) {
					// Navigate to selected plugin
					router.push(results[selectedIndex].path);
					setShowDropdown(false);
					setSearchQuery("");
					inputRef.current?.blur();
				} else {
					// No selection - go to search results page
					handleSearch();
				}
				break;
			case "Escape":
				setShowDropdown(false);
				setSelectedIndex(-1);
				break;
		}
	};

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
		<header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
			<nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
				<div className="flex items-center justify-between gap-6">
					<Link href="/" className="flex items-center space-x-3 flex-shrink-0">
						<div className="text-4xl">⛩️</div>
						<div className="text-2xl font-bold text-gray-900 dark:text-white">
							Han
						</div>
					</Link>

					<form onSubmit={handleSubmit} className="flex-1 max-w-md">
						<div className="relative" ref={searchRef}>
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<svg
									className="w-5 h-5 text-gray-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
									/>
								</svg>
							</div>
							<input
								ref={inputRef}
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Search plugins..."
								className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								autoComplete="off"
							/>

							{/* Autocomplete Dropdown */}
							{showDropdown && results.length > 0 && (
								<div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto">
									{results.map((result, index) => (
										<Link
											key={result.id}
											href={result.path}
											onClick={() => {
												setShowDropdown(false);
												setSearchQuery("");
											}}
											className={`block px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
												index === selectedIndex
													? "bg-gray-50 dark:bg-gray-700"
													: ""
											}`}
										>
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<div className="font-semibold text-gray-900 dark:text-white">
														{highlightMatch(result.name, searchQuery)}
													</div>
													<div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
														{highlightMatch(
															result.description.slice(0, 100),
															searchQuery,
														)}
														{result.description.length > 100 && "..."}
													</div>
													{result.tags.length > 0 && (
														<div className="flex flex-wrap gap-1 mt-2">
															{result.tags.slice(0, 3).map((tag) => (
																<span
																	key={tag}
																	className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
																>
																	{tag}
																</span>
															))}
															{result.tags.length > 3 && (
																<span className="inline-block px-2 py-1 text-xs text-gray-500 dark:text-gray-500">
																	+{result.tags.length - 3} more
																</span>
															)}
														</div>
													)}
												</div>
												<span className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
													{result.category}
												</span>
											</div>
										</Link>
									))}
								</div>
							)}

							{searchQuery.trim().length >= 2 && results.length === 0 && (
								<div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400">
									No results found for "{searchQuery}"
								</div>
							)}
						</div>
					</form>

					<div className="flex items-center space-x-6 flex-shrink-0">
						<Link
							href="/plugins"
							className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
						>
							Plugins
						</Link>
						<Link
							href="/blog"
							className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
						>
							Blog
						</Link>
						<Link
							href="/docs"
							className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
						>
							Docs
						</Link>

						<a
							href="https://github.com/TheBushidoCollective/han/releases"
							className="hidden sm:block"
						>
							<img
								src="https://img.shields.io/github/v/release/TheBushidoCollective/han"
								alt="GitHub Release"
								className="h-5"
							/>
						</a>
						<a
							href="https://github.com/TheBushidoCollective/han"
							className="hidden sm:block"
						>
							<img
								src="https://img.shields.io/github/stars/TheBushidoCollective/han"
								alt="GitHub Stars"
								className="h-5"
							/>
						</a>

						<a
							href="https://github.com/thebushidocollective/han"
							className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="GitHub Repository"
						>
							<svg
								className="w-6 h-6"
								fill="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									fillRule="evenodd"
									d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
									clipRule="evenodd"
								/>
							</svg>
							<span className="hidden sm:inline">GitHub</span>
						</a>
					</div>
				</div>
			</nav>
		</header>
	);
}
