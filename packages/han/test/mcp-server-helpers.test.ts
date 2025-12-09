/**
 * Tests for exported helper functions in mcp/server.ts
 * These are pure functions that can be tested without side effects
 */
import { describe, expect, test } from "bun:test";

import {
	formatToolsForMcp,
	handleInitialize,
} from "../lib/commands/mcp/server.ts";
import type { PluginTool } from "../lib/commands/mcp/tools.ts";

describe("mcp/server.ts helper functions", () => {
	describe("handleInitialize", () => {
		test("returns correct protocol version", () => {
			const result = handleInitialize();
			expect(result).toHaveProperty("protocolVersion", "2024-11-05");
		});

		test("returns server info with name and version", () => {
			const result = handleInitialize() as {
				serverInfo: { name: string; version: string };
			};
			expect(result.serverInfo.name).toBe("han");
			expect(result.serverInfo.version).toBe("1.0.0");
		});

		test("returns tools capability", () => {
			const result = handleInitialize() as { capabilities: { tools: unknown } };
			expect(result.capabilities).toHaveProperty("tools");
		});

		test("returns consistent result on multiple calls", () => {
			const result1 = handleInitialize();
			const result2 = handleInitialize();
			expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
		});
	});

	describe("formatToolsForMcp", () => {
		test("formats a single tool correctly", () => {
			const tools: PluginTool[] = [
				{
					name: "jutsu_typescript_typecheck",
					pluginName: "jutsu-typescript",
					hookName: "typecheck",
					description: "Type-check TypeScript code",
					command: "npx tsc",
					dirsContaining: "tsconfig.json",
				},
			];

			const result = formatToolsForMcp(tools);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("jutsu_typescript_typecheck");
			expect(result[0].description).toBe("Type-check TypeScript code");
		});

		test("generates human-readable title from hook name", () => {
			const tools: PluginTool[] = [
				{
					name: "jutsu_bun_test",
					pluginName: "jutsu-bun",
					hookName: "test",
					description: "Run tests",
					command: "bun test",
					dirsContaining: "bun.lock",
				},
			];

			const result = formatToolsForMcp(tools);

			// Title should capitalize hook name and technology
			expect(result[0].annotations?.title).toBe("Test Bun");
		});

		test("strips jutsu prefix from technology name", () => {
			const tools: PluginTool[] = [
				{
					name: "jutsu_typescript_lint",
					pluginName: "jutsu-typescript",
					hookName: "lint",
					description: "Lint code",
					command: "npm run lint",
					dirsContaining: "tsconfig.json",
				},
			];

			const result = formatToolsForMcp(tools);
			expect(result[0].annotations?.title).toBe("Lint Typescript");
		});

		test("strips do prefix from technology name", () => {
			const tools: PluginTool[] = [
				{
					name: "do_documentation_generate",
					pluginName: "do-documentation",
					hookName: "generate",
					description: "Generate docs",
					command: "npm run docs",
					dirsContaining: "package.json",
				},
			];

			const result = formatToolsForMcp(tools);
			expect(result[0].annotations?.title).toBe("Generate Documentation");
		});

		test("strips hashi prefix from technology name", () => {
			const tools: PluginTool[] = [
				{
					name: "hashi_github_check",
					pluginName: "hashi-github",
					hookName: "check",
					description: "Check GitHub status",
					command: "gh status",
					dirsContaining: ".github",
				},
			];

			const result = formatToolsForMcp(tools);
			expect(result[0].annotations?.title).toBe("Check Github");
		});

		test("includes correct annotations", () => {
			const tools: PluginTool[] = [
				{
					name: "test_tool",
					pluginName: "test-plugin",
					hookName: "action",
					description: "Test action",
					command: "echo test",
					dirsContaining: "test.json",
				},
			];

			const result = formatToolsForMcp(tools);
			const annotations = result[0].annotations!;

			expect(annotations.readOnlyHint).toBe(false);
			expect(annotations.destructiveHint).toBe(false);
			expect(annotations.idempotentHint).toBe(true);
			expect(annotations.openWorldHint).toBe(false);
		});

		test("includes input schema with cache, directory, and verbose properties", () => {
			const tools: PluginTool[] = [
				{
					name: "test_tool",
					pluginName: "test",
					hookName: "action",
					description: "Test",
					command: "test",
					dirsContaining: "file",
				},
			];

			const result = formatToolsForMcp(tools);
			const schema = result[0].inputSchema;

			expect(schema.type).toBe("object");
			expect(schema.properties).toHaveProperty("cache");
			expect(schema.properties).toHaveProperty("directory");
			expect(schema.properties).toHaveProperty("verbose");
			expect(schema.required).toEqual([]);
		});

		test("formats multiple tools", () => {
			const tools: PluginTool[] = [
				{
					name: "tool1",
					pluginName: "jutsu-typescript",
					hookName: "typecheck",
					description: "TypeScript type checking",
					command: "tsc",
					dirsContaining: "tsconfig.json",
				},
				{
					name: "tool2",
					pluginName: "jutsu-biome",
					hookName: "lint",
					description: "Biome linting",
					command: "biome check",
					dirsContaining: "biome.json",
				},
				{
					name: "tool3",
					pluginName: "jutsu-bun",
					hookName: "test",
					description: "Bun testing",
					command: "bun test",
					dirsContaining: "bun.lock",
				},
			];

			const result = formatToolsForMcp(tools);

			expect(result).toHaveLength(3);
			expect(result[0].name).toBe("tool1");
			expect(result[1].name).toBe("tool2");
			expect(result[2].name).toBe("tool3");
		});

		test("handles empty tools array", () => {
			const result = formatToolsForMcp([]);
			expect(result).toEqual([]);
		});

		test("preserves original description", () => {
			const description =
				"A very detailed description with multiple sentences. It explains what the tool does.";
			const tools: PluginTool[] = [
				{
					name: "test",
					pluginName: "test",
					hookName: "action",
					description,
					command: "cmd",
					dirsContaining: "file",
				},
			];

			const result = formatToolsForMcp(tools);
			expect(result[0].description).toBe(description);
		});

		test("cache property has correct description", () => {
			const tools: PluginTool[] = [
				{
					name: "test",
					pluginName: "test",
					hookName: "action",
					description: "Test",
					command: "cmd",
					dirsContaining: "file",
				},
			];

			const result = formatToolsForMcp(tools);
			const cacheProperty = result[0].inputSchema.properties.cache as {
				description: string;
			};

			expect(cacheProperty.description).toContain("cache");
			expect(cacheProperty.description).toContain("cache=false");
		});

		test("directory property has correct description", () => {
			const tools: PluginTool[] = [
				{
					name: "test",
					pluginName: "test",
					hookName: "action",
					description: "Test",
					command: "cmd",
					dirsContaining: "file",
				},
			];

			const result = formatToolsForMcp(tools);
			const directoryProperty = result[0].inputSchema.properties.directory as {
				description: string;
			};

			expect(directoryProperty.description).toContain("directory");
			expect(directoryProperty.description).toContain("packages/core");
		});

		test("verbose property has correct description", () => {
			const tools: PluginTool[] = [
				{
					name: "test",
					pluginName: "test",
					hookName: "action",
					description: "Test",
					command: "cmd",
					dirsContaining: "file",
				},
			];

			const result = formatToolsForMcp(tools);
			const verboseProperty = result[0].inputSchema.properties.verbose as {
				description: string;
			};

			expect(verboseProperty.description).toContain("output");
			expect(verboseProperty.description).toContain("debugging");
		});
	});
});
