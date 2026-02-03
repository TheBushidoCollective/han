import type { Metadata } from "next";
import Link from "next/link";
import {
	CATEGORY_META,
	CATEGORY_ORDER,
	getAllPlugins,
	getCategoryIcon,
	type PluginCategory,
} from "../../lib/plugins";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
	title: "Plugins - Han",
	description:
		"Browse all Han marketplace plugins organized by category. Each category represents a different aspect of the development lifecycle.",
};

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

export default function PluginsPage() {
	const pluginsByCategory = getPluginsByCategory();

	return (
		<div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
			<Header />

			{/* Main Content with Sidebar */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
				<div className="flex gap-12">
					<Sidebar pluginsByCategory={pluginsByCategory} />
					<main className="flex-1 min-w-0">
						<h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
							Plugin Marketplace
						</h1>
						<p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl">
							Browse all Han marketplace plugins organized by category. Each
							category represents a different aspect of the development
							lifecycle.
						</p>

						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
							{CATEGORY_ORDER.map((category) => {
								const plugins = pluginsByCategory[category];
								const meta = CATEGORY_META[category];

								// Skip empty categories
								if (plugins.length === 0) return null;

								return (
									<CategoryLink
										key={category}
										href={`/plugins/${category}`}
										icon={getCategoryIcon(category)}
										title={meta.title}
										subtitle={meta.subtitle}
										description={meta.description}
										pluginCount={plugins.length}
									/>
								);
							})}
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}

function CategoryLink({
	href,
	icon,
	title,
	subtitle,
	description,
	pluginCount,
}: {
	href: string;
	icon: string;
	title: string;
	subtitle: string;
	description: string;
	pluginCount: number;
}) {
	return (
		<Link
			href={href}
			className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-gray-400 transition group"
		>
			<div className="flex items-start justify-between mb-3">
				<div className="text-4xl">{icon}</div>
				<span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
					{pluginCount} {pluginCount === 1 ? "plugin" : "plugins"}
				</span>
			</div>
			<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-gray-700 dark:group-hover:text-gray-200">
				{title}
			</h3>
			<p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-medium">
				{subtitle}
			</p>
			<p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
		</Link>
	);
}
