import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import YAML from "yaml";
import {
	getAllPlugins,
	getAllPluginsAcrossCategories,
	getPluginContent,
} from "../../../../lib/plugins";
import Header from "../../../components/Header";
import HookCommandWithDetails from "../../../components/HookCommandWithDetails";
import InstallationTabs from "../../../components/InstallationTabs";
import MarkdownContent from "../../../components/MarkdownContent";
import RelatedPlugins from "../../../components/RelatedPlugins";
import Sidebar from "../../../components/Sidebar";

export async function generateStaticParams() {
	const categories = ["core", "jutsu", "do", "hashi"] as const;
	const params: { category: string; slug: string }[] = [];

	for (const category of categories) {
		const plugins = getAllPlugins(category);
		for (const plugin of plugins) {
			params.push({
				category,
				slug: plugin.name,
			});
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

// License badge configuration (Tailwind classes for colors)
const licenseConfig: Record<
	string,
	{ label: string; bgClass: string; textClass: string; url: string }
> = {
	"Apache-2.0": {
		label: "Apache 2.0",
		bgClass: "bg-blue-100 dark:bg-blue-900",
		textClass: "text-blue-800 dark:text-blue-200",
		url: "https://opensource.org/licenses/Apache-2.0",
	},
	MIT: {
		label: "MIT",
		bgClass: "bg-green-100 dark:bg-green-900",
		textClass: "text-green-800 dark:text-green-200",
		url: "https://opensource.org/licenses/MIT",
	},
	"GPL-3.0": {
		label: "GPL v3",
		bgClass: "bg-red-100 dark:bg-red-900",
		textClass: "text-red-800 dark:text-red-200",
		url: "https://www.gnu.org/licenses/gpl-3.0",
	},
	"BSD-3-Clause": {
		label: "BSD 3-Clause",
		bgClass: "bg-orange-100 dark:bg-orange-900",
		textClass: "text-orange-800 dark:text-orange-200",
		url: "https://opensource.org/licenses/BSD-3-Clause",
	},
	ISC: {
		label: "ISC",
		bgClass: "bg-purple-100 dark:bg-purple-900",
		textClass: "text-purple-800 dark:text-purple-200",
		url: "https://opensource.org/licenses/ISC",
	},
};

const hookDescriptions: Record<string, string> = {
	Setup:
		"Runs when Claude Code is invoked with --init, --init-only, or --maintenance flags. Used for repository setup, maintenance tasks, and one-time initialization workflows.",
	SessionStart:
		"Runs when Claude Code starts a new session or resumes an existing session. Can inject project context, set up environment, or provide important reminders at the start of work.",
	UserPromptSubmit:
		"Runs when the user submits a prompt, before Claude processes it. Can inject required context, enforce workflows, or validate user intent before processing begins.",
	PreToolUse:
		"Runs after Claude creates tool parameters and before processing the tool call. Can inject context, validate parameters, or block unsafe operations before they execute.",
	PermissionRequest:
		"Runs when the user is shown a permission dialog. Can add context to help users make informed decisions about granting permissions.",
	PostToolUse:
		"Runs immediately after a tool completes successfully. Can validate outputs, log results, or trigger follow-up actions based on tool execution.",
	Stop: "Runs when the main Claude Code agent has finished responding. Can verify task completion, check quality gates, or ensure documentation requirements are met before the session ends.",
	SubagentStop:
		"Runs when a Claude Code subagent (Task tool call) has finished responding. Can validate subagent outputs, enforce quality standards, or trigger additional workflows after delegated tasks complete.",
	PreCompact:
		"Runs before Claude Code is about to run a compact operation. Can preserve important context, mark critical information for retention, or adjust what gets compacted.",
	Notification:
		"Runs when Claude Code sends notifications. Can enhance, filter, or redirect notifications to external systems.",
	SessionEnd:
		"Runs when a Claude Code session ends. Can perform cleanup, generate summaries, or ensure all tasks are properly closed before the session terminates.",
};

const hookEmojis: Record<string, string> = {
	Setup: "🔧",
	SessionStart: "▶️",
	UserPromptSubmit: "💬",
	PreToolUse: "🔧",
	PermissionRequest: "🔐",
	PostToolUse: "🔧",
	Stop: "🛑",
	SubagentStop: "🛑",
	PreCompact: "🗜️",
	Notification: "🔔",
	SessionEnd: "🏁",
};

// Hook lifecycle order for sorting
const hookLifecycleOrder = [
	"Setup",
	"SessionStart",
	"UserPromptSubmit",
	"PreToolUse",
	"PermissionRequest",
	"PostToolUse",
	"Stop",
	"SubagentStop",
	"PreCompact",
	"Notification",
	"SessionEnd",
];

// Check if a command has inline file references (matches patterns that trigger inline display)
function hasInlineFileReferences(command: string): boolean {
	// Matches patterns like: hooks/file.md or scripts/file.sh
	return /(?:hooks|scripts)\/[a-zA-Z0-9_-]+\.(md|sh|js)/.test(command);
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
	const { category, slug } = await params;

	if (!["core", "jutsu", "do", "hashi"].includes(category)) {
		return {
			title: "Plugin Not Found - Han",
		};
	}

	const plugin = getPluginContent(
		category as "core" | "jutsu" | "do" | "hashi",
		slug,
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

	// Load plugin metadata for tags
	const pluginDir = path.join(
		process.cwd(),
		"..",
		plugin.metadata.category === "core"
			? plugin.source.replace("./", "")
			: `${plugin.metadata.category}/${plugin.metadata.name}`,
	);
	const pluginJsonPath = path.join(pluginDir, ".claude-plugin/plugin.json");
	const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, "utf-8"));
	const tags = pluginJson.keywords || [];

	// Load han-plugin.yml if it exists (for hook configuration)
	const hanPluginPath = path.join(pluginDir, "han-plugin.yml");
	let hanConfig: {
		hooks?: Record<
			string,
			{
				command?: string;
				dirs_with?: string[];
				dir_test?: string;
				if_changed?: string[];
			}
		>;
	} | null = null;
	if (fs.existsSync(hanPluginPath)) {
		try {
			hanConfig = YAML.parse(fs.readFileSync(hanPluginPath, "utf-8"));
		} catch {
			hanConfig = null;
		}
	}

	// Load script files from scripts/ folder (for han-config hooks)
	const scriptsDir = path.join(pluginDir, "scripts");
	const scriptFiles: { name: string; path: string; content: string }[] = [];
	if (fs.existsSync(scriptsDir)) {
		const scripts = fs
			.readdirSync(scriptsDir)
			.filter((f) => f.endsWith(".sh") || f.endsWith(".js"));
		for (const script of scripts) {
			const scriptPath = path.join(scriptsDir, script);
			scriptFiles.push({
				name: path.basename(script, path.extname(script)),
				path: `scripts/${script}`,
				content: fs.readFileSync(scriptPath, "utf-8"),
			});
		}
	}

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
						jutsuPlugins={jutsuPlugins}
						doPlugins={doPlugins}
						hashiPlugins={hashiPlugins}
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
										{pluginJson.license && licenseConfig[pluginJson.license] && (
											<a
												href={licenseConfig[pluginJson.license].url}
												target="_blank"
												rel="noopener noreferrer"
												className={`px-2 py-1 ${licenseConfig[pluginJson.license].bgClass} ${licenseConfig[pluginJson.license].textClass} rounded text-sm font-medium hover:opacity-80 transition`}
											>
												{licenseConfig[pluginJson.license].label}
											</a>
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
								<MarkdownContent
									content={plugin.readme.replace(/^\s*#\s+.+/, "# Overview")}
									className="prose-p:my-3 prose-headings:mb-3 prose-headings:mt-6"
								/>
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
													<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
														{server.name}
													</h3>
													{server.description && (
														<p className="text-gray-600 dark:text-gray-400 mb-4">
															{server.description}
														</p>
													)}

													{/* Capabilities */}
													{server.capabilities &&
														server.capabilities.length > 0 && (
															<div className="mb-4">
																<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
																	Capabilities:
																</h4>
																<div className="space-y-3">
																	{server.capabilities.map((cap, idx) => (
																		<div
																			key={`${cap.category}-${idx}`}
																			className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
																		>
																			<div className="flex items-center gap-2 mb-2">
																				<span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
																					{cap.category}
																				</span>
																			</div>
																			<p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
																				{cap.summary}
																			</p>
																			{cap.examples &&
																				cap.examples.length > 0 && (
																					<div className="mt-2">
																						<p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">
																							Example prompts:
																						</p>
																						<ul className="space-y-1">
																							{cap.examples.map((example) => (
																								<li
																									key={example}
																									className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
																								>
																									<span className="text-gray-400 dark:text-gray-600">
																										&quot;
																									</span>
																									<span className="italic">
																										{example}
																									</span>
																									<span className="text-gray-400 dark:text-gray-600">
																										&quot;
																									</span>
																								</li>
																							))}
																						</ul>
																					</div>
																				)}
																		</div>
																	))}
																</div>
															</div>
														)}

													{/* Command */}
													<div className="mb-4">
														<h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
															Command:
														</h4>
														<div className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto text-sm scrollbar-custom">
															<code>
																{server.command} {server.args.join(" ")}
															</code>
														</div>
													</div>

													{/* Environment Variables */}
													{server.env && Object.keys(server.env).length > 0 && (
														<div>
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
								{/* Token Usage Disclaimer - only show if plugin has configurable hooks */}
								{hanConfig?.hooks &&
									Object.keys(hanConfig.hooks).length > 0 && (
										<div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
											<div className="flex items-start gap-3">
												<span className="text-amber-600 dark:text-amber-400 text-xl">
													⚠️
												</span>
												<div className="text-sm text-amber-800 dark:text-amber-200">
													<p className="font-semibold mb-1">
														Token Usage Notice
													</p>
													<p>
														Hooks run automatically during Claude Code sessions
														and their output is sent to the model for
														processing. This may increase token usage and
														associated costs. Consider disabling hooks you
														don&apos;t need via{" "}
														<code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-xs">
															han-config.yml
														</code>
														.
													</p>
												</div>
											</div>
										</div>
									)}
								<div className="space-y-4">
									{plugin.hooks
										.sort((a, b) => {
											const indexA = hookLifecycleOrder.indexOf(a.section);
											const indexB = hookLifecycleOrder.indexOf(b.section);
											// If both hooks are in the lifecycle order, sort by that order
											if (indexA !== -1 && indexB !== -1) {
												return indexA - indexB;
											}
											// If only one is in the order, prioritize it
											if (indexA !== -1) return -1;
											if (indexB !== -1) return 1;
											// Otherwise maintain original order (alphabetical fallback)
											return a.section.localeCompare(b.section);
										})
										.map((hookSection) => (
											<div
												key={hookSection.section}
												className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
											>
												<div className="flex items-center space-x-3 mb-3">
													<div className="text-2xl">
														{hookEmojis[hookSection.section] || "🪝"}
													</div>
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
													{hookSection.commands.map((entry, idx) => (
														<HookCommandWithDetails
															key={`${entry.command}-${idx}`}
															command={entry.command}
															prompt={entry.prompt}
															timeout={entry.timeout}
															hanHooks={hanConfig?.hooks}
															pluginName={plugin.metadata.name}
															files={[...hookSection.files, ...scriptFiles]}
														/>
													))}
												</div>
												{hookSection.files.length > 0 &&
													!hookSection.commands.some((entry) =>
														hasInlineFileReferences(entry.command),
													) && (
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
