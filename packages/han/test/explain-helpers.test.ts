/**
 * Tests for exported helper functions in explain.ts
 * These are pure functions that can be tested without side effects
 */
import { describe, expect, test } from "bun:test";

import {
	getCapabilitiesString,
	type PluginDetails,
} from "../lib/explain.ts";

describe("explain.ts helper functions", () => {
	describe("getCapabilitiesString", () => {
		function createPlugin(overrides: Partial<PluginDetails> = {}): PluginDetails {
			return {
				name: "test-plugin",
				scope: "user",
				hasCommands: false,
				hasSkills: false,
				hasHooks: false,
				hasMcp: false,
				hasAgents: false,
				...overrides,
			};
		}

		test("returns dash when no capabilities", () => {
			const plugin = createPlugin();
			expect(getCapabilitiesString(plugin)).toBe("-");
		});

		test("shows commands emoji when hasCommands is true", () => {
			const plugin = createPlugin({ hasCommands: true });
			expect(getCapabilitiesString(plugin)).toContain("📜");
		});

		test("shows skills emoji when hasSkills is true", () => {
			const plugin = createPlugin({ hasSkills: true });
			expect(getCapabilitiesString(plugin)).toContain("⚔️");
		});

		test("shows agents emoji when hasAgents is true", () => {
			const plugin = createPlugin({ hasAgents: true });
			expect(getCapabilitiesString(plugin)).toContain("🤖");
		});

		test("shows hooks emoji when hasHooks is true", () => {
			const plugin = createPlugin({ hasHooks: true });
			expect(getCapabilitiesString(plugin)).toContain("🪝");
		});

		test("shows mcp emoji when hasMcp is true", () => {
			const plugin = createPlugin({ hasMcp: true });
			expect(getCapabilitiesString(plugin)).toContain("🔌");
		});

		test("shows all emojis when all capabilities are true", () => {
			const plugin = createPlugin({
				hasCommands: true,
				hasSkills: true,
				hasAgents: true,
				hasHooks: true,
				hasMcp: true,
			});
			const result = getCapabilitiesString(plugin);
			expect(result).toContain("📜");
			expect(result).toContain("⚔️");
			expect(result).toContain("🤖");
			expect(result).toContain("🪝");
			expect(result).toContain("🔌");
		});

		test("emojis are space-separated", () => {
			const plugin = createPlugin({
				hasCommands: true,
				hasHooks: true,
			});
			const result = getCapabilitiesString(plugin);
			expect(result).toBe("📜 🪝");
		});

		test("maintains correct order of emojis", () => {
			const plugin = createPlugin({
				hasCommands: true,
				hasSkills: true,
				hasAgents: true,
				hasHooks: true,
				hasMcp: true,
			});
			const result = getCapabilitiesString(plugin);
			// Order should be: Commands, Skills, Agents, Hooks, MCP
			const parts = result.split(" ");
			expect(parts[0]).toBe("📜"); // Commands
			expect(parts[1]).toBe("⚔️"); // Skills
			expect(parts[2]).toBe("🤖"); // Agents
			expect(parts[3]).toBe("🪝"); // Hooks
			expect(parts[4]).toBe("🔌"); // MCP
		});

		test("shows only commands and skills", () => {
			const plugin = createPlugin({
				hasCommands: true,
				hasSkills: true,
			});
			const result = getCapabilitiesString(plugin);
			expect(result).toBe("📜 ⚔️");
		});

		test("shows only hooks and mcp", () => {
			const plugin = createPlugin({
				hasHooks: true,
				hasMcp: true,
			});
			const result = getCapabilitiesString(plugin);
			expect(result).toBe("🪝 🔌");
		});
	});
});
