import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/app/components/Header";
import MarkdownContent from "@/app/components/MarkdownContent";
import Sidebar from "@/app/components/Sidebar";
import { getAllPlugins, getPluginContent } from "@/lib/plugins";

export async function generateStaticParams() {
	const categories = ["core", "jutsu", "do", "hashi"] as const;
	const params: { category: string; slug: string; command: string }[] = [];

	for (const category of categories) {
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

const categoryLabels = {
	core: "Core",
	jutsu: "Jutsu",
	do: "Dō",
	hashi: "Hashi",
} as const;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string; slug: string; command: string }>;
}): Promise<Metadata> {
	const { category, slug, command: commandName } = await params;

	if (!["core", "jutsu", "do", "hashi"].includes(category)) {
		return {
			title: "Command Not Found - Han",
		};
	}

	const plugin = getPluginContent(
		category as "core" | "jutsu" | "do" | "hashi",
		slug,
	);

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

	if (!["core", "jutsu", "do", "hashi"].includes(category)) {
		notFound();
	}

	const plugin = getPluginContent(
		category as "core" | "jutsu" | "do" | "hashi",
		slug,
	);

	if (!plugin) {
		notFound();
	}

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
						{categoryLabels[category as keyof typeof categoryLabels]}
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
					<Sidebar
						jutsuPlugins={jutsuPlugins}
						doPlugins={doPlugins}
						hashiPlugins={hashiPlugins}
					/>
					<main className="flex-1 min-w-0">
						{/* Header */}
						<div className="mb-8">
							<h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
								⌘ /{command.name}
							</h1>
							<p className="text-lg text-gray-600 dark:text-gray-400">
								{command.description}
							</p>
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
