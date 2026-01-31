/**
 * Plugin Alias Resolution System
 *
 * Maps old plugin names (e.g., `jutsu-typescript`) to new organizational paths
 * (e.g., `languages/typescript`). This provides backwards compatibility for
 * existing installations while enabling a cleaner plugin organization.
 *
 * The alias system supports:
 * 1. Old full names: `jutsu-typescript` -> `languages/typescript`
 * 2. Short names: `typescript` -> `languages/typescript`
 * 3. New paths: `languages/typescript` (passthrough)
 */

/**
 * Complete mapping of old plugin names to new organizational paths.
 * Format: { "old-name": "category/short-name" }
 *
 * Categories:
 * - languages: Programming language support (jutsu-typescript, jutsu-python, etc.)
 * - frameworks: Frameworks and libraries (jutsu-react, jutsu-nextjs, etc.)
 * - tools: Developer tools (jutsu-biome, jutsu-eslint, etc.)
 * - testing: Testing frameworks and methodologies (jutsu-jest, jutsu-bdd, etc.)
 * - infrastructure: DevOps and infrastructure (jutsu-kubernetes, jutsu-terraform, etc.)
 * - disciplines: Specialized roles (do-*)
 * - integrations: External service integrations (hashi-*)
 */
export const PLUGIN_ALIASES: Record<string, string> = {
	// ============================================
	// Languages (programming language support)
	// ============================================
	"jutsu-c": "languages/c",
	"jutsu-cpp": "languages/cpp",
	"jutsu-csharp": "languages/csharp",
	"jutsu-crystal": "languages/crystal",
	"jutsu-elixir": "languages/elixir",
	"jutsu-erlang": "languages/erlang",
	"jutsu-gleam": "languages/gleam",
	"jutsu-go": "languages/go",
	"jutsu-java": "languages/java",
	"jutsu-kotlin": "languages/kotlin",
	"jutsu-lua": "languages/lua",
	"jutsu-nim": "languages/nim",
	"jutsu-objective-c": "languages/objective-c",
	"jutsu-php": "languages/php",
	"jutsu-python": "languages/python",
	"jutsu-ruby": "languages/ruby",
	"jutsu-rust": "languages/rust",
	"jutsu-scala": "languages/scala",
	"jutsu-swift": "languages/swift",
	"jutsu-typescript": "languages/typescript",

	// ============================================
	// Frameworks (web, mobile, backend frameworks)
	// ============================================
	"jutsu-angular": "frameworks/angular",
	"jutsu-django": "frameworks/django",
	"jutsu-expo": "frameworks/expo",
	"jutsu-fastapi": "frameworks/fastapi",
	"jutsu-gluestack": "frameworks/gluestack",
	"jutsu-ink": "frameworks/ink",
	"jutsu-nestjs": "frameworks/nestjs",
	"jutsu-nextjs": "frameworks/nextjs",
	"jutsu-phoenix": "frameworks/phoenix",
	"jutsu-rails": "frameworks/rails",
	"jutsu-react": "frameworks/react",
	"jutsu-react-native": "frameworks/react-native",
	"jutsu-react-native-web": "frameworks/react-native-web",
	"jutsu-storybook": "frameworks/storybook",
	"jutsu-vue": "frameworks/vue",
	"jutsu-zustand": "frameworks/zustand",

	// ============================================
	// GraphQL-related
	// ============================================
	"jutsu-absinthe-graphql": "graphql/absinthe-graphql",
	"jutsu-apollo-graphql": "graphql/apollo-graphql",
	"jutsu-graphql": "graphql/graphql",
	"jutsu-graphql-inspector": "graphql/graphql-inspector",
	"jutsu-relay": "graphql/relay",

	// ============================================
	// Tools (linters, formatters, build tools)
	// ============================================
	"jutsu-ameba": "tools/ameba",
	"jutsu-biome": "tools/biome",
	"jutsu-checkstyle": "tools/checkstyle",
	"jutsu-clippy": "tools/clippy",
	"jutsu-credo": "tools/credo",
	"jutsu-dialyzer": "tools/dialyzer",
	"jutsu-esbuild": "tools/esbuild",
	"jutsu-eslint": "tools/eslint",
	"jutsu-fnox": "tools/fnox",
	"jutsu-markdown": "tools/markdown",
	"jutsu-mise": "tools/mise",
	"jutsu-prettier": "tools/prettier",
	"jutsu-pylint": "tools/pylint",
	"jutsu-rollup": "tools/rollup",
	"jutsu-rubocop": "tools/rubocop",
	"jutsu-shellcheck": "tools/shellcheck",
	"jutsu-shfmt": "tools/shfmt",
	"jutsu-syncpack": "tools/syncpack",
	"jutsu-tailwind": "tools/tailwind",
	"jutsu-vite": "tools/vite",
	"jutsu-webpack": "tools/webpack",

	// ============================================
	// Testing (test frameworks and methodologies)
	// ============================================
	"jutsu-bdd": "testing/bdd",
	"jutsu-cucumber": "testing/cucumber",
	"jutsu-cypress": "testing/cypress",
	"jutsu-jest": "testing/jest",
	"jutsu-junit": "testing/junit",
	"jutsu-mocha": "testing/mocha",
	"jutsu-playwright": "testing/playwright",
	"jutsu-playwright-bdd": "testing/playwright-bdd",
	"jutsu-pytest": "testing/pytest",
	"jutsu-rspec": "testing/rspec",
	"jutsu-tdd": "testing/tdd",
	"jutsu-testng": "testing/testng",
	"jutsu-vitest": "testing/vitest",

	// ============================================
	// Infrastructure (DevOps, containers, cloud)
	// ============================================
	"jutsu-act": "infrastructure/act",
	"jutsu-ansible": "infrastructure/ansible",
	"jutsu-docker-compose": "infrastructure/docker-compose",
	"jutsu-gitlab-ci": "infrastructure/gitlab-ci",
	"jutsu-helm": "infrastructure/helm",
	"jutsu-kubernetes": "infrastructure/kubernetes",
	"jutsu-kustomize": "infrastructure/kustomize",
	"jutsu-pulumi": "infrastructure/pulumi",
	"jutsu-terraform": "infrastructure/terraform",

	// ============================================
	// Mobile Development
	// ============================================
	"jutsu-android": "mobile/android",
	"jutsu-cocoapods": "mobile/cocoapods",
	"jutsu-ios": "mobile/ios",

	// ============================================
	// Package Managers
	// ============================================
	"jutsu-bun": "package-managers/bun",
	"jutsu-lerna": "package-managers/lerna",
	"jutsu-maven": "package-managers/maven",
	"jutsu-npm": "package-managers/npm",
	"jutsu-yarn": "package-managers/yarn",

	// ============================================
	// Methodologies and Patterns
	// ============================================
	"jutsu-atomic-design": "methodologies/atomic-design",
	"jutsu-functional-programming": "methodologies/functional-programming",
	"jutsu-monorepo": "methodologies/monorepo",
	"jutsu-oop": "methodologies/oop",

	// ============================================
	// Data and Database
	// ============================================
	"jutsu-ecto": "data/ecto",
	"jutsu-tensorflow": "data/tensorflow",

	// ============================================
	// Specialized Tools
	// ============================================
	"jutsu-ai-dlc": "specialized/ai-dlc",
	"jutsu-claude-agent-sdk": "specialized/claude-agent-sdk",
	"jutsu-effect": "specialized/effect",
	"jutsu-git-storytelling": "specialized/git-storytelling",
	"jutsu-han-plugins": "specialized/han-plugins",
	"jutsu-notetaker": "specialized/notetaker",
	"jutsu-runbooks": "specialized/runbooks",
	"jutsu-scratch": "specialized/scratch",
	"jutsu-sentry": "specialized/sentry",
	"jutsu-sip": "specialized/sip",

	// ============================================
	// Disciplines (do-* plugins)
	// ============================================
	"do-accessibility-engineering": "disciplines/accessibility-engineering",
	"do-api-engineering": "disciplines/api-engineering",
	"do-architecture": "disciplines/architecture",
	"do-backend-development": "disciplines/backend-development",
	"do-blockchain-development": "disciplines/blockchain-development",
	"do-claude-plugin-development": "disciplines/claude-plugin-development",
	"do-compiler-development": "disciplines/compiler-development",
	"do-content-creator": "disciplines/content-creator",
	"do-data-engineering": "disciplines/data-engineering",
	"do-database-engineering": "disciplines/database-engineering",
	"do-embedded-development": "disciplines/embedded-development",
	"do-frontend-development": "disciplines/frontend-development",
	"do-game-development": "disciplines/game-development",
	"do-graphics-engineering": "disciplines/graphics-engineering",
	"do-infrastructure": "disciplines/infrastructure",
	"do-machine-learning-engineering": "disciplines/machine-learning-engineering",
	"do-mobile-development": "disciplines/mobile-development",
	"do-network-engineering": "disciplines/network-engineering",
	"do-observability-engineering": "disciplines/observability-engineering",
	"do-performance-engineering": "disciplines/performance-engineering",
	"do-platform-engineering": "disciplines/platform-engineering",
	"do-product-management": "disciplines/product-management",
	"do-project-management": "disciplines/project-management",
	"do-prompt-engineering": "disciplines/prompt-engineering",
	"do-quality-assurance": "disciplines/quality-assurance",
	"do-security-engineering": "disciplines/security-engineering",
	"do-site-reliability-engineering": "disciplines/site-reliability-engineering",
	"do-technical-documentation": "disciplines/technical-documentation",
	"do-voip-engineering": "disciplines/voip-engineering",

	// ============================================
	// Integrations (hashi-* plugins)
	// ============================================
	"hashi-agent-sop": "integrations/agent-sop",
	"hashi-blueprints": "integrations/blueprints",
	"hashi-clickup": "integrations/clickup",
	"hashi-figma": "integrations/figma",
	"hashi-github": "integrations/github",
	"hashi-gitlab": "integrations/gitlab",
	"hashi-jira": "integrations/jira",
	"hashi-linear": "integrations/linear",
	"hashi-notion": "integrations/notion",
	"hashi-playwright-mcp": "integrations/playwright-mcp",
	"hashi-reddit": "integrations/reddit",
	"hashi-sentry": "integrations/sentry",
};

