import type { Metadata } from "next";
import Link from "next/link";
import { getAllPlugins, getCategoryIcon } from "../../lib/plugins";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
	title: "Plugins - Han",
	description:
		"Browse all Han marketplace plugins organized by category. Each category represents a different aspect of the development lifecycle.",
};

export default function PluginsPage() {
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

			{/* Main Content with Sidebar */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
				<div className="flex gap-12">
					<Sidebar
						jutsuPlugins={jutsuPlugins}
						doPlugins={doPlugins}
						hashiPlugins={hashiPlugins}
					/>
					<main className="flex-1 min-w-0">
						<h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
							Plugin Marketplace
						</h1>
						<p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl">
							Browse all Han marketplace plugins organized by category. Each
							category represents a different aspect of the development
							lifecycle.
						</p>

						<div className="grid md:grid-cols-2 gap-8 mb-16">
							<CategoryLink
								href="/plugins/bushido"
								icon={getCategoryIcon("bushido")}
								title="Bushido"
								subtitle="武士道 - Core Principles"
								description="Foundational philosophy and enforcement mechanisms for honorable software development."
								pluginCount={1}
							/>
							<CategoryLink
								href="/plugins/do"
								icon={getCategoryIcon("do")}
								title="Dō"
								subtitle="道 - The Way"
								description="Specialized agents for development disciplines and practices."
								pluginCount={30}
							/>
							<CategoryLink
								href="/plugins/jutsu"
								icon={getCategoryIcon("jutsu")}
								title="Jutsu"
								subtitle="術 - Techniques"
								description="Language and tool skills with validation hooks for maintaining quality."
								pluginCount={69}
							/>
							<CategoryLink
								href="/plugins/hashi"
								icon={getCategoryIcon("hashi")}
								title="Hashi"
								subtitle="橋 - Bridges"
								description="MCP servers providing external knowledge and integrations."
								pluginCount={2}
							/>
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
			className="bg-white dark:bg-gray-800 p-8 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-gray-400 transition group"
		>
			<div className="flex items-start justify-between mb-4">
				<div className="text-5xl">{icon}</div>
				<span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
					{pluginCount} {pluginCount === 1 ? "plugin" : "plugins"}
				</span>
			</div>
			<h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-gray-700 dark:group-hover:text-gray-200">
				{title}
			</h3>
			<p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-medium">
				{subtitle}
			</p>
			<p className="text-gray-600 dark:text-gray-300">{description}</p>
		</Link>
	);
}
