import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { getCategoryIcon } from "./constants";

const PLUGINS_DIR = path.join(process.cwd(), "..");

export interface PluginMetadata {
	name: string;
	title: string;
	description: string;
	icon: string;
	kanji?: string;
	category: "core" | "jutsu" | "do" | "hashi";
}

export interface AgentMetadata {
	name: string;
	description: string;
	color?: string;
	model?: string;
	content: string;
}

export interface SkillMetadata {
	name: string;
	description: string;
	allowedTools?: string[];
	content: string;
}

export interface HookCommand {
	type: string;
	command?: string;
	prompt?: string;
	timeout?: number;
}

export interface HookFile {
	name: string;
	path: string;
	content: string;
}

export interface HookEntry {
	command: string;
	prompt?: string;
	timeout?: number;
}

export interface HookSection {
	section: string;
	commands: HookEntry[];
	files: HookFile[];
}

export interface CommandMetadata {
	name: string;
	description: string;
	content: string;
}

export interface MCPServerMetadata {
	name: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
}

interface Hook {
	type?: string;
	command?: string;
	prompt?: string;
	timeout?: number;
}

interface HookArray {
	hooks?: Hook[];
}

interface HooksData {
	hooks?: {
		[section: string]: HookArray[];
	};
}

export interface PluginDetails {
	metadata: PluginMetadata;
	source: string;
	readme: string | null;
	agents: AgentMetadata[];
	skills: SkillMetadata[];
	hooks: HookSection[];
	commands: CommandMetadata[];
	mcpServers: MCPServerMetadata[];
}

function getCategoryFromMarketplace(
	marketplaceCategory: string,
): "core" | "jutsu" | "do" | "hashi" {
	if (marketplaceCategory === "Core") return "core";
	if (marketplaceCategory === "Technique") return "jutsu";
	if (marketplaceCategory === "Discipline") return "do";
	if (marketplaceCategory === "Bridge") return "hashi";
	return "jutsu";
}

// Re-export getCategoryIcon from constants for convenience
export { getCategoryIcon } from "./constants";

/**
 * Titleize a string by capitalizing words and replacing hyphens with spaces
 */
function titleize(str: string): string {
	return str
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Strip the category prefix from a plugin name
 */
function stripPrefix(name: string, category: string): string {
	const prefix = `${category}-`;
	if (name.startsWith(prefix)) {
		return name.slice(prefix.length);
	}
	return name;
}

function getPluginMetadata(
	pluginPath: string,
	pluginName: string,
	category: "core" | "jutsu" | "do" | "hashi",
): PluginMetadata {
	try {
		const pluginJsonPath = path.join(
			pluginPath,
			".claude-plugin",
			"plugin.json",
		);
		const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, "utf-8"));

		// Strip prefix and titleize for display
		const strippedName = stripPrefix(pluginName, category);
		const displayTitle = titleize(strippedName);

		return {
			name: pluginName,
			title: displayTitle,
			description: pluginJson.description || "",
			icon: pluginJson.icon || getCategoryIcon(category),
			kanji: pluginJson.kanji,
			category,
		};
	} catch (error) {
		console.error(`Error reading plugin metadata for ${pluginName}:`, error);
		const strippedName = stripPrefix(pluginName, category);
		const displayTitle = titleize(strippedName);

		return {
			name: pluginName,
			title: displayTitle,
			description: "",
			icon: getCategoryIcon(category),
			category,
		};
	}
}

// Get all plugins across all categories from marketplace.json
export function getAllPluginsAcrossCategories(): Array<
	PluginMetadata & { source: string }
> {
	try {
		const marketplacePath = path.join(
			PLUGINS_DIR,
			".claude-plugin",
			"marketplace.json",
		);
		const marketplaceData = JSON.parse(
			fs.readFileSync(marketplacePath, "utf-8"),
		);

		const plugins: Array<PluginMetadata & { source: string }> = [];

		for (const plugin of marketplaceData.plugins) {
			const pluginCategory = getCategoryFromMarketplace(plugin.category);
			const pluginName = plugin.source.split("/").pop() || plugin.name;
			const pluginPath = path.join(
				PLUGINS_DIR,
				plugin.source.replace("./", ""),
			);
			const metadata = getPluginMetadata(
				pluginPath,
				pluginName,
				pluginCategory,
			);
			plugins.push({
				...metadata,
				source: plugin.source,
			});
		}

		return plugins.sort((a, b) => a.title.localeCompare(b.title));
	} catch (error) {
		console.error("Error reading all plugins:", error);
		return [];
	}
}

