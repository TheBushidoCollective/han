import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAllPlugins, getPluginContent } from "../../../../../../lib/plugins";
import Header from "../../../../../components/Header";
import Sidebar from "../../../../../components/Sidebar";

export async function generateStaticParams() {
	const categories = ["bushido", "jutsu", "do", "hashi"] as const;
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
	jutsu: "Jutsu",
	do: "Dō",
	hashi: "Hashi",
} as const;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string; slug: string; agent: string }>;
}): Promise<Metadata> {
	const { category, slug, agent: agentName } = await params;

	if (!["bushido", "jutsu", "do", "hashi"].includes(category)) {
		return {
			title: "Agent Not Found - Han",
		};
	}

	const pluginSlug =
		category === "bushido" && slug === "core" ? "bushido" : slug;
	const plugin = getPluginContent(
		category as "bushido" | "jutsu" | "do" | "hashi",
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

	if (!["bushido", "jutsu", "do", "hashi"].includes(category)) {
		notFound();
	}

	const pluginSlug =
		category === "bushido" && slug === "core" ? "bushido" : slug;
	const plugin = getPluginContent(
		category as "bushido" | "jutsu" | "do" | "hashi",
		pluginSlug,
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

	const agent = plugin.agents.find((a) => a.name === agentName);

	if (!agent) {
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
					<span>/ agents /</span>
					<span className="text-gray-900 dark:text-white font-medium">
						{agent.name}
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
								🤖 {agent.name}
							</h1>
							<p className="text-lg text-gray-600 dark:text-gray-400">
								{agent.description}
							</p>
						</div>

						{/* Invocation Card */}
						<div className="mb-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
							<h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
								Agent Invocation
							</h3>
							<p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
								Claude will automatically use this agent based on context. To
								force invocation, mention this agent in your prompt:
							</p>
							<div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded p-3">
								<code className="text-sm font-mono text-gray-900 dark:text-gray-100">
									@agent-{plugin.metadata.name}:{agent.name}
								</code>
							</div>
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
