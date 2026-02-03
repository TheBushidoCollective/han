import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Command } from "commander";
import { render } from "ink";
import React from "react";
import { PluginCreator } from "./plugin-creator.tsx";
import {
	type PluginConfig,
	type PluginType,
	getDoTemplate,
	getHashiTemplate,
	getJutsuTemplate,
	getTypePrefix,
} from "./templates/index.ts";

/**
 * Validate that the plugin name follows kebab-case conventions.
 */
function validatePluginName(name: string): string | null {
	if (!name.trim()) {
		return "Plugin name is required";
	}
	if (!/^[a-z][a-z0-9-]*$/.test(name)) {
		return "Name must be kebab-case (lowercase letters, numbers, hyphens)";
	}
	if (name.startsWith("-") || name.endsWith("-")) {
		return "Name cannot start or end with a hyphen";
	}
	if (name.includes("--")) {
		return "Name cannot contain consecutive hyphens";
	}
	return null;
}

/**
 * Normalize the plugin name to include the type prefix.
 */
function normalizePluginName(name: string, type: PluginType): string {
	const prefix = getTypePrefix(type);
	return name.startsWith(prefix) ? name : `${prefix}${name}`;
}

/**
 * Get the template files for a plugin type.
 */
function getTemplateFiles(config: PluginConfig): Record<string, string> {
	switch (config.type) {
		case "jutsu":
			return getJutsuTemplate(config);
		case "do":
			return getDoTemplate(config);
		case "hashi":
			return getHashiTemplate(config);
	}
}

/**
 * Create the plugin directory structure and files.
 */
function scaffoldPlugin(config: PluginConfig, outputDir: string): void {
	const pluginDir = join(outputDir, config.name);

	// Check if directory already exists
	if (existsSync(pluginDir)) {
		throw new Error(
			`Directory already exists: ${pluginDir}\nPlease choose a different name or remove the existing directory.`,
		);
	}

	// Get template files
	const files = getTemplateFiles(config);

	// Create directories and files
	for (const [relativePath, content] of Object.entries(files)) {
		const fullPath = join(pluginDir, relativePath);
		const dir = dirname(fullPath);

		// Create directory if it doesn't exist
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		// Write file
		writeFileSync(fullPath, content, "utf-8");
	}

	console.log(`\nPlugin created successfully: ${pluginDir}`);
	console.log("\nNext steps:");
	console.log(`  1. cd ${config.name}`);
	console.log("  2. Customize the generated files");
	console.log("  3. Run 'han plugin validate .' to verify the plugin structure");
	console.log("  4. Publish or share your plugin\n");
}

/**
 * Run the interactive plugin creator.
 */
async function runInteractive(
	outputDir: string,
	initialValues?: Partial<PluginConfig>,
): Promise<void> {
	return new Promise<void>((resolvePromise, rejectPromise) => {
		const { unmount, waitUntilExit } = render(
			React.createElement(PluginCreator, {
				onComplete: (config: PluginConfig) => {
					unmount();
					try {
						scaffoldPlugin(config, outputDir);
						resolvePromise();
					} catch (error) {
						rejectPromise(error);
					}
				},
				onCancel: () => {
					unmount();
					console.log("\nPlugin creation cancelled.");
					resolvePromise();
				},
				initialValues,
			}),
		);

		// Handle unexpected exit
		waitUntilExit().catch(rejectPromise);
	});
}

/**
 * Run the plugin creator in non-interactive mode.
 */
function runNonInteractive(
	options: {
		type: PluginType;
		name: string;
		description: string;
		author: string;
		authorUrl?: string;
	},
	outputDir: string,
): void {
	// Validate name
	const nameError = validatePluginName(options.name);
	if (nameError) {
		throw new Error(nameError);
	}

	const config: PluginConfig = {
		type: options.type,
		name: normalizePluginName(options.name, options.type),
		description: options.description,
		authorName: options.author,
		authorUrl: options.authorUrl || "",
	};

	scaffoldPlugin(config, outputDir);
}

/**
 * Register the `han create plugin` command.
 */
export function registerPluginCreate(createCommand: Command): void {
	createCommand
		.command("plugin")
		.description("Scaffold a new Han plugin with the correct structure")
		.option(
			"-t, --type <type>",
			"Plugin type: jutsu (skills/hooks), do (agents), or hashi (MCP server)",
		)
		.option("-n, --name <name>", "Plugin name (kebab-case)")
		.option("-d, --description <description>", "Plugin description")
		.option("-a, --author <author>", "Author name")
		.option("-u, --author-url <url>", "Author URL")
		.option(
			"-o, --output <path>",
			"Output directory (defaults to current directory)",
		)
		.addHelpText(
			"after",
			`
Examples:
  $ han create plugin
    Interactive mode - prompts for all options

  $ han create plugin --type jutsu --name my-linter --description "My linter" --author "Me"
    Non-interactive mode - creates jutsu-my-linter plugin

  $ han create plugin --type hashi --name my-api --output ./plugins
    Creates hashi-my-api plugin in ./plugins directory

Plugin Types:
  jutsu   Language/tool skills with validation hooks (linting, testing, formatting)
  do      Specialized agents for specific disciplines (architecture, security, etc.)
  hashi   MCP servers bridging external services (APIs, databases, etc.)
`,
		)
		.action(
			async (options: {
				type?: string;
				name?: string;
				description?: string;
				author?: string;
				authorUrl?: string;
				output?: string;
			}) => {
				try {
					const outputDir = resolve(options.output || process.cwd());

					// Check if all required options are provided for non-interactive mode
					const hasAllRequired =
						options.type && options.name && options.description && options.author;

					if (hasAllRequired && options.type && options.name && options.description && options.author) {
						// Validate type
						const validTypes = ["jutsu", "do", "hashi"];
						if (!validTypes.includes(options.type)) {
							console.error(
								`Error: Invalid plugin type "${options.type}". Must be one of: ${validTypes.join(", ")}`,
							);
							process.exit(1);
						}

						runNonInteractive(
							{
								type: options.type as PluginType,
								name: options.name,
								description: options.description,
								author: options.author,
								authorUrl: options.authorUrl,
							},
							outputDir,
						);
					} else {
						// Interactive mode
						// Pass any provided options as initial values
						const initialValues: Partial<PluginConfig> = {};
						if (options.type && ["jutsu", "do", "hashi"].includes(options.type)) {
							initialValues.type = options.type as PluginType;
						}
						if (options.name) {
							initialValues.name = options.name;
						}
						if (options.description) {
							initialValues.description = options.description;
						}
						if (options.author) {
							initialValues.authorName = options.author;
						}
						if (options.authorUrl) {
							initialValues.authorUrl = options.authorUrl;
						}

						await runInteractive(outputDir, initialValues);
					}

					process.exit(0);
				} catch (error: unknown) {
					console.error(
						"Error creating plugin:",
						error instanceof Error ? error.message : error,
					);
					process.exit(1);
				}
			},
		);
}