// Get all plugins in a category from marketplace.json
export function getAllPlugins(
	category: "core" | "jutsu" | "do" | "hashi",
): PluginMetadata[] {
	try {
		const marketplacePath = path.join(
			PLUGINS_DIR,
			".claude-plugin",
			"marketplace.json",
		);
		const marketplaceData = JSON.parse(
			fs.readFileSync(marketplacePath, "utf-8"),
		);

		const plugins: PluginMetadata[] = [];

		for (const plugin of marketplaceData.plugins) {
			const pluginCategory = getCategoryFromMarketplace(plugin.category);

			if (pluginCategory === category) {
				const pluginName = plugin.source.split("/").pop() || plugin.name;
				const pluginPath = path.join(
					PLUGINS_DIR,
					plugin.source.replace("./", ""),
				);
				plugins.push(getPluginMetadata(pluginPath, pluginName, category));
			}
		}

		return plugins.sort((a, b) => a.title.localeCompare(b.title));
	} catch (error) {
		console.error(`Error reading plugins from ${category}:`, error);
		return [];
	}
}

// Parse agents from a plugin
function getPluginAgents(pluginPath: string): AgentMetadata[] {
	const agents: AgentMetadata[] = [];
	const agentsDir = path.join(pluginPath, "agents");

	if (!fs.existsSync(agentsDir)) {
		return agents;
	}

	try {
		const agentFiles = fs
			.readdirSync(agentsDir)
			.filter((file) => file.endsWith(".md"));

		for (const file of agentFiles) {
			const filePath = path.join(agentsDir, file);
			const fileContent = fs.readFileSync(filePath, "utf-8");
			const { data, content } = matter(fileContent);

			agents.push({
				name: data.name || path.basename(file, ".md"),
				description: data.description || "",
				color: data.color,
				model: data.model,
				content,
			});
		}
	} catch (error) {
		console.error(`Error reading agents from ${pluginPath}:`, error);
	}

	return agents.sort((a, b) => a.name.localeCompare(b.name));
}

