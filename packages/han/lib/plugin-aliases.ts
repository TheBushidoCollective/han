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
 * These paths MUST match the `source` field (minus ./) in marketplace.json.
 */
export const PLUGIN_ALIASES: Record<string, string> = {
  // disciplines
  'do-accessibility': 'disciplines/accessibility',
  'do-accessibility-engineering': 'disciplines/accessibility',
  'do-api': 'disciplines/api',
  'do-api-engineering': 'disciplines/api',
  'do-architecture': 'disciplines/architecture',
  'do-backend': 'disciplines/backend',
  'do-backend-development': 'disciplines/backend',
  'do-blockchain': 'disciplines/blockchain',
  'do-blockchain-development': 'disciplines/blockchain',
  'do-claude-plugin-development': 'disciplines/claude-plugin-development',
  'do-compiler-development': 'disciplines/compilers',
  'do-compilers': 'disciplines/compilers',
  'do-content': 'disciplines/content',
  'do-content-creator': 'disciplines/content',
  'do-data-engineering': 'disciplines/data-engineering',
  'do-database-engineering': 'disciplines/databases',
  'do-databases': 'disciplines/databases',
  'do-documentation': 'disciplines/documentation',
  'do-embedded': 'disciplines/embedded',
  'do-embedded-development': 'disciplines/embedded',
  'do-frontend': 'disciplines/frontend',
  'do-frontend-development': 'disciplines/frontend',
  'do-game-development': 'disciplines/games',
  'do-games': 'disciplines/games',
  'do-graphics': 'disciplines/graphics',
  'do-graphics-engineering': 'disciplines/graphics',
  'do-infrastructure': 'disciplines/infrastructure',
  'do-machine-learning': 'disciplines/machine-learning',
  'do-machine-learning-engineering': 'disciplines/machine-learning',
  'do-mobile': 'disciplines/mobile',
  'do-mobile-development': 'disciplines/mobile',
  'do-network-engineering': 'disciplines/networking',
  'do-networking': 'disciplines/networking',
  'do-observability': 'disciplines/observability',
  'do-observability-engineering': 'disciplines/observability',
  'do-performance': 'disciplines/performance',
  'do-performance-engineering': 'disciplines/performance',
  'do-platform': 'disciplines/platform',
  'do-platform-engineering': 'disciplines/platform',
  'do-plugin-development': 'disciplines/claude-plugin-development',
  'do-product': 'disciplines/product',
  'do-product-management': 'disciplines/product',
  'do-project-management': 'disciplines/project-management',
  'do-prompt-engineering': 'disciplines/prompts',
  'do-prompts': 'disciplines/prompts',
  'do-quality': 'disciplines/quality',
  'do-quality-assurance': 'disciplines/quality',
  'do-security': 'disciplines/security',
  'do-security-engineering': 'disciplines/security',
  'do-site-reliability-engineering': 'disciplines/sre',
  'do-sre': 'disciplines/sre',
  'do-technical-documentation': 'disciplines/documentation',
  'do-voip': 'disciplines/voip',
  'do-voip-engineering': 'disciplines/voip',

  // frameworks
  'jutsu-angular': 'frameworks/angular',
  'jutsu-django': 'frameworks/django',
  'jutsu-ecto': 'frameworks/ecto',
  'jutsu-effect': 'frameworks/effect',
  'jutsu-expo': 'frameworks/expo',
  'jutsu-fastapi': 'frameworks/fastapi',
  'jutsu-gluestack': 'frameworks/gluestack',
  'jutsu-ink': 'frameworks/ink',
  'jutsu-nestjs': 'frameworks/nestjs',
  'jutsu-nextjs': 'frameworks/nextjs',
  'jutsu-phoenix': 'frameworks/phoenix',
  'jutsu-rails': 'frameworks/rails',
  'jutsu-react': 'frameworks/react',
  'jutsu-react-native': 'frameworks/react-native',
  'jutsu-react-native-web': 'frameworks/react-native-web',
  'jutsu-relay': 'frameworks/relay',
  'jutsu-storybook': 'tools/storybook',
  'jutsu-vue': 'frameworks/vue',
  'jutsu-zustand': 'frameworks/zustand',

  // languages
  'jutsu-c': 'languages/c',
  'jutsu-cpp': 'languages/cpp',
  'jutsu-crystal': 'languages/crystal',
  'jutsu-csharp': 'languages/csharp',
  'jutsu-elixir': 'languages/elixir',
  'jutsu-erlang': 'languages/erlang',
  'jutsu-gleam': 'languages/gleam',
  'jutsu-go': 'languages/go',
  'jutsu-java': 'languages/java',
  'jutsu-kotlin': 'languages/kotlin',
  'jutsu-lua': 'languages/lua',
  'jutsu-nim': 'languages/nim',
  'jutsu-objective-c': 'languages/objective-c',
  'jutsu-php': 'languages/php',
  'jutsu-python': 'languages/python',
  'jutsu-ruby': 'languages/ruby',
  'jutsu-rust': 'languages/rust',
  'jutsu-scala': 'languages/scala',
  'jutsu-swift': 'languages/swift',
  'jutsu-typescript': 'languages/typescript',

  // patterns
  'jutsu-atomic-design': 'patterns/atomic-design',
  'jutsu-bdd': 'patterns/bdd',
  'jutsu-functional-programming': 'patterns/functional-programming',
  'jutsu-git-storytelling': 'patterns/git-storytelling',
  'jutsu-monorepo': 'patterns/monorepo',
  'jutsu-oop': 'patterns/oop',
  'jutsu-tdd': 'patterns/tdd',

  // tools (non-service MCP tools)
  'hashi-blueprints': 'tools/blueprints',
  blueprints: 'tools/blueprints',

  // bridges
  'hashi-opencode': 'bridges/opencode',
  'hashi-kiro': 'bridges/kiro',

  // services
  'hashi-agent-sop': 'services/agent-sop',
  'hashi-canva': 'services/canva',
  'hashi-clickup': 'services/clickup',
  'hashi-figma': 'services/figma',
  'hashi-github': 'services/github',
  'hashi-gitlab': 'services/gitlab',
  'hashi-jira': 'services/jira',
  'hashi-linear': 'services/linear',
  'hashi-notion': 'services/notion',
  'hashi-playwright-mcp': 'services/playwright-mcp',
  'hashi-reddit': 'services/reddit',
  'hashi-sentry': 'services/sentry',
  'hashi-sentry-mcp': 'services/sentry',

  // specialized
  'jutsu-android': 'specialized/android',
  'jutsu-claude-agent-sdk': 'specialized/claude-agent-sdk',
  'jutsu-fnox': 'specialized/fnox',
  'jutsu-han-plugins': 'specialized/han-plugins',
  'jutsu-ios': 'specialized/ios',
  'jutsu-notetaker': 'specialized/notetaker',
  'jutsu-runbooks': 'specialized/runbooks',
  'jutsu-scratch': 'specialized/scratch',
  'jutsu-sentry': 'specialized/sentry',
  'jutsu-sip': 'specialized/sip',
  'jutsu-tensorflow': 'specialized/tensorflow',

  // tools
  'jutsu-absinthe-graphql': 'tools/absinthe-graphql',
  'jutsu-act': 'tools/act',
  'jutsu-ansible': 'tools/ansible',
  'jutsu-apollo-graphql': 'tools/apollo-graphql',
  'jutsu-bun': 'tools/bun',
  'jutsu-cocoapods': 'tools/cocoapods',
  'jutsu-cucumber': 'tools/cucumber',
  'jutsu-cypress': 'tools/cypress',
  'jutsu-docker-compose': 'tools/docker-compose',
  'jutsu-esbuild': 'tools/esbuild',
  'jutsu-gitlab-ci': 'tools/gitlab-ci',
  'jutsu-graphql': 'tools/graphql',
  'jutsu-graphql-inspector': 'tools/graphql-inspector',
  'jutsu-helm': 'tools/helm',
  'jutsu-jest': 'tools/jest',
  'jutsu-junit': 'tools/junit',
  'jutsu-kubernetes': 'tools/kubernetes',
  'jutsu-kustomize': 'tools/kustomize',
  'jutsu-lerna': 'tools/lerna',
  'jutsu-maven': 'tools/maven',
  'jutsu-mise': 'tools/mise',
  'jutsu-mocha': 'tools/mocha',
  'jutsu-npm': 'tools/npm',
  'jutsu-playwright': 'tools/playwright',
  'jutsu-playwright-bdd': 'tools/playwright-bdd',
  'jutsu-pulumi': 'tools/pulumi',
  'jutsu-pytest': 'tools/pytest',
  'jutsu-rollup': 'tools/rollup',
  'jutsu-rspec': 'tools/rspec',
  'jutsu-syncpack': 'tools/syncpack',
  'jutsu-tailwind': 'tools/tailwind',
  'jutsu-terraform': 'tools/terraform',
  'jutsu-testng': 'tools/testng',
  'jutsu-vite': 'tools/vite',
  'jutsu-vitest': 'tools/vitest',
  'jutsu-webpack': 'tools/webpack',
  'jutsu-yarn': 'tools/yarn',

  // validation
  'jutsu-ameba': 'validation/ameba',
  'jutsu-biome': 'validation/biome',
  'jutsu-checkstyle': 'validation/checkstyle',
  'jutsu-clippy': 'validation/clippy',
  'jutsu-credo': 'validation/credo',
  'jutsu-dialyzer': 'validation/dialyzer',
  'jutsu-eslint': 'validation/eslint',
  'jutsu-markdown': 'validation/markdown',
  'jutsu-prettier': 'validation/prettier',
  'jutsu-pylint': 'validation/pylint',
  'jutsu-rubocop': 'validation/rubocop',
  'jutsu-shellcheck': 'validation/shellcheck',
  'jutsu-shfmt': 'validation/shfmt',
};

