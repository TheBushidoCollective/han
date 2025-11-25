"use client";

import Link from "next/link";
import { useState } from "react";

interface TagWithPlugins {
	name: string;
	count: number;
	plugins: Array<{
		name: string;
		description: string;
		category: string;
		path: string;
	}>;
}

interface TagsClientProps {
	allTags: TagWithPlugins[];
}

export default function TagsClient({ allTags }: TagsClientProps) {
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const filteredTags = allTags.filter((tag) =>
		tag.name.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const selectedTagInfo = selectedTag
		? allTags.find((t) => t.name === selectedTag)
		: null;

	return (
		<>
			<div className="mb-8">
				<input
					type="text"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Filter tags..."
					className="w-full max-w-md px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Tags cloud */}
				<div className="lg:col-span-2">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						All Tags
					</h2>
					<div className="flex flex-wrap gap-2">
						{filteredTags.map((tag) => {
							const size = Math.min(Math.max(tag.count / 2, 0.875), 2);
							return (
								<button
									key={tag.name}
									type="button"
									onClick={() => setSelectedTag(tag.name)}
									className={`inline-flex items-center px-3 py-2 rounded-lg border-2 transition ${
										selectedTag === tag.name
											? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
											: "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-white"
									}`}
									style={{ fontSize: `${size}rem` }}
								>
									{tag.name}
									<span className="ml-2 text-xs opacity-60">{tag.count}</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* Selected tag plugins */}
				<div className="lg:col-span-1">
					{selectedTagInfo ? (
						<div className="sticky top-4">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
									{selectedTagInfo.name}
								</h2>
								<button
									type="button"
									onClick={() => setSelectedTag(null)}
									className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
									aria-label="Close tag details"
								>
									<svg
										className="w-6 h-6"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<title>Close</title>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>
							<p className="text-gray-600 dark:text-gray-400 mb-4">
								{selectedTagInfo.count} plugin
								{selectedTagInfo.count !== 1 ? "s" : ""}
							</p>
							<div className="space-y-3">
								{selectedTagInfo.plugins.map((plugin) => (
									<Link
										key={plugin.name}
										href={plugin.path}
										className="block p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-900 dark:hover:border-white transition"
									>
										<div className="flex items-start justify-between mb-2">
											<h3 className="font-semibold text-gray-900 dark:text-white">
												{plugin.name}
											</h3>
											<span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
												{plugin.category}
											</span>
										</div>
										<p className="text-sm text-gray-600 dark:text-gray-400">
											{plugin.description.slice(0, 100)}
											{plugin.description.length > 100 && "..."}
										</p>
									</Link>
								))}
							</div>
						</div>
					) : (
						<div className="text-center py-12 text-gray-500 dark:text-gray-400">
							<svg
								className="w-16 h-16 mx-auto mb-4 opacity-50"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<title>Tag icon</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
								/>
							</svg>
							<p>Select a tag to see related plugins</p>
						</div>
					)}
				</div>
			</div>

			{/* Tag categories */}
			<div className="mt-12">
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
					Popular Categories
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{["language", "framework", "testing", "tooling"].map((category) => {
						const categoryTags = allTags.filter((tag) => {
							const lowerTag = tag.name.toLowerCase();
							switch (category) {
								case "language":
									return [
										"javascript",
										"typescript",
										"python",
										"java",
										"go",
										"rust",
										"ruby",
										"elixir",
									].some((l) => lowerTag.includes(l));
								case "framework":
									return [
										"react",
										"vue",
										"angular",
										"nextjs",
										"django",
										"rails",
									].some((f) => lowerTag.includes(f));
								case "testing":
									return [
										"testing",
										"jest",
										"cypress",
										"playwright",
										"cucumber",
										"bdd",
									].some((t) => lowerTag.includes(t));
								case "tooling":
									return ["linting", "biome", "eslint", "prettier"].some((t) =>
										lowerTag.includes(t),
									);
								default:
									return false;
							}
						});

						return (
							<div
								key={category}
								className="p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
							>
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 capitalize">
									{category}
								</h3>
								<div className="space-y-2">
									{categoryTags.slice(0, 5).map((tag) => (
										<button
											key={tag.name}
											type="button"
											onClick={() => setSelectedTag(tag.name)}
											className="block w-full text-left text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
										>
											{tag.name} ({tag.count})
										</button>
									))}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</>
	);
}
