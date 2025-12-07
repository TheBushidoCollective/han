import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPlugins, getCategoryIcon } from "../../../lib/plugins";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";

export async function generateStaticParams() {
	return [
		{ category: "core" },
		{ category: "jutsu" },
		{ category: "do" },
		{ category: "hashi" },
	];
}

const categoryData = {
	core: {
		title: "Core",
		subtitle: "⚙️ - Essential Infrastructure",
		description:
			"Essential infrastructure for the Han marketplace including skills, commands, MCP servers, and quality enforcement hooks. Both han-core (infrastructure) and bushido (philosophy) are available.",
	},
	jutsu: {
		title: "Jutsu",
		subtitle: "術 - Techniques",
		description:
			"Language and tool skills with validation hooks for maintaining quality. Each Jutsu plugin provides specialized knowledge for a specific programming language, framework, or development tool.",
	},
	do: {
		title: "Dō",
		subtitle: "道 - The Way",
		description:
			"Specialized discipline agents for focused expertise areas. Each Dō plugin contains agents that embody specific engineering disciplines and methodologies.",
	},
	hashi: {
		title: "Hashi",
		subtitle: "橋 - Bridge",
		description:
			"MCP servers that extend Claude Code's capabilities. These plugins integrate external services and tools to enhance Claude's abilities.",
	},
} as const;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string }>;
}): Promise<Metadata> {
	const { category } = await params;
	const data = categoryData[category as keyof typeof categoryData];

	if (!data) {
		return {
			title: "Category Not Found - Han",
		};
	}

	return {
		title: `${data.title} Plugins - Han`,
		description: data.description,
	};
}

export default async function CategoryPage({
	params,
}: {
	params: Promise<{ category: string }>;
}) {
	const { category } = await params;

	if (!["core", "jutsu", "do", "hashi"].includes(category)) {
		notFound();
	}

	const categoryKey = category as keyof typeof categoryData;
	const categoryInfo = categoryData[categoryKey];
	const categoryIcon = getCategoryIcon(categoryKey);
	const plugins = getAllPlugins(categoryKey);

	// Get plugins for sidebar
	const jutsuPlugins = getAllPlugins("jutsu").map((p) => ({
		name: p.name,
		title: p.title,
	}));
	const doPlugins = getAllPlugins("do").map((p) => ({
		name: p.name,
		title: p.title,
	}));
	const hashiPlugins = getAllPlugins("hashi").map((p) => ({
		name: p.name,
		title: p.title,
	}));

	return (
		<div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
			<Header />

			{/* Breadcrumbs */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
				<div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
					<Link
						href="/plugins"
						className="hover:text-gray-900 dark:hover:text-white"
					>
						Documentation
					</Link>
					<span>/</span>
					<span className="text-gray-900 dark:text-white font-medium">
						{categoryInfo.title}
					</span>
				</div>
			</div>

			{/* Main Content with Sidebar */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
				<div className="flex gap-12">
					<Sidebar
						jutsuPlugins={jutsuPlugins}
						doPlugins={doPlugins}
						hashiPlugins={hashiPlugins}
					/>
					<main className="flex-1 min-w-0">
						<div className="mb-12">
							<div className="flex items-center space-x-4 mb-4">
								<div className="text-6xl">{categoryIcon}</div>
								<div>
									<h1 className="text-5xl font-bold text-gray-900 dark:text-white">
										{categoryInfo.title}
									</h1>
									<p className="text-xl text-gray-600 dark:text-gray-400 mt-1">
										{categoryInfo.subtitle}
									</p>
								</div>
							</div>
							<p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mt-6">
								{categoryInfo.description}
							</p>
						</div>

						{/* Stats */}
						<div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-12 border border-gray-200 dark:border-gray-700">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										Total Plugins
									</p>
									<p className="text-3xl font-bold text-gray-900 dark:text-white">
										{plugins.length}
									</p>
								</div>
								<div className="text-5xl">{categoryIcon}</div>
							</div>
						</div>

						{/* Plugin List */}
						<section>
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
								All {categoryInfo.title} Plugins
							</h2>
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
								{plugins.map((plugin) => (
									<Link
										key={plugin.name}
										href={`/plugins/${category}/${plugin.name}`}
										className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-gray-400 transition block group"
									>
										<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-gray-700 dark:group-hover:text-gray-200">
											{plugin.title}
										</h3>
										<p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
											{plugin.description}
										</p>
										<code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-gray-700 dark:text-gray-300 block">
											{plugin.name}@han
										</code>
									</Link>
								))}
							</div>
						</section>
					</main>
				</div>
			</div>
		</div>
	);
}