// Parse skills from a plugin
function getPluginSkills(pluginPath: string): SkillMetadata[] {
	const skills: SkillMetadata[] = [];
	const skillsDir = path.join(pluginPath, "skills");

	if (!fs.existsSync(skillsDir)) {
		return skills;
	}

	try {
		const skillDirs = fs.readdirSync(skillsDir).filter((file) => {
			const stat = fs.statSync(path.join(skillsDir, file));
			return stat.isDirectory();
		});

		for (const dir of skillDirs) {
			const skillFile = path.join(skillsDir, dir, "SKILL.md");
			if (!fs.existsSync(skillFile)) {
				continue;
			}

			const fileContent = fs.readFileSync(skillFile, "utf-8");
			const { data, content } = matter(fileContent);

			skills.push({
				name: data.name || dir,
				description: data.description || "",
				allowedTools: data["allowed-tools"],
				content,
			});
		}
	} catch (error) {
		console.error(`Error reading skills from ${pluginPath}:`, error);
	}

	return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// Parse hooks from a plugin
function getPluginHooks(pluginPath: string): HookSection[] {
	const hookSections: HookSection[] = [];
	const hooksFile = path.join(pluginPath, "hooks", "hooks.json");
	const hooksDir = path.join(pluginPath, "hooks");

	if (!fs.existsSync(hooksFile)) return hookSections;

	try {
		const hooksData = JSON.parse(
			fs.readFileSync(hooksFile, "utf-8"),
		) as HooksData;

		// Get all files in hooks folder (markdown, shell scripts, and js files)
		const allHookFiles: HookFile[] = [];
		if (fs.existsSync(hooksDir)) {
			const files = fs
				.readdirSync(hooksDir)
				.filter(
					(file) =>
						file.endsWith(".md") ||
						file.endsWith(".sh") ||
						file.endsWith(".js"),
				);

			for (const file of files) {
				const filePath = path.join(hooksDir, file);
				const content = fs.readFileSync(filePath, "utf-8");
				allHookFiles.push({
					name: path.basename(file, path.extname(file)),
					path: file,
					content,
				});
			}
		}

		// Get all files in scripts folder (shell scripts)
		const scriptsDir = path.join(pluginPath, "scripts");
		const allScriptFiles: HookFile[] = [];
		if (fs.existsSync(scriptsDir)) {
			const files = fs
				.readdirSync(scriptsDir)
				.filter((file) => file.endsWith(".sh") || file.endsWith(".js"));

			for (const file of files) {
				const filePath = path.join(scriptsDir, file);
				const content = fs.readFileSync(filePath, "utf-8");
				allScriptFiles.push({
					name: path.basename(file, path.extname(file)),
					path: `scripts/${file}`,
					content,
				});
			}
		}

		if (hooksData.hooks) {
			for (const [section, hookArrays] of Object.entries(hooksData.hooks)) {
				const commands: HookEntry[] = [];
				const referencedFiles: HookFile[] = [];

				// Each section contains an array of hook objects
				for (const hookArray of hookArrays) {
					if (hookArray.hooks) {
						for (const hook of hookArray.hooks) {
							// Handle both command and prompt type hooks
							if (hook.type === "command" && hook.command) {
								commands.push({
									command: hook.command,
									timeout: hook.timeout,
								});

								// Extract file references from commands
								// Pattern: cat "${CLAUDE_PLUGIN_ROOT}/hooks/file.md" or file.sh or file.js
								const fileMatch = hook.command.match(
									/hooks\/([a-zA-Z0-9_-]+\.(md|sh|js))/,
								);
								if (fileMatch) {
									const fileName = fileMatch[1];
									const hookFile = allHookFiles.find(
										(f) => f.path === fileName,
									);
									if (
										hookFile &&
										!referencedFiles.some((f) => f.path === fileName)
									) {
										referencedFiles.push(hookFile);
									}
								}

								// Pattern: scripts/file.sh
								const scriptMatch = hook.command.match(
									/scripts\/([a-zA-Z0-9_-]+\.(sh|js))/,
								);
								if (scriptMatch) {
									const scriptPath = `scripts/${scriptMatch[1]}`;
									const scriptFile = allScriptFiles.find(
										(f) => f.path === scriptPath,
									);
									if (
										scriptFile &&
										!referencedFiles.some((f) => f.path === scriptPath)
									) {
										referencedFiles.push(scriptFile);
									}
								}
							} else if (hook.type === "prompt" && hook.prompt) {
								// For prompt-based hooks, include the full prompt
								commands.push({
									command: `[Prompt-based Hook]`,
									prompt: hook.prompt,
									timeout: hook.timeout,
								});

								// Extract file references from prompt content
								// Pattern: hooks/file.md in the prompt text
								const mustReadMatches = hook.prompt.matchAll(
									/hooks\/([a-zA-Z0-9_-]+\.md)/g,
								);
								for (const match of mustReadMatches) {
									const fileName = match[1];
									const hookFile = allHookFiles.find(
										(f) => f.path === fileName,
									);
									if (
										hookFile &&
										!referencedFiles.some((f) => f.path === fileName)
									) {
										referencedFiles.push(hookFile);
									}
								}
							}
						}
					}
				}

				if (commands.length > 0) {
					hookSections.push({
						section,
						commands,
						files: referencedFiles,
					});
				}
			}
		}
	} catch (error) {
		console.error(`Error reading hooks from ${pluginPath}:`, error);
	}

	return hookSections;
}

// Parse commands from a plugin
function getPluginCommands(pluginPath: string): CommandMetadata[] {
	const commands: CommandMetadata[] = [];
	const commandsDir = path.join(pluginPath, "commands");

	if (!fs.existsSync(commandsDir)) {
		return commands;
	}

	try {
		const commandFiles = fs
			.readdirSync(commandsDir)
			.filter((file) => file.endsWith(".md"));

		for (const file of commandFiles) {
			const filePath = path.join(commandsDir, file);
			const fileContent = fs.readFileSync(filePath, "utf-8");
			const { data, content } = matter(fileContent);

			// Extract description from frontmatter or first paragraph after heading
			let description = data.description || "";
			if (!description) {
				const lines = content.split("\n");
				// Find first paragraph after the first heading
				let foundHeading = false;
				for (const line of lines) {
					if (line.startsWith("#")) {
						foundHeading = true;
						continue;
					}
					if (foundHeading && line.trim() && !line.startsWith("#")) {
						description = line.trim();
						break;
					}
				}
			}

			commands.push({
				name: path.basename(file, ".md"),
				description,
				content: fileContent,
			});
		}
	} catch (error) {
		console.error(`Error reading commands from ${pluginPath}:`, error);
	}

	return commands.sort((a, b) => a.name.localeCompare(b.name));
}

// Parse MCP servers from plugin.json
function getPluginMCPServers(pluginPath: string): MCPServerMetadata[] {
	const mcpServers: MCPServerMetadata[] = [];

	try {
		const pluginJsonPath = path.join(
			pluginPath,
			".claude-plugin",
			"plugin.json",
		);

		if (!fs.existsSync(pluginJsonPath)) {
			return mcpServers;
		}

		const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, "utf-8"));

		if (pluginJson.mcpServers && typeof pluginJson.mcpServers === "object") {
			for (const [name, config] of Object.entries(pluginJson.mcpServers)) {
				const serverConfig = config as {
					command: string;
					args?: string[];
					env?: Record<string, string>;
				};

				mcpServers.push({
					name,
					command: serverConfig.command,
					args: serverConfig.args || [],
					env: serverConfig.env,
				});
			}
		}
	} catch (error) {
		console.error(`Error reading MCP servers from ${pluginPath}:`, error);
	}

	return mcpServers.sort((a, b) => a.name.localeCompare(b.name));
}

