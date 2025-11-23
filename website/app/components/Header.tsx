"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

interface SearchIndex {
	plugins: Array<{ name: string; category: string; path: string }>;
	tags: string[];
}

interface Suggestion {
	name: string;
	path: string;
	category: string;
}

export default function Header() {
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState("");
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [showDropdown, setShowDropdown] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
	const searchRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Load search index on mount
	useEffect(() => {
		fetch("/search-index.json")
			.then((res) => res.json())
			.then((data) => setSearchIndex(data))
			.catch((error) => console.error("Failed to load search index:", error));
	}, []);

	// Generate suggestions when query changes
	useEffect(() => {
		if (!searchIndex || searchQuery.trim().length < 2) {
			setSuggestions([]);
			setShowDropdown(false);
			return;
		}

		const lowerQuery = searchQuery.toLowerCase().trim();
		const newSuggestions: Suggestion[] = [];

		// Add matching plugins
		for (const plugin of searchIndex.plugins) {
			if (plugin.name.toLowerCase().includes(lowerQuery)) {
				newSuggestions.push({
					name: plugin.name,
					path: plugin.path,
					category: plugin.category,
				});
			}
			if (newSuggestions.length >= 8) break;
		}

		setSuggestions(newSuggestions);
		setShowDropdown(newSuggestions.length > 0);
		setSelectedIndex(-1);
	}, [searchQuery, searchIndex]);

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
		if (!showDropdown || suggestions.length === 0) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex((prev) =>
					prev < suggestions.length - 1 ? prev + 1 : prev,
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
				break;
			case "Enter":
				if (selectedIndex >= 0) {
					e.preventDefault();
					navigateToPlugin(suggestions[selectedIndex]);
				}
				break;
			case "Escape":
				setShowDropdown(false);
				setSelectedIndex(-1);
				break;
		}
	};

	const navigateToPlugin = (suggestion: Suggestion) => {
		router.push(suggestion.path);
		setShowDropdown(false);
		setSearchQuery("");
		inputRef.current?.blur();
	};

	const handleSuggestionClick = (suggestion: Suggestion) => {
		navigateToPlugin(suggestion);
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
							{showDropdown && suggestions.length > 0 && (
								<div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-auto">
									{suggestions.map((suggestion, index) => (
										<button
											key={suggestion.path}
											type="button"
											onClick={() => handleSuggestionClick(suggestion)}
											className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
												index === selectedIndex
													? "bg-gray-100 dark:bg-gray-700"
													: ""
											}`}
										>
											<div className="flex items-center justify-between gap-3">
												<span className="text-gray-900 dark:text-gray-100 font-medium">
													{suggestion.name}
												</span>
												<span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 capitalize flex-shrink-0">
													{suggestion.category}
												</span>
											</div>
										</button>
									))}
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
