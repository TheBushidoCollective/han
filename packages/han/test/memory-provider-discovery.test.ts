/**
 * Tests for Memory Provider Discovery
 *
 * Tests the convention-based plugin memory provider discovery system.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Store original environment - MUST save CLAUDE_CONFIG_DIR specifically
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

let testDir: string;
let configDir: string;

// Track plugins/marketplaces for settings.json generation
let installedPlugins: Map<string, string>;
let installedMarketplaces: Map<
	string,
	{ source?: { source: string; path?: string } }
>;

// Import provider-discovery (no mocking needed - uses env vars and real files)
import {
	discoverProviders,
	loadAllProviders,
	loadProviderScript,
	type MCPClient,
} from "../lib/memory/provider-discovery.ts";

function writeSettingsJson(): void {
	// Convert plugins map to enabledPlugins format
	// Key format MUST be "pluginName@marketplace" per claude-settings.ts line 127
	const enabledPlugins: Record<string, boolean> = {};
	for (const [pluginName, marketplace] of installedPlugins) {
		enabledPlugins[`${pluginName}@${marketplace}`] = true;
	}

	// Convert marketplaces map to extraKnownMarketplaces format
	const extraKnownMarketplaces: Record<
		string,
		{ source?: { source: string; path?: string } }
	> = {};
	for (const [name, config] of installedMarketplaces) {
		extraKnownMarketplaces[name] = config;
	}

	const settings = {
		enabledPlugins,
		extraKnownMarketplaces,
	};

	writeFileSync(
		join(configDir, "settings.json"),
		JSON.stringify(settings, null, 2),
	);
}

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(
		tmpdir(),
		`han-provider-discovery-test-${Date.now()}-${random}`,
	);
	configDir = join(testDir, "claude-config");
	mkdirSync(configDir, { recursive: true });

	// Set environment variable for config dir
	process.env.CLAUDE_CONFIG_DIR = configDir;

	// Reset tracking maps
	installedPlugins = new Map();
	installedMarketplaces = new Map();

	// Write initial empty settings
	writeSettingsJson();
}

function teardown(): void {
	// Restore CLAUDE_CONFIG_DIR to original value
	if (originalClaudeConfigDir !== undefined) {
		process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
	} else {
		delete process.env.CLAUDE_CONFIG_DIR;
	}

	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

/**
 * Create a test plugin with memory config
 */
function createTestPlugin(
	pluginName: string,
	marketplaceName: string,
	options: {
		allowedTools?: string[];
		systemPrompt?: string;
		createScript?: boolean;
		category?: string;
	} = {},
): string {
	const {
		allowedTools = ["mcp__test__tool"],
		systemPrompt,
		createScript = true,
		category = "hashi",
	} = options;

	// Create marketplace directory structure
	const marketplaceRoot = join(
		configDir,
		"plugins",
		"marketplaces",
		marketplaceName,
	);
	const pluginRoot = join(marketplaceRoot, category, pluginName);
	mkdirSync(pluginRoot, { recursive: true });

	// Create han-plugin.yml with memory config
	const yamlContent = `hooks: {}
memory:
  allowed_tools:
${allowedTools.map((t) => `    - ${t}`).join("\n")}
${systemPrompt ? `  system_prompt: |\n    ${systemPrompt.split("\n").join("\n    ")}` : ""}
`;
	writeFileSync(join(pluginRoot, "han-plugin.yml"), yamlContent);

	// Create memory-provider.ts script
	if (createScript) {
		const scriptContent = `
export function createProvider(mcpClient, availableTools) {
  return {
    name: "${pluginName.replace(/^(jutsu|do|hashi)-/, "")}",
    isAvailable: async () => true,
    extract: async () => [],
  };
}
`;
		writeFileSync(join(pluginRoot, "memory-provider.ts"), scriptContent);
	}

	// Register plugin in tracking maps and update settings.json
	installedPlugins.set(pluginName, marketplaceName);
	if (!installedMarketplaces.has(marketplaceName)) {
		installedMarketplaces.set(marketplaceName, {});
	}
	writeSettingsJson();

	return pluginRoot;
}

