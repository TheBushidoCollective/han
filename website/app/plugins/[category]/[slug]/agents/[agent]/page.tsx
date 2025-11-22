import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAllPlugins, getPluginContent } from "../../../../../../lib/plugins";
import Sidebar from "../../../../../components/Sidebar";

export async function generateStaticParams() {
	const categories = ["bushido", "buki", "do", "sensei"] as const;
	const params: { category: string; slug: string; agent: string }[] = [];

	for (const category of categories) {
		const plugins = getAllPlugins(category);
		for (const plugin of plugins) {
			const details = getPluginContent(category, plugin.name);
			if (details) {
				for (const agent of details.agents) {
					params.push({
						category,
						slug: category === "bushido" ? "core" : plugin.name,
						agent: agent.name,
					});
				}
			}
		}
	}

	return params;
}

const categoryLabels = {
	bushido: "Bushido",
	buki: "Buki",
	do: "Dō",
	sensei: "Sensei",
} as const;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string; slug: string; agent: string }>;
}): Promise<Metadata> {
	const { category, slug, agent: agentName } = await params;

	if (!["bushido", "buki", "do", "sensei"].includes(category)) {
		return {
			title: "Agent Not Found - Han",
		};
	}

	const pluginSlug =
		category === "bushido" && slug === "core" ? "bushido" : slug;
	const plugin = getPluginContent(
		category as "bushido" | "buki" | "do" | "sensei",
		pluginSlug,
	);

	if (!plugin) {
		return {
			title: "Agent Not Found - Han",
		};
	}

	const agent = plugin.agents.find((a) => a.name === agentName);

	if (!agent) {
		return {
			title: "Agent Not Found - Han",
		};
	}

	return {
		title: `${agent.name} - ${plugin.metadata.title} - Han`,
		description: agent.description,
	};
}

export default async function AgentPage({
	params,
}: {
	params: Promise<{ category: string; slug: string; agent: string }>;
}) {
	const { category, slug, agent: agentName } = await params;

	if (!["bushido", "buki", "do", "sensei"].includes(category)) {
		notFound();
	}

	const pluginSlug =
		category === "bushido" && slug === "core" ? "bushido" : slug;
	const plugin = getPluginContent(
		category as "bushido" | "buki" | "do" | "sensei",
		pluginSlug,
	);

	if (!plugin) {
		notFound();
	}

	const agent = plugin.agents.find((a) => a.name === agentName);

	if (!agent) {
		notFound();
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
			{/* Header */}
			<header className="border-b border-gray-200 dark:border-gray-700">
				<nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
					<div className="flex items-center justify-between">
						<Link href="/" className="flex items-center space-x-3">
							<div className="text-4xl">⛩️</div>
							<div className="text-2xl font-bold text-gray-900 dark:text-white">
								Han
							</div>
						</Link>
						<div className="hidden md:flex space-x-8">
							<Link
								href="/docs"
								className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
							>
								Documentation
							</Link>
							<a
								href="https://github.com/thebushidocollective/han"
								className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
							>
								GitHub
							</a>
						</div>
					</div>
				</nav>
			</header>

			{/* Breadcrumbs */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
				<div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
					<Link
						href="/docs"
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
					<span>/ agents /</span>
					<span className="text-gray-900 dark:text-white font-medium">
						{agent.name}
					</span>
				</div>
			</div>

			{/* Main Content with Sidebar */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
				<div className="flex gap-12">
					<Sidebar />
					<main className="flex-1 min-w-0">
						{/* Header */}
						<div className="mb-8">
							<h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
								🤖 {agent.name}
							</h1>
							<p className="text-lg text-gray-600 dark:text-gray-400">
								{agent.description}
							</p>
						</div>

						<hr />
						<br />

						{/* Markdown Content */}
						<div className="prose prose-lg dark:prose-invert max-w-none">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{agent.content}
							</ReactMarkdown>
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}