/**
 * Reverse mapping from new paths to old names.
 * Computed once at module load time for efficient lookups.
 */
export const REVERSE_ALIASES: Record<string, string> = Object.entries(
	PLUGIN_ALIASES,
).reduce(
	(acc, [oldName, newPath]) => {
		acc[newPath] = oldName;
		return acc;
	},
	{} as Record<string, string>,
);

/**
 * Short name aliases - maps simple names to their old full names.
 * E.g., "typescript" -> "jutsu-typescript"
 */
export const SHORT_NAME_ALIASES: Record<string, string> = Object.keys(
	PLUGIN_ALIASES,
).reduce(
	(acc, oldName) => {
		// Extract short name by removing prefix
		let shortName: string;
		if (oldName.startsWith("jutsu-")) {
			shortName = oldName.slice(6); // Remove "jutsu-"
		} else if (oldName.startsWith("do-")) {
			shortName = oldName.slice(3); // Remove "do-"
		} else if (oldName.startsWith("hashi-")) {
			shortName = oldName.slice(6); // Remove "hashi-"
		} else {
			return acc;
		}

		// Only add if it doesn't create a conflict
		if (!acc[shortName]) {
			acc[shortName] = oldName;
		}
		return acc;
	},
	{} as Record<string, string>,
);

/**
 * Resolve a plugin name to its canonical form.
 *
 * Accepts:
 * - Old full names: "jutsu-typescript" -> "jutsu-typescript" (current canonical)
 * - Short names: "typescript" -> "jutsu-typescript"
 * - New paths: "languages/typescript" -> "jutsu-typescript" (resolved via reverse alias)
 *
 * Returns the old (currently canonical) plugin name for marketplace validation.
 *
 * @param input - The plugin name to resolve (any supported format)
 * @returns The canonical plugin name (old format like "jutsu-typescript")
 */
