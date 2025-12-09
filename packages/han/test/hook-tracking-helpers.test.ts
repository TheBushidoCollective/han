/**
 * Tests for exported helper functions in hook-tracking.ts
 * These are pure functions that can be tested without side effects
 */
import { describe, expect, test } from "bun:test";

import { extractPluginName } from "../lib/commands/metrics/hook-tracking.ts";

describe("hook-tracking.ts helper functions", () => {
	describe("extractPluginName", () => {
		test("extracts plugin name from jutsu path", () => {
			const result = extractPluginName(
				"/path/to/plugins/marketplaces/han/jutsu/jutsu-typescript",
			);
			expect(result).toBe("jutsu-typescript");
		});

		test("extracts plugin name from core path", () => {
			const result = extractPluginName(
				"/path/to/plugins/marketplaces/han/core",
			);
			expect(result).toBe("core");
		});

		test("extracts plugin name from do path", () => {
			const result = extractPluginName(
				"/path/to/plugins/marketplaces/han/do/do-accessibility-engineering",
			);
			expect(result).toBe("do-accessibility-engineering");
		});

		test("extracts plugin name from hashi path", () => {
			const result = extractPluginName(
				"/path/to/plugins/marketplaces/han/hashi/hashi-github",
			);
			expect(result).toBe("hashi-github");
		});

		test("handles simple path", () => {
			const result = extractPluginName("/plugins/my-plugin");
			expect(result).toBe("my-plugin");
		});

		test("handles single segment path", () => {
			const result = extractPluginName("plugin-name");
			expect(result).toBe("plugin-name");
		});

		test("handles path with trailing slash", () => {
			// Note: trailing slash would result in empty string as last segment
			const result = extractPluginName("/path/to/plugin/");
			expect(result).toBe("");
		});

		test("handles root path", () => {
			const result = extractPluginName("/");
			expect(result).toBe("");
		});

		test("handles empty string", () => {
			const result = extractPluginName("");
			expect(result).toBe("");
		});

		test("handles Windows-style path if split on forward slash", () => {
			// This tests that function uses "/" for splitting
			const result = extractPluginName("C:/Users/plugins/my-plugin");
			expect(result).toBe("my-plugin");
		});
	});
});
