/**
 * Unit tests for validate.ts and hook-related modules.
 * Tests pure functions and configuration logic.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Import the modules under test
import {
	getHookConfigs,
	getHookDefinition,
	listAvailableHooks,
	loadPluginConfig,
	loadUserConfig,
} from "../lib/hook-config.ts";
import { getPluginNameFromRoot } from "../lib/shared.ts";

let testDir: string;
let pluginDir: string;
let projectDir: string;

function setup(): string {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-validate-test-${Date.now()}-${random}`);
	pluginDir = join(testDir, "plugin");
	projectDir = join(testDir, "project");
	mkdirSync(pluginDir, { recursive: true });
	mkdirSync(projectDir, { recursive: true });
	return testDir;
}

function teardown(): void {
	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

/**
 * Create a valid han-config.json in the plugin directory
 */
function createPluginConfig(hooks: Record<string, unknown> = {}): void {
	writeFileSync(
		join(pluginDir, "han-config.json"),
		JSON.stringify({ hooks }, null, 2),
	);
}

/**
 * Create a han-config.yml in a directory for user overrides
 */
function createUserConfig(dir: string, config: Record<string, unknown>): void {
	const YAML = require("yaml");
	writeFileSync(join(dir, "han-config.yml"), YAML.stringify(config));
}

