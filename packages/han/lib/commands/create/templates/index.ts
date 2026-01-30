/**
 * Template utilities for plugin scaffolding.
 *
 * This module provides template content and processing functions
 * for generating plugin file contents.
 */

export type PluginType = "jutsu" | "do" | "hashi";

export interface PluginConfig {
	name: string;
	type: PluginType;
	description: string;
	authorName: string;
	authorUrl: string;
}

/**
 * Process a template string by replacing placeholders with values.
 *
 * Placeholders use the format {{PLACEHOLDER_NAME}}.
 */
export function processTemplate(
	template: string,
	variables: Record<string, string>,
): string {
	let result = template;
	for (const [key, value] of Object.entries(variables)) {
		const placeholder = `{{${key}}}`;
		result = result.split(placeholder).join(value);
	}
	return result;
}

/**
 * Convert a kebab-case name to a human-readable title.
 * Example: "my-awesome-plugin" -> "My Awesome Plugin"
 */
export function toTitleCase(kebabCase: string): string {
	return kebabCase
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Get the prefix for a plugin type.
 */
export function getTypePrefix(type: PluginType): string {
	switch (type) {
		case "jutsu":
			return "jutsu-";
		case "do":
			return "do-";
		case "hashi":
			return "hashi-";
	}
}

/**
 * Get display name for plugin type.
 */
export function getTypeDisplayName(type: PluginType): string {
	switch (type) {
		case "jutsu":
			return "Jutsu (Technique)";
		case "do":
			return "Do (Discipline/Agent)";
		case "hashi":
			return "Hashi (Bridge/MCP Server)";
	}
}

/**
 * Get description for plugin type.
 */
export function getTypeDescription(type: PluginType): string {
	switch (type) {
		case "jutsu":
			return "Language/tool skills with validation hooks (linting, testing, formatting)";
		case "do":
			return "Specialized agents for specific disciplines (architecture, security, etc.)";
		case "hashi":
			return "MCP servers bridging external services (APIs, databases, etc.)";
	}
}

export { getJutsuTemplate } from "./jutsu.ts";
export { getDoTemplate } from "./do.ts";
export { getHashiTemplate } from "./hashi.ts";