// Read README.md from plugin directory
function getPluginReadme(pluginPath: string): string | null {
	try {
		const readmePath = path.join(pluginPath, "README.md");

		if (!fs.existsSync(readmePath)) {
			return null;
		}

		return fs.readFileSync(readmePath, "utf-8");
	} catch (error) {
		console.error(`Error reading README from ${pluginPath}:`, error);
		return null;
	}
}

// Get full plugin details with agents and skills
export function getPluginContent(
	category: "core" | "jutsu" | "do" | "hashi",
	slug: string,
): PluginDetails | null {
	try {
		const marketplacePath = path.join(
			PLUGINS_DIR,
			".claude-plugin",
			"marketplace.json",
		);
		const marketplaceData = JSON.parse(
			fs.readFileSync(marketplacePath, "utf-8"),
		);

		const plugin = marketplaceData.plugins.find(
			(p: { source: string; category: string }) => {
				const pluginName = p.source.split("/").pop();
				const pluginCategory = getCategoryFromMarketplace(p.category);
				return pluginName === slug && pluginCategory === category;
			},
		);

		if (!plugin) {
			return null;
		}

		const pluginPath = path.join(PLUGINS_DIR, plugin.source.replace("./", ""));
		const pluginName = plugin.source.split("/").pop() || slug;

		const metadata = getPluginMetadata(pluginPath, pluginName, category);
		const readme = getPluginReadme(pluginPath);
		const agents = getPluginAgents(pluginPath);
		const skills = getPluginSkills(pluginPath);
		const hooks = getPluginHooks(pluginPath);
		const commands = getPluginCommands(pluginPath);
		const mcpServers = getPluginMCPServers(pluginPath);

		return {
			metadata,
			source: plugin.source,
			readme,
			agents,
			skills,
			hooks,
			commands,
			mcpServers,
		};
	} catch (error) {
		console.error(
			`Error getting plugin content for ${category}/${slug}:`,
			error,
		);
		return null;
	}
}
