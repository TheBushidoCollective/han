/**
 * New tech layer category types
 */
export type PluginCategory =
	| "core"
	| "languages"
	| "frameworks"
	| "validation"
	| "tools"
	| "services"
	| "disciplines"
	| "patterns"
	| "specialized";

/**
 * Category metadata for display
 */
export const CATEGORY_META: Record<
	PluginCategory,
	{ icon: string; title: string; subtitle: string; description: string }
> = {
	core: {
		icon: "⛩️",
		title: "Core",
		subtitle: "Essential Infrastructure",
		description:
			"Essential infrastructure, skills, commands, and MCP servers for the Han marketplace.",
	},
	languages: {
		icon: "💬",
		title: "Languages",
		subtitle: "Programming Language Support",
		description:
			"Language-specific tooling, LSP integration, and syntax support.",
	},
	frameworks: {
		icon: "🏗️",
		title: "Frameworks",
		subtitle: "Framework Integrations",
		description: "Framework-specific patterns, components, and best practices.",
	},
	validation: {
		icon: "✅",
		title: "Validation",
		subtitle: "Code Quality Tools",
		description: "Linting, formatting, type checking, and quality enforcement.",
	},
	tools: {
		icon: "🔧",
		title: "Tools",
		subtitle: "Development Tools",
		description:
			"Build tools, package managers, testing frameworks, and utilities.",
	},
	services: {
		icon: "🌐",
		title: "Services",
		subtitle: "External Integrations",
		description:
			"MCP servers for external APIs, databases, and third-party services.",
	},
	disciplines: {
		icon: "🎓",
		title: "Disciplines",
		subtitle: "Development Specializations",
		description:
			"Specialized agents for frontend, backend, security, and more.",
	},
	patterns: {
		icon: "📐",
		title: "Patterns",
		subtitle: "Architectural Patterns",
		description: "Methodologies, workflows, and architectural best practices.",
	},
	specialized: {
		icon: "🔬",
		title: "Specialized",
		subtitle: "Niche Tools",
		description: "Domain-specific and specialized development tools.",
	},
};

/**
 * Category icon mapping
 */
export function getCategoryIcon(category: PluginCategory | string): string {
	if (category in CATEGORY_META) {
		return CATEGORY_META[category as PluginCategory].icon;
	}
	return "📦";
}

/**
 * All categories in display order
 */
export const CATEGORY_ORDER: PluginCategory[] = [
	"core",
	"languages",
	"frameworks",
	"validation",
	"tools",
	"services",
	"disciplines",
	"patterns",
	"specialized",
];
