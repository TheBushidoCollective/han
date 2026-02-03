import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/app/components/Header";
import MarkdownContent from "@/app/components/MarkdownContent";
import Sidebar from "@/app/components/Sidebar";
import {
	CATEGORY_META,
	CATEGORY_ORDER,
	getAllPlugins,
	getPluginContent,
	type PluginCategory,
} from "@/lib/plugins";

export async function generateStaticParams() {
	const params: { category: string; slug: string; command: string }[] = [];

	for (const category of CATEGORY_ORDER) {
		const plugins = getAllPlugins(category);
		for (const plugin of plugins) {
			const details = getPluginContent(category, plugin.name);
			if (details) {
				for (const command of details.commands) {
					params.push({
						category,
						slug: plugin.name,
						command: command.name,
					});
				}
			}
		}
	}

	return params;
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
	params: Promise<{ category: string; slug: string; command: string }>;
}): Promise<Metadata> {
	const { category, slug, command: commandName } = await params;

	if (!CATEGORY_ORDER.includes(category as PluginCategory)) {
		return {
			title: "Command Not Found - Han",
		};
	}

	const plugin = getPluginContent(category as PluginCategory, slug);

	if (!plugin) {
		return {
			title: "Command Not Found - Han",
		};
	}

	const command = plugin.commands.find((c) => c.name === commandName);

	if (!command) {
		return {
			title: "Command Not Found - Han",
		};
	}

	return {
		title: `/${command.name} - ${plugin.metadata.title} - Han`,
		description: command.description,
	};
}

export default async function CommandPage({
	params,
}: {
	params: Promise<{ category: string; slug: string; command: string }>;
}) {
	const { category, slug, command: commandName } = await params;

	if (!CATEGORY_ORDER.includes(category as PluginCategory)) {
		notFound();
	}

	const plugin = getPluginContent(category as PluginCategory, slug);

	if (!plugin) {
		notFound();
	}

	// Get plugins for sidebar
	const pluginsByCategory = getPluginsByCategory();

	const command = plugin.commands.find((c) => c.name === commandName);

	if (!command) {
		notFound();
	}

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
					<Link
						href={`/plugins/${category}`}
						className="hover:text-gray-900 dark:hover:text-white"
					>
						{CATEGORY_META[category as PluginCategory]?.title || category}
					</Link>
					<span>/</span>
					<Link
						href={`/plugins/${category}/${slug}`}
						className="hover:text-gray-900 dark:hover:text-white"
					>
						{plugin.metadata.title}
					</Link>
					<span>/ commands /</span>
					<span className="text-gray-900 dark:text-white font-medium">
						{command.name}
					</span>
				</div>
			</div>

			{/* Main Content with Sidebar */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
				<div className="flex gap-12">
					<Sidebar pluginsByCategory={pluginsByCategory} />
					<main className="flex-1 min-w-0">
						{/* Header */}
						<div className="mb-8">
							<h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
								⌘ /{command.name}
							</h1>
							<p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
								{command.description}
							</p>

							{/* Command Metadata Badges */}
							<div className="flex flex-wrap gap-2">
								{command.internal && (
									<span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
										⚙️ Internal
									</span>
								)}
								{command.disableModelInvocation && (
									<span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
										👤 User Only
									</span>
								)}
								{command.userInvocable === false && (
									<span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
										🤖 Agent Only
									</span>
								)}
								{command.argumentHint && (
									<span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
										📝 {command.argumentHint}
									</span>
								)}
							</div>
						</div>

						{/* Usage Card */}
						<div className="mb-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
							<h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
								Command Usage
							</h3>
							<p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
								Invoke this command in Claude Code:
							</p>
							<div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded p-3">
								<code className="text-sm font-mono text-gray-900 dark:text-gray-100">
									/{command.name}
								</code>
							</div>
						</div>

						<hr />
						<br />

						{/* Markdown Content */}
						<MarkdownContent
							content={command.content.replace(/^\s*#\s+.+/, "# Overview")}
						/>
					</main>
				</div>
			</div>
		</div>
	);
}