export function resolvePluginName(input: string): string {
	// Normalize input
	const trimmed = input.trim();
	const normalized = trimmed.toLowerCase();

	// Handle empty input
	if (normalized === "") {
		return trimmed;
	}

	// 1. Check if it's already a known old name (exact match)
	if (PLUGIN_ALIASES[normalized]) {
		return normalized;
	}

	// 2. Check if it's a new path format (category/name)
	if (REVERSE_ALIASES[normalized]) {
		return REVERSE_ALIASES[normalized];
	}

	// 3. Check if it's a short name
	if (SHORT_NAME_ALIASES[normalized]) {
		return SHORT_NAME_ALIASES[normalized];
	}

	// 4. Special case: core plugins that don't have aliases
	if (normalized === "core" || normalized === "bushido") {
		return normalized;
	}

	// 5. Return trimmed input (might be a new plugin not yet in aliases)
	return trimmed;
}

/**
 * Get the new organizational path for a plugin.
 *
 * @param oldName - The old plugin name (e.g., "jutsu-typescript")
 * @returns The new path (e.g., "languages/typescript") or undefined if not found
 */
export function getNewPluginPath(oldName: string): string | undefined {
	return PLUGIN_ALIASES[oldName.toLowerCase()];
}

/**
 * Get the old plugin name from a new path.
 *
 * @param newPath - The new path (e.g., "languages/typescript")
 * @returns The old name (e.g., "jutsu-typescript") or undefined if not found
 */
export function getOldPluginName(newPath: string): string | undefined {
	return REVERSE_ALIASES[newPath.toLowerCase()];
}

/**
 * Check if a plugin name is a known alias (old name, short name, or new path).
 *
 * @param name - The name to check
 * @returns True if the name is recognized in any format
 */
export function isKnownPlugin(name: string): boolean {
	const normalized = name.trim().toLowerCase();
	return (
		normalized === "core" ||
		normalized === "bushido" ||
		normalized in PLUGIN_ALIASES ||
		normalized in REVERSE_ALIASES ||
		normalized in SHORT_NAME_ALIASES
	);
}

/**
 * Get all known plugin categories.
 *
 * @returns Array of category names (e.g., ["languages", "frameworks", ...])
 */
export function getPluginCategories(): string[] {
	const categories = new Set<string>();
	for (const path of Object.values(PLUGIN_ALIASES)) {
		const category = path.split("/")[0];
		categories.add(category);
	}
	return Array.from(categories).sort();
}

/**
 * Get all plugins in a category.
 *
 * @param category - The category name (e.g., "languages")
 * @returns Array of old plugin names in that category
 */
export function getPluginsInCategory(category: string): string[] {
	const normalizedCategory = category.toLowerCase();
	return Object.entries(PLUGIN_ALIASES)
		.filter(([_, path]) => path.startsWith(`${normalizedCategory}/`))
		.map(([oldName]) => oldName)
		.sort();
}

/**
 * Resolve multiple plugin names at once.
 *
 * @param inputs - Array of plugin names in any format
 * @returns Array of canonical plugin names
 */
export function resolvePluginNames(inputs: string[]): string[] {
	return inputs.map(resolvePluginName);
}
