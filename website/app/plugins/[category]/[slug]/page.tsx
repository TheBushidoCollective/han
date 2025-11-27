import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	getAllPlugins,
	getAllPluginsAcrossCategories,
	getPluginContent,
} from "../../../../lib/plugins";
import Header from "../../../components/Header";
import InstallationTabs from "../../../components/InstallationTabs";
import RelatedPlugins from "../../../components/RelatedPlugins";
import Sidebar from "../../../components/Sidebar";

export async function generateStaticParams() {
	const categories = ["bushido", "buki", "do", "sensei"] as const;
	const params: { category: string; slug: string }[] = [];

	for (const category of categories) {
		const plugins = getAllPlugins(category);
		for (const plugin of plugins) {
			params.push({
				category,
				slug: category === "bushido" ? "core" : plugin.name,
			});
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

const hookDescriptions: Record<string, string> = {
	PreToolUse:
		"Runs after Claude creates tool parameters and before processing the tool call.",
	PermissionRequest: "Runs when the user is shown a permission dialog.",
	PostToolUse: "Runs immediately after a tool completes successfully.",
	Notification: "Runs when Claude Code sends notifications.",
	UserPromptSubmit:
		"Runs when the user submits a prompt, before Claude processes it.",
	Stop: "Runs when the main Claude Code agent has finished responding.",
	SubagentStop:
		"Runs when a Claude Code subagent (Task tool call) has finished responding.",
	PreCompact: "Runs before Claude Code is about to run a compact operation.",
	SessionStart:
		"Runs when Claude Code starts a new session or resumes an existing session.",
	SessionEnd: "Runs when a Claude Code session ends.",
};

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
	const { category, slug } = await params;

	if (!["bushido", "buki", "do", "sensei"].includes(category)) {
		return {
			title: "Plugin Not Found - Han",
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
			title: "Plugin Not Found - Han",
		};
	}

	return {
		title: `${plugin.metadata.title} - Han`,
		description: plugin.metadata.description,
	};
}

export default async function PluginPage({
	params,
}: {
	params: Promise<{ category: string; slug: string }>;
}) {
	const { category, slug } = await params;

	// Validate category
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

	// Get plugins for sidebar
	const bukiPlugins = getAllPlugins("buki").map((p) => ({
		name: p.name,
		title: p.title,
	}));
	const doPlugins = getAllPlugins("do").map((p) => ({
		name: p.name,
		title: p.title,
	}));
	const senseiPlugins = getAllPlugins("sensei").map((p) => ({
		name: p.name,
		title: p.title,
	}));

	// Load plugin metadata for tags
	const pluginJsonPath = path.join(
		process.cwd(),
		"..",
		plugin.metadata.category === "bushido"
			? "bushido"
			: `${plugin.metadata.category}/${plugin.metadata.name}`,
		".claude-plugin/plugin.json",
	);
	const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, "utf-8"));
	const tags = pluginJson.keywords || [];

	// Find related plugins
	const allPlugins = getAllPluginsAcrossCategories();
	const relatedPlugins = allPlugins
		.filter((p) => p.name !== plugin.metadata.name)
		.map((p) => {
			const pJsonPath = path.join(
				process.cwd(),
				"..",
				p.source,
				".claude-plugin/plugin.json",
			);
			const pJson = JSON.parse(fs.readFileSync(pJsonPath, "utf-8"));
			const pTags = pJson.keywords || [];
			const sharedTags = pTags.filter((t: string) => tags.includes(t));
			const sameCategory = p.category === plugin.metadata.category ? 1 : 0;
			return {
				name: p.name,
				description: p.description,
				category: p.category,
				sharedTags,
				score: sharedTags.length + sameCategory,
			};
		})
		.filter((p) => p.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 4);

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
					<span className="text-gray-900 dark:text-white font-medium">
						{plugin.metadata.title}
					</span>
				</div>
			</div>

			{/* Main Content with Sidebar */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
				<div className="flex gap-12">
					<Sidebar
						bukiPlugins={bukiPlugins}
						doPlugins={doPlugins}
						senseiPlugins={senseiPlugins}
					/>
					<main className="flex-1 min-w-0">
						{/* Header */}
						<div className="mb-8">
							<div className="flex items-center space-x-4 mb-4">
								<div className="text-6xl">{plugin.metadata.icon}</div>
								<div>
									<div className="flex items-center gap-3">
										<h1 className="text-5xl font-bold text-gray-900 dark:text-white">
											{plugin.metadata.title}
										</h1>
										{pluginJson.version && (
											<span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm font-mono">
												v{pluginJson.version}
											</span>
										)}
									</div>
									<p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
										{plugin.metadata.description}
									</p>
								</div>
							</div>
							<div className="flex flex-wrap gap-2 mt-4">
								{/* Category badge */}
								<Link
									href={`/search?q=${encodeURIComponent(`category:${category}`)}`}
									className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition text-sm capitalize"
								>
									{category}
								</Link>

								{/* Component badges */}
								{plugin.agents.length > 0 && (
									<Link
										href={`/search?q=${encodeURIComponent("component:agent")}`}
										className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition text-sm"
									>
										agent
									</Link>
								)}
								{plugin.skills.length > 0 && (
									<Link
										href={`/search?q=${encodeURIComponent("component:skill")}`}
										className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition text-sm"
									>
										skill
									</Link>
								)}
								{plugin.commands.length > 0 && (
									<Link
										href={`/search?q=${encodeURIComponent("component:command")}`}
										className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition text-sm"
									>
										command
									</Link>
								)}
								{plugin.hooks.length > 0 && (
									<Link
										href={`/search?q=${encodeURIComponent("component:hook")}`}
										className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition text-sm"
									>
										hook
									</Link>
								)}

								{plugin.mcpServers.length > 0 && (
									<Link
										href={`/search?q=${encodeURIComponent("component:mcp")}`}
										className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition text-sm"
									>
										mcp
									</Link>
								)}

								{/* Tag badges */}
								{tags.length > 0 &&
									tags.map((tag: string) => (
										<Link
											key={tag}
											href={`/search?q=${encodeURIComponent(`tag:${tag}`)}`}
											className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm"
										>
											{tag}
										</Link>
									))}
							</div>
						</div>

						{/* Jump to Menu */}
						<nav className="sticky top-4 z-10 mb-8 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-md">
							<p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
								Jump to:
							</p>
							<div className="flex flex-wrap gap-2">
								<a
									href="#installation"
									className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
								>
									<span>📦</span>
									<span>Installation</span>
								</a>
								{plugin.readme && (
									<a
										href="#overview"
										className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
									>
										<span>📄</span>
										<span>Overview</span>
									</a>
								)}
								{plugin.mcpServers.length > 0 && (
									<a
										href="#mcp-servers"
										className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
									>
										<span>🔌</span>
										<span>MCP Servers</span>
									</a>
								)}
								{plugin.agents.length > 0 && (
									<a
										href="#agents"
										className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
									>
										<span>🤖</span>
										<span>Agents</span>
									</a>
								)}
								{plugin.commands.length > 0 && (
									<a
										href="#commands"
										className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
									>
										<span>⌘</span>
										<span>Commands</span>
									</a>
								)}
								{plugin.skills.length > 0 && (
									<a
										href="#skills"
										className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
									>
										<span>📖</span>
										<span>Skills</span>
									</a>
								)}
								{plugin.hooks.length > 0 && (
									<a
										href="#hooks"
										className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
									>
										<span>🪝</span>
										<span>Hooks</span>
									</a>
								)}
								{relatedPlugins.length > 0 && (
									<a
										href="#related"
										className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
									>
										<span>🔗</span>
										<span>Related Plugins</span>
									</a>
								)}
							</div>
						</nav>

						{/* Installation */}
						<section
							id="installation"
							className="scroll-mt-32 mb-12 bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
						>
							<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
								Installation
							</h2>
							<InstallationTabs pluginName={plugin.metadata.name} />
						</section>

						{/* README Section */}
						{plugin.readme && (
							<section
								id="overview"
								className="scroll-mt-32 mb-12 bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700"
							>
								<div className="prose dark:prose-invert max-w-none prose-p:my-3 prose-headings:mb-3 prose-headings:mt-6">
									<ReactMarkdown remarkPlugins={[remarkGfm]}>
										{plugin.readme.replace(/^\s*#\s+.+/, "# Overview")}
									</ReactMarkdown>
								</div>
							</section>
						)}

						{/* MCP Servers Section */}
						{plugin.mcpServers.length > 0 && (
							<section id="mcp-servers" className="scroll-mt-32 mb-12">
								<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
									MCP Servers
								</h2>
								<div className="space-y-4">
									{plugin.mcpServers.map((server) => (
										<div
											key={server.name}
											className="block bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
										>
											<div className="flex items-start space-x-3">
												<div className="text-2xl">🔌</div>
												<div className="flex-1">
													<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
														{server.name}
													</h3>
													<div className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto text-sm scrollbar-custom">
														<code>
															{server.command} {server.args.join(" ")}
														</code>
													</div>
													{server.env && Object.keys(server.env).length > 0 && (
														<div className="mt-4">
															<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
																Environment Variables:
															</h4>
															<div className="bg-gray-50 dark:bg-gray-900 p-3 rounded space-y-1">
																{Object.entries(server.env).map(
																	([key, value]) => (
																		<div
																			key={key}
																			className="text-sm font-mono"
																		>
																			<span className="text-purple-600 dark:text-purple-400">
																				{key}
																			</span>
																			<span className="text-gray-500">
																				={value}
																			</span>
																		</div>
																	),
																)}
															</div>
														</div>
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							</section>
						)}

						{/* Agents Section */}
						{plugin.agents.length > 0 && (
							<section id="agents" className="scroll-mt-32 mb-12">
								<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
									Agents
								</h2>
								<div className="space-y-4">
									{plugin.agents.map((agent) => (
										<Link
											key={agent.name}
											href={`/plugins/${category}/${slug}/agents/${agent.name}`}
											className="block bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition"
										>
											<div className="flex items-center space-x-3">
												<div className="text-2xl">🤖</div>
												<div className="flex-1">
													<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
														{agent.name}
													</h3>
													<p className="text-gray-600 dark:text-gray-300">
														{agent.description}
													</p>
												</div>
											</div>
										</Link>
									))}
								</div>
							</section>
						)}

						{/* Commands Section */}
						{plugin.commands.length > 0 && (
							<section id="commands" className="scroll-mt-32 mb-12">
								<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
									Commands
								</h2>
								<div className="space-y-4">
									{plugin.commands.map((command) => (
										<Link
											key={command.name}
											href={`/plugins/${category}/${slug}/commands/${command.name}`}
											className="block bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition"
										>
											<div className="flex items-center space-x-3">
												<div className="text-2xl">⌘</div>
												<div className="flex-1">
													<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
														/{command.name}
													</h3>
													<p className="text-gray-600 dark:text-gray-300">
														{command.description}
													</p>
												</div>
											</div>
										</Link>
									))}
								</div>
							</section>
						)}

						{/* Skills Section */}
						{plugin.skills.length > 0 && (
							<section id="skills" className="scroll-mt-32 mb-12">
								<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
									Skills
								</h2>
								<div className="space-y-4">
									{plugin.skills.map((skill) => (
										<Link
											key={skill.name}
											href={`/plugins/${category}/${slug}/skills/${skill.name}`}
											className="block bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition"
										>
											<div className="flex items-center space-x-3">
												<div className="text-2xl">📖</div>
												<div className="flex-1">
													<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
														{skill.name}
													</h3>
													<p className="text-gray-600 dark:text-gray-300">
														{skill.description}
													</p>
												</div>
											</div>
										</Link>
									))}
								</div>
							</section>
						)}

						{/* Hooks Section */}
						{plugin.hooks.length > 0 && (
							<section id="hooks" className="scroll-mt-32 mb-12">
								<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
									Hooks
								</h2>
								<div className="space-y-4">
									{plugin.hooks.map((hookSection) => (
										<div
											key={hookSection.section}
											className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
										>
											<div className="flex items-center space-x-3 mb-3">
												<div className="text-2xl">🪝</div>
												<div className="flex-1">
													<h3 className="text-xl font-semibold text-gray-900 dark:text-white">
														{hookSection.section}
													</h3>
													{hookDescriptions[hookSection.section] && (
														<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
															{hookDescriptions[hookSection.section]}
														</p>
													)}
												</div>
											</div>
											<div className="space-y-3 mb-4">
												{hookSection.commands.map((command) => (
													<pre
														key={command}
														className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto text-sm scrollbar-custom"
													>
														<code>{command}</code>
													</pre>
												))}
											</div>
											{hookSection.files.length > 0 && (
												<div className="border-t border-gray-200 dark:border-gray-700 pt-4">
													<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
														Referenced Files:
													</h4>
													<div className="grid gap-2">
														{hookSection.files.map((file) => (
															<Link
																key={file.name}
																href={`/plugins/${category}/${slug}/hooks/${file.name}`}
																className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-950 transition border border-gray-200 dark:border-gray-700"
															>
																<span className="text-lg">📄</span>
																<span className="text-sm font-mono text-gray-700 dark:text-gray-300">
																	{file.path}
																</span>
															</Link>
														))}
													</div>
												</div>
											)}
										</div>
									))}
								</div>
							</section>
						)}

						{/* Related Plugins */}
						{relatedPlugins.length > 0 && (
							<RelatedPlugins plugins={relatedPlugins} />
						)}
					</main>
				</div>
			</div>
		</div>
	);
}