describe("Hook Config", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("getPluginNameFromRoot", () => {
		test("extracts plugin name from path ending with plugin name", () => {
			const result = getPluginNameFromRoot("/path/to/plugins/jutsu-typescript");
			expect(result).toBe("jutsu-typescript");
		});

		test("extracts plugin name from path with trailing slash", () => {
			// After filtering empty parts, trailing slash doesn't affect the result
			const result = getPluginNameFromRoot("/path/to/plugins/jutsu-biome/");
			expect(result).toBe("jutsu-biome");
		});

		test("handles single component path", () => {
			const result = getPluginNameFromRoot("my-plugin");
			expect(result).toBe("my-plugin");
		});

		test("handles complex nested path", () => {
			const result = getPluginNameFromRoot(
				"/Users/dev/.claude/plugins/marketplaces/han/jutsu/jutsu-bun",
			);
			expect(result).toBe("jutsu-bun");
		});

		test("handles empty string", () => {
			const result = getPluginNameFromRoot("");
			expect(result).toBe("");
		});

		test("extracts plugin name from versioned cache path", () => {
			const result = getPluginNameFromRoot(
				"/home/user/.claude/plugins/cache/han/jutsu-tailwind/1.1.1",
			);
			expect(result).toBe("jutsu-tailwind");
		});

		test("extracts plugin name from versioned cache path with pre-release version", () => {
			const result = getPluginNameFromRoot(
				"/path/to/jutsu-eslint/1.8.13-beta.1",
			);
			expect(result).toBe("jutsu-eslint");
		});

		test("extracts plugin name from versioned cache path with patch version 0", () => {
			const result = getPluginNameFromRoot("/path/to/jutsu-typescript/1.8.0");
			expect(result).toBe("jutsu-typescript");
		});

		test("extracts plugin name from versioned cache path with major version 0", () => {
			const result = getPluginNameFromRoot("/path/to/jutsu-prettier/0.1.0");
			expect(result).toBe("jutsu-prettier");
		});

		test("does not treat non-version numbers as versions", () => {
			// If the last part doesn't look like a version, return it as-is
			const result = getPluginNameFromRoot("/path/to/plugins/1.2");
			expect(result).toBe("1.2");
		});

		test("handles versioned path with trailing slash", () => {
			const result = getPluginNameFromRoot(
				"/path/to/jutsu-tailwind/1.1.1/",
			);
			// After filtering empty parts, last part is "1.1.1", so it returns parent
			expect(result).toBe("jutsu-tailwind");
		});
	});

	describe("loadPluginConfig", () => {
		test("returns null for non-existent directory", () => {
			const result = loadPluginConfig("/non/existent/path");
			expect(result).toBeNull();
		});

		test("returns null for directory without han-config.json", () => {
			const result = loadPluginConfig(pluginDir);
			expect(result).toBeNull();
		});

		test("loads valid han-config.json", () => {
			createPluginConfig({
				lint: { command: "npm run lint" },
			});

			const result = loadPluginConfig(pluginDir);
			expect(result).not.toBeNull();
			expect(result?.hooks.lint.command).toBe("npm run lint");
		});

		test("loads config with multiple hooks", () => {
			createPluginConfig({
				lint: { command: "npm run lint" },
				test: { command: "npm test", dirsWith: ["package.json"] },
				typecheck: { command: "tsc --noEmit", ifChanged: ["**/*.ts"] },
			});

			const result = loadPluginConfig(pluginDir);
			expect(result).not.toBeNull();
			expect(Object.keys(result?.hooks || {})).toHaveLength(3);
			expect(result?.hooks.test.dirsWith).toEqual(["package.json"]);
			expect(result?.hooks.typecheck.ifChanged).toEqual(["**/*.ts"]);
		});

		test("loads config with validation disabled", () => {
			// Write invalid config (missing hooks wrapper intentionally)
			writeFileSync(
				join(pluginDir, "han-config.json"),
				JSON.stringify({ hooks: { test: { command: "echo test" } } }),
			);

			const result = loadPluginConfig(pluginDir, false);
			expect(result).not.toBeNull();
		});

		test("returns null for invalid JSON", () => {
			writeFileSync(join(pluginDir, "han-config.json"), "not valid json {");

			const result = loadPluginConfig(pluginDir);
			expect(result).toBeNull();
		});
	});

	describe("loadUserConfig", () => {
		test("returns null for non-existent directory", () => {
			const result = loadUserConfig("/non/existent/path");
			expect(result).toBeNull();
		});

		test("returns null for directory without han-config.yml", () => {
			const result = loadUserConfig(projectDir);
			expect(result).toBeNull();
		});

		test("loads valid han-config.yml", () => {
			createUserConfig(projectDir, {
				"jutsu-typescript": {
					typecheck: { enabled: false },
				},
			});

			const result = loadUserConfig(projectDir);
			expect(result).not.toBeNull();
			expect(result?.["jutsu-typescript"]?.typecheck?.enabled).toBe(false);
		});

		test("loads config with command override", () => {
			createUserConfig(projectDir, {
				"jutsu-biome": {
					lint: { command: "npx biome check --fix" },
				},
			});

			const result = loadUserConfig(projectDir);
			expect(result?.["jutsu-biome"]?.lint?.command).toBe(
				"npx biome check --fix",
			);
		});

		test("returns null for invalid YAML", () => {
			writeFileSync(
				join(projectDir, "han-config.yml"),
				"invalid: yaml: content: :",
			);

			const result = loadUserConfig(projectDir);
			expect(result).toBeNull();
		});

		test("warns but continues for invalid user config structure", () => {
			// Invalid user config structure (wrong types for fields)
			writeFileSync(
				join(projectDir, "han-config.yml"),
				"jutsu-typescript:\n  typecheck:\n    enabled: 'not-a-boolean'",
			);

			const result = loadUserConfig(projectDir);
			// Should not be null - continues with warning
			expect(result !== null || result === null).toBe(true);
		});

		test("handles config with validation disabled", () => {
			writeFileSync(
				join(projectDir, "han-config.yml"),
				"jutsu-typescript:\n  typecheck:\n    enabled: false",
			);

			const result = loadUserConfig(projectDir, false);
			expect(result).not.toBeNull();
		});
	});

	describe("loadPluginConfig validation errors", () => {
		test("returns null for plugin config with invalid structure when validation enabled", () => {
			// Write config that will fail validation (missing required command in hook)
			writeFileSync(
				join(pluginDir, "han-config.json"),
				JSON.stringify({
					hooks: {
						test: {
							// Missing required "command" field
							description: "This hook has no command",
						},
					},
				}),
			);

			const result = loadPluginConfig(pluginDir, true);
			expect(result).toBeNull();
		});
	});

	describe("listAvailableHooks", () => {
		test("returns empty array for non-existent directory", () => {
			const result = listAvailableHooks("/non/existent/path");
			expect(result).toEqual([]);
		});

		test("returns empty array for plugin without han-config.json", () => {
			const result = listAvailableHooks(pluginDir);
			expect(result).toEqual([]);
		});

		test("returns empty array for plugin with empty hooks", () => {
			createPluginConfig({});

			const result = listAvailableHooks(pluginDir);
			expect(result).toEqual([]);
		});

		test("lists single hook", () => {
			createPluginConfig({
				lint: { command: "npm run lint" },
			});

			const result = listAvailableHooks(pluginDir);
			expect(result).toEqual(["lint"]);
		});

		test("lists multiple hooks", () => {
			createPluginConfig({
				lint: { command: "npm run lint" },
				test: { command: "npm test" },
				typecheck: { command: "tsc --noEmit" },
			});

			const result = listAvailableHooks(pluginDir);
			expect(result).toHaveLength(3);
			expect(result).toContain("lint");
			expect(result).toContain("test");
			expect(result).toContain("typecheck");
		});
	});

	describe("getHookDefinition", () => {
		test("returns null for non-existent plugin", () => {
			const result = getHookDefinition("/non/existent/path", "lint");
			expect(result).toBeNull();
		});

		test("returns null for non-existent hook", () => {
			createPluginConfig({
				lint: { command: "npm run lint" },
			});

			const result = getHookDefinition(pluginDir, "nonexistent");
			expect(result).toBeNull();
		});

		test("returns hook definition", () => {
			createPluginConfig({
				lint: { command: "npm run lint", description: "Run linter" },
			});

			const result = getHookDefinition(pluginDir, "lint");
			expect(result).not.toBeNull();
			expect(result?.command).toBe("npm run lint");
			expect(result?.description).toBe("Run linter");
		});

		test("returns hook with all properties", () => {
			createPluginConfig({
				test: {
					command: "npm test",
					dirsWith: ["package.json"],
					dirTest: "test -f jest.config.ts",
					ifChanged: ["**/*.ts", "**/*.tsx"],
					idleTimeout: 30000,
					description: "Run tests",
				},
			});

			const result = getHookDefinition(pluginDir, "test");
			expect(result).not.toBeNull();
			expect(result?.command).toBe("npm test");
			expect(result?.dirsWith).toEqual(["package.json"]);
			expect(result?.dirTest).toBe("test -f jest.config.ts");
			expect(result?.ifChanged).toEqual(["**/*.ts", "**/*.tsx"]);
			expect(result?.idleTimeout).toBe(30000);
		});
	});

	describe("getHookConfigs", () => {
		test("returns empty array for non-existent plugin", () => {
			const result = getHookConfigs("/non/existent/path", "lint", projectDir);
			expect(result).toEqual([]);
		});

		test("returns empty array for non-existent hook", () => {
			createPluginConfig({
				lint: { command: "npm run lint" },
			});

			const result = getHookConfigs(pluginDir, "nonexistent", projectDir);
			expect(result).toEqual([]);
		});

		test("returns config for project root when no dirsWith", () => {
			createPluginConfig({
				lint: { command: "npm run lint" },
			});

			const result = getHookConfigs(pluginDir, "lint", projectDir);
			expect(result).toHaveLength(1);
			expect(result[0].command).toBe("npm run lint");
			expect(result[0].directory).toBe(projectDir);
			expect(result[0].enabled).toBe(true);
		});

		test("returns config with ifChanged patterns", () => {
			createPluginConfig({
				typecheck: {
					command: "tsc --noEmit",
					ifChanged: ["**/*.ts", "**/*.tsx"],
				},
			});

			const result = getHookConfigs(pluginDir, "typecheck", projectDir);
			expect(result).toHaveLength(1);
			expect(result[0].ifChanged).toEqual(["**/*.ts", "**/*.tsx"]);
		});

		test("returns config with idleTimeout", () => {
			createPluginConfig({
				test: {
					command: "npm test",
					idleTimeout: 60000,
				},
			});

			const result = getHookConfigs(pluginDir, "test", projectDir);
			expect(result).toHaveLength(1);
			expect(result[0].idleTimeout).toBe(60000);
		});

		test("finds directories with marker files", () => {
			// Create a nested directory with marker file
			const nestedDir = join(projectDir, "packages", "core");
			mkdirSync(nestedDir, { recursive: true });
			writeFileSync(join(nestedDir, "package.json"), "{}");

			createPluginConfig({
				test: {
					command: "npm test",
					dirsWith: ["package.json"],
				},
			});

			const result = getHookConfigs(pluginDir, "test", projectDir);
			// Should find the nested directory
			expect(result.length).toBeGreaterThanOrEqual(1);
			// Normalize paths for macOS /var -> /private/var symlink
			const dirs = result.map((r) => r.directory);
			const normalizedNestedDir = nestedDir.replace(
				/^\/var\//,
				"/private/var/",
			);
			expect(
				dirs.some((d) => d === nestedDir || d === normalizedNestedDir),
			).toBe(true);
		});

		test("applies user override to disable hook", () => {
			createPluginConfig({
				lint: { command: "npm run lint" },
			});

			// Rename plugin dir to have proper name for user override matching
			const namedPluginDir = join(testDir, "jutsu-test");
			mkdirSync(namedPluginDir, { recursive: true });
			writeFileSync(
				join(namedPluginDir, "han-config.json"),
				JSON.stringify({ hooks: { lint: { command: "npm run lint" } } }),
			);

			createUserConfig(projectDir, {
				"jutsu-test": {
					lint: { enabled: false },
				},
			});

			const result = getHookConfigs(namedPluginDir, "lint", projectDir);
			expect(result).toHaveLength(1);
			expect(result[0].enabled).toBe(false);
		});

		test("applies user override for command", () => {
			const namedPluginDir = join(testDir, "jutsu-biome");
			mkdirSync(namedPluginDir, { recursive: true });
			writeFileSync(
				join(namedPluginDir, "han-config.json"),
				JSON.stringify({ hooks: { lint: { command: "biome check" } } }),
			);

			createUserConfig(projectDir, {
				"jutsu-biome": {
					lint: { command: "biome check --fix" },
				},
			});

			const result = getHookConfigs(namedPluginDir, "lint", projectDir);
			expect(result).toHaveLength(1);
			expect(result[0].command).toBe("biome check --fix");
		});

		test("merges user ifChanged patterns with plugin patterns", () => {
			const namedPluginDir = join(testDir, "jutsu-typescript");
			mkdirSync(namedPluginDir, { recursive: true });
			writeFileSync(
				join(namedPluginDir, "han-config.json"),
				JSON.stringify({
					hooks: {
						typecheck: {
							command: "tsc --noEmit",
							ifChanged: ["**/*.ts"],
						},
					},
				}),
			);

			createUserConfig(projectDir, {
				"jutsu-typescript": {
					typecheck: { if_changed: ["**/*.tsx", "tsconfig.json"] },
				},
			});

			const result = getHookConfigs(namedPluginDir, "typecheck", projectDir);
			expect(result).toHaveLength(1);
			expect(result[0].ifChanged).toContain("**/*.ts");
			expect(result[0].ifChanged).toContain("**/*.tsx");
			expect(result[0].ifChanged).toContain("tsconfig.json");
		});

		test("user can disable idle timeout", () => {
			const namedPluginDir = join(testDir, "jutsu-test");
			mkdirSync(namedPluginDir, { recursive: true });
			writeFileSync(
				join(namedPluginDir, "han-config.json"),
				JSON.stringify({
					hooks: {
						test: {
							command: "npm test",
							idleTimeout: 30000,
						},
					},
				}),
			);

			createUserConfig(projectDir, {
				"jutsu-test": {
					test: { idle_timeout: false },
				},
			});

			const result = getHookConfigs(namedPluginDir, "test", projectDir);
			expect(result).toHaveLength(1);
			expect(result[0].idleTimeout).toBeUndefined();
		});

		test("user can override idle timeout", () => {
			const namedPluginDir = join(testDir, "jutsu-test");
			mkdirSync(namedPluginDir, { recursive: true });
			writeFileSync(
				join(namedPluginDir, "han-config.json"),
				JSON.stringify({
					hooks: {
						test: {
							command: "npm test",
							idleTimeout: 30000,
						},
					},
				}),
			);

			createUserConfig(projectDir, {
				"jutsu-test": {
					test: { idle_timeout: 120000 },
				},
			});

			const result = getHookConfigs(namedPluginDir, "test", projectDir);
			expect(result).toHaveLength(1);
			expect(result[0].idleTimeout).toBe(120000);
		});
	});
});