describe.serial("Memory Provider Discovery", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("discoverProviders", () => {
		test("returns empty array when no plugins installed", async () => {
			const providers = await discoverProviders();
			expect(providers).toEqual([]);
		});

		test("returns empty array when config dir is null", async () => {
			// Temporarily unset config dir
			delete process.env.CLAUDE_CONFIG_DIR;

			const providers = await discoverProviders();
			expect(providers).toEqual([]);

			// Restore for cleanup
			process.env.CLAUDE_CONFIG_DIR = configDir;
		});

		test("discovers plugin with memory config", async () => {
			createTestPlugin("hashi-github", "han");

			const providers = await discoverProviders();

			expect(providers).toHaveLength(1);
			expect(providers[0].name).toBe("github");
			expect(providers[0].pluginName).toBe("hashi-github");
			expect(providers[0].allowedTools).toContain("mcp__test__tool");
		});

		test("derives provider name from plugin name (strips prefix)", async () => {
			createTestPlugin("hashi-github", "han");
			createTestPlugin("jutsu-git", "han", { category: "jutsu" });
			createTestPlugin("do-code-review", "han", { category: "do" });

			const providers = await discoverProviders();

			const names = providers.map((p) => p.name);
			expect(names).toContain("github");
			expect(names).toContain("git");
			expect(names).toContain("code-review");
		});

		test("includes system prompt when configured", async () => {
			createTestPlugin("hashi-github", "han", {
				systemPrompt: "Extract PR data as JSON",
			});

			const providers = await discoverProviders();

			expect(providers[0].systemPrompt).toContain("Extract PR data");
		});

		test("skips plugins without memory config", async () => {
			// Create plugin without memory config
			const marketplaceRoot = join(configDir, "plugins", "marketplaces", "han");
			const pluginRoot = join(marketplaceRoot, "jutsu", "jutsu-biome");
			mkdirSync(pluginRoot, { recursive: true });

			writeFileSync(
				join(pluginRoot, "han-plugin.yml"),
				`hooks:
  lint:
    command: npx biome check
`,
			);

			installedPlugins.set("jutsu-biome", "han");
			installedMarketplaces.set("han", {});
			writeSettingsJson();

			const providers = await discoverProviders();

			expect(providers).toHaveLength(0);
		});

		test("skips plugins with empty allowed_tools", async () => {
			const marketplaceRoot = join(configDir, "plugins", "marketplaces", "han");
			const pluginRoot = join(marketplaceRoot, "hashi", "hashi-empty");
			mkdirSync(pluginRoot, { recursive: true });

			writeFileSync(
				join(pluginRoot, "han-plugin.yml"),
				`hooks: {}
memory:
  allowed_tools: []
`,
			);
			writeFileSync(
				join(pluginRoot, "memory-provider.ts"),
				"export function createProvider() {}",
			);

			installedPlugins.set("hashi-empty", "han");
			installedMarketplaces.set("han", {});
			writeSettingsJson();

			const providers = await discoverProviders();

			expect(providers).toHaveLength(0);
		});

		test("skips plugins without memory-provider.ts script", async () => {
			createTestPlugin("hashi-no-script", "han", { createScript: false });

			const providers = await discoverProviders();

			expect(providers).toHaveLength(0);
		});

		test("discovers multiple plugins", async () => {
			createTestPlugin("hashi-github", "han", {
				allowedTools: ["mcp__github__list_prs"],
			});
			createTestPlugin("hashi-linear", "han", {
				allowedTools: ["mcp__linear__list_issues"],
			});
			createTestPlugin("jutsu-git", "han", {
				allowedTools: ["mcp__git__log"],
				category: "jutsu",
			});

			const providers = await discoverProviders();

			expect(providers).toHaveLength(3);
		});

		test("handles directory source for marketplace", async () => {
			// Create marketplace with directory source
			const customMarketplaceDir = join(testDir, "custom-marketplace");
			const pluginRoot = join(customMarketplaceDir, "hashi", "hashi-custom");
			mkdirSync(pluginRoot, { recursive: true });

			writeFileSync(
				join(pluginRoot, "han-plugin.yml"),
				`hooks: {}
memory:
  allowed_tools:
    - mcp__custom__tool
`,
			);
			writeFileSync(
				join(pluginRoot, "memory-provider.ts"),
				"export function createProvider() {}",
			);

			installedPlugins.set("hashi-custom", "custom-mkt");
			installedMarketplaces.set("custom-mkt", {
				source: { source: "directory", path: customMarketplaceDir },
			});
			writeSettingsJson();

			const providers = await discoverProviders();

			expect(providers).toHaveLength(1);
			expect(providers[0].name).toBe("custom");
		});
	});

	describe("loadProviderScript", () => {
		test("returns null when required tools are not available", async () => {
			createTestPlugin("hashi-github", "han", {
				allowedTools: ["mcp__github__list_prs", "mcp__github__get_pr"],
			});

			const providers = await discoverProviders();
			const discovered = providers[0];

			const mockMcpClient: MCPClient = {
				callTool: mock(() => Promise.resolve({})),
			};

			// Only one of the required tools is available
			const availableTools = new Set(["mcp__github__list_prs"]);

			const loaded = await loadProviderScript(
				discovered,
				mockMcpClient,
				availableTools,
			);

			expect(loaded).toBeNull();
		});

		test("loads provider when all required tools are available", async () => {
			const pluginRoot = createTestPlugin("hashi-github", "han", {
				allowedTools: ["mcp__github__list_prs"],
			});

			// Create a proper provider script that can be imported
			const scriptContent = `
export function createProvider(mcpClient, availableTools) {
  return {
    name: "github",
    isAvailable: async () => true,
    extract: async (options) => {
      return [];
    },
  };
}
`;
			writeFileSync(join(pluginRoot, "memory-provider.ts"), scriptContent);

			const providers = await discoverProviders();
			const discovered = providers[0];

			const mockMcpClient: MCPClient = {
				callTool: mock(() => Promise.resolve({})),
			};

			const availableTools = new Set(["mcp__github__list_prs"]);

			const loaded = await loadProviderScript(
				discovered,
				mockMcpClient,
				availableTools,
			);

			expect(loaded).not.toBeNull();
			expect(loaded?.name).toBe("github");
			expect(loaded?.pluginName).toBe("hashi-github");
			expect(typeof loaded?.provider.extract).toBe("function");
		});

		test("returns null when script lacks createProvider export", async () => {
			const pluginRoot = createTestPlugin("hashi-bad", "han");

			// Create script without createProvider function
			writeFileSync(
				join(pluginRoot, "memory-provider.ts"),
				"export const name = 'bad';",
			);

			const providers = await discoverProviders();
			const discovered = providers[0];

			const mockMcpClient: MCPClient = {
				callTool: mock(() => Promise.resolve({})),
			};

			const availableTools = new Set(["mcp__test__tool"]);

			const loaded = await loadProviderScript(
				discovered,
				mockMcpClient,
				availableTools,
			);

			expect(loaded).toBeNull();
		});
	});

	describe("loadAllProviders", () => {
		test("loads all providers with available tools", async () => {
			createTestPlugin("hashi-github", "han", {
				allowedTools: ["mcp__github__list_prs"],
			});
			createTestPlugin("hashi-linear", "han", {
				allowedTools: ["mcp__linear__list_issues"],
			});

			const mockMcpClient: MCPClient = {
				callTool: mock(() => Promise.resolve({})),
			};

			// Both providers' tools are available
			const availableTools = new Set([
				"mcp__github__list_prs",
				"mcp__linear__list_issues",
			]);

			const loaded = await loadAllProviders(mockMcpClient, availableTools);

			expect(loaded).toHaveLength(2);
		});

		test("only loads providers with all required tools available", async () => {
			createTestPlugin("hashi-github", "han", {
				allowedTools: ["mcp__github__list_prs"],
			});
			createTestPlugin("hashi-linear", "han", {
				allowedTools: ["mcp__linear__list_issues"], // This tool is not available
			});

			const mockMcpClient: MCPClient = {
				callTool: mock(() => Promise.resolve({})),
			};

			// Only github tools are available
			const availableTools = new Set(["mcp__github__list_prs"]);

			const loaded = await loadAllProviders(mockMcpClient, availableTools);

			expect(loaded).toHaveLength(1);
			expect(loaded[0].name).toBe("github");
		});

		test("returns empty array when no providers match", async () => {
			createTestPlugin("hashi-github", "han", {
				allowedTools: ["mcp__github__list_prs"],
			});

			const mockMcpClient: MCPClient = {
				callTool: mock(() => Promise.resolve({})),
			};

			// No matching tools
			const availableTools = new Set(["mcp__other__tool"]);

			const loaded = await loadAllProviders(mockMcpClient, availableTools);

			expect(loaded).toHaveLength(0);
		});
	});

	describe("Convention-based naming", () => {
		test("hashi- prefix is stripped from provider name", async () => {
			createTestPlugin("hashi-github", "han");
			const providers = await discoverProviders();
			expect(providers[0].name).toBe("github");
		});

		test("jutsu- prefix is stripped from provider name", async () => {
			createTestPlugin("jutsu-playwright", "han", { category: "jutsu" });
			const providers = await discoverProviders();
			expect(providers[0].name).toBe("playwright");
		});

		test("do- prefix is stripped from provider name", async () => {
			createTestPlugin("do-accessibility", "han", { category: "do" });
			const providers = await discoverProviders();
			expect(providers[0].name).toBe("accessibility");
		});

		test("plugins without prefix keep original name", async () => {
			// Create plugin without standard prefix
			const marketplaceRoot = join(configDir, "plugins", "marketplaces", "han");
			const pluginRoot = join(marketplaceRoot, "custom-plugin");
			mkdirSync(pluginRoot, { recursive: true });

			writeFileSync(
				join(pluginRoot, "han-plugin.yml"),
				`hooks: {}
memory:
  allowed_tools:
    - mcp__custom__tool
`,
			);
			writeFileSync(
				join(pluginRoot, "memory-provider.ts"),
				"export function createProvider() { return { name: 'custom', isAvailable: async () => true, extract: async () => [] }; }",
			);

			installedPlugins.set("custom-plugin", "han");
			installedMarketplaces.set("han", {});
			writeSettingsJson();

			const providers = await discoverProviders();

			expect(providers[0].name).toBe("custom-plugin");
		});

		test("script path is always memory-provider.ts", async () => {
			createTestPlugin("hashi-github", "han");
			const providers = await discoverProviders();
			expect(providers[0].scriptPath).toContain("memory-provider.ts");
		});
	});
});