/**
 * Reverse mapping from new paths to old names.
 * Computed once at module load time for efficient lookups.
 */
export const REVERSE_ALIASES: Record<string, string> = Object.entries(
  PLUGIN_ALIASES
).reduce(
  (acc, [oldName, newPath]) => {
    acc[newPath] = oldName;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Short name aliases - maps simple names to their old full names.
 * E.g., "typescript" -> "jutsu-typescript"
 */
export const SHORT_NAME_ALIASES: Record<string, string> = Object.keys(
  PLUGIN_ALIASES
).reduce(
  (acc, oldName) => {
    // Extract short name by removing prefix
    let shortName: string;
    if (oldName.startsWith('jutsu-')) {
      shortName = oldName.slice(6); // Remove "jutsu-"
    } else if (oldName.startsWith('do-')) {
      shortName = oldName.slice(3); // Remove "do-"
    } else if (oldName.startsWith('hashi-')) {
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
  {} as Record<string, string>
);

/**
 * Check if a plugin name uses deprecated old naming (jutsu-*, hashi-*, do-*).
 *
 * @param input - The plugin name to check
 * @returns True if the input uses deprecated naming
 */
export function isDeprecatedPluginName(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return (
    normalized.startsWith('jutsu-') ||
    normalized.startsWith('hashi-') ||
    normalized.startsWith('do-')
  );
}

/**
 * Get the short name from any plugin input format.
 *
 * Accepts:
 * - Short names: "typescript" -> "typescript"
 * - New paths: "languages/typescript" -> "typescript"
 * - Old names: "jutsu-typescript" -> "typescript" (extracts short name)
 *
 * @param input - The plugin name in any format
 * @returns The short name (e.g., "typescript")
 */
export function getShortPluginName(input: string): string {
  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase();

  // Handle empty input
  if (normalized === '') {
    return trimmed;
  }

  // Special case: core plugins
  if (normalized === 'core' || normalized === 'bushido') {
    return normalized;
  }

  // If it's a path format (category/name), extract the name
  if (normalized.includes('/')) {
    const parts = normalized.split('/');
    return parts[parts.length - 1];
  }

  // If it's an old name, extract the short name
  if (normalized.startsWith('jutsu-')) {
    return normalized.slice(6);
  }
  if (normalized.startsWith('hashi-')) {
    return normalized.slice(6);
  }
  if (normalized.startsWith('do-')) {
    return normalized.slice(3);
  }

  // Already a short name
  return normalized;
}

/**
 * Resolve a plugin name to its canonical short form.
 *
 * Accepts:
 * - Short names: "typescript" -> "typescript"
 * - New paths: "languages/typescript" -> "typescript"
 *
 * REJECTS (returns null):
 * - Old full names: "jutsu-typescript" -> null (deprecated)
 *
 * @param input - The plugin name to resolve
 * @returns The canonical short name, or null if using deprecated naming
 */
export function resolvePluginNameStrict(
  input: string
): { name: string; path: string } | null {
  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase();

  // Handle empty input
  if (normalized === '') {
    return null;
  }

  // REJECT deprecated old naming
  if (isDeprecatedPluginName(normalized)) {
    return null;
  }

  // Special case: core plugins
  if (normalized === 'core') {
    return { name: 'core', path: 'core/core' };
  }
  if (normalized === 'bushido') {
    return { name: 'bushido', path: 'core/bushido' };
  }

  // Check if it's a path format (category/name)
  if (normalized.includes('/')) {
    // Validate it's a known path
    if (REVERSE_ALIASES[normalized]) {
      const shortName = normalized.split('/').pop() || normalized;
      return { name: shortName, path: normalized };
    }
    // Unknown path - might be valid new plugin
    const shortName = normalized.split('/').pop() || normalized;
    return { name: shortName, path: normalized };
  }

  // Check if it's a known short name
  if (SHORT_NAME_ALIASES[normalized]) {
    const oldName = SHORT_NAME_ALIASES[normalized];
    const path = PLUGIN_ALIASES[oldName];
    return { name: normalized, path };
  }

  // Unknown short name - might be valid new plugin
  return { name: normalized, path: normalized };
}

/**
 * Resolve a plugin name to its canonical form (LEGACY - for backwards compatibility).
 *
 * Accepts:
 * - Old full names: "jutsu-typescript" -> "jutsu-typescript" (current canonical)
 * - Short names: "typescript" -> "jutsu-typescript"
 * - New paths: "languages/typescript" -> "jutsu-typescript" (resolved via reverse alias)
 *
 * Returns the old (currently canonical) plugin name for marketplace validation.
 *
 * @deprecated Use resolvePluginNameStrict for new code
 * @param input - The plugin name to resolve (any supported format)
 * @returns The canonical plugin name (old format like "jutsu-typescript")
 */
export function resolvePluginName(input: string): string {
  // Normalize input
  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase();

  // Handle empty input
  if (normalized === '') {
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
  if (normalized === 'core' || normalized === 'bushido') {
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
    normalized === 'core' ||
    normalized === 'bushido' ||
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
    const category = path.split('/')[0];
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

/**
 * Result of strict plugin name resolution.
 */
export interface StrictResolveResult {
  /** Successfully resolved plugins with their short names and paths */
  resolved: Array<{ input: string; name: string; path: string }>;
  /** Inputs that used deprecated naming (jutsu-*, hashi-*, do-*) */
  deprecated: string[];
}

/**
 * Resolve multiple plugin names strictly, rejecting deprecated naming.
 *
 * @param inputs - Array of plugin names
 * @returns Object with resolved plugins and list of deprecated inputs
 */
export function resolvePluginNamesStrict(
  inputs: string[]
): StrictResolveResult {
  const resolved: Array<{ input: string; name: string; path: string }> = [];
  const deprecated: string[] = [];

  for (const input of inputs) {
    if (isDeprecatedPluginName(input)) {
      deprecated.push(input);
    } else {
      const result = resolvePluginNameStrict(input);
      if (result) {
        resolved.push({ input, ...result });
      }
    }
  }

  return { resolved, deprecated };
}
