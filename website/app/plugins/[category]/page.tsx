import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
	CATEGORY_META,
	CATEGORY_ORDER,
	getAllPlugins,
	getCategoryIcon,
	type PluginCategory,
} from "../../../lib/plugins";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";

export async function generateStaticParams() {
	return CATEGORY_ORDER.map((category) => ({ category }));
}

// Build plugins by category for sidebar
function getPluginsByCategory() {
	const result: Record<PluginCategory, { name: string; title: string }[]> = {
		core: [],
		languages: [],
		frameworks: [],
		validation: [],
		tools: [],
		services: [],
		disciplines: [],
		patterns: [],
		specialized: [],
	};

	for (const category of CATEGORY_ORDER) {
		result[category] = getAllPlugins(category).map((p) => ({
			name: p.name,
			title: p.title,
		}));
	}

	return result;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string }>;
}): Promise<Metadata> {
	const { category } = await params;
	const meta = CATEGORY_META[category as PluginCategory];

	if (!meta) {
		return {
			title: "Category Not Found - Han",
		};
	}

	return {
		title: `${meta.title} Plugins - Han`,
		description: meta.description,
	};
}

export default async function CategoryPage({
	params,
}: {
	params: Promise<{ category: string }>;
}) {
	const { category } = await params;

	if (!CATEGORY_ORDER.includes(category as PluginCategory)) {
		notFound();
	}

	const categoryKey = category as PluginCategory;
	const categoryInfo = CATEGORY_META[categoryKey];
	const categoryIcon = getCategoryIcon(categoryKey);
	const plugins = getAllPlugins(categoryKey);
	const pluginsByCategory = getPluginsByCategory();

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
					<Sidebar pluginsByCategory={pluginsByCategory} />
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
