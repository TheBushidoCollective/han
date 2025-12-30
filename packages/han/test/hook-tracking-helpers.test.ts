/**
 * Tests for exported helper functions in hook-tracking.ts
 * These are pure functions that can be tested without side effects
 */
import { describe, expect, test } from "bun:test";

import { getPluginNameFromRoot } from "../lib/shared/index.ts";

describe("hook-tracking.ts helper functions", () => {
	describe("getPluginNameFromRoot", () => {
		test("extracts plugin name from jutsu path", () => {
			const result = getPluginNameFromRoot(
				"/path/to/plugins/marketplaces/han/jutsu/jutsu-typescript",
			);
			expect(result).toBe("jutsu-typescript");
		});

		test("extracts plugin name from core path", () => {
			const result = getPluginNameFromRoot(
				"/path/to/plugins/marketplaces/han/core",
			);
			expect(result).toBe("core");
		});

		test("extracts plugin name from do path", () => {
			const result = getPluginNameFromRoot(
				"/path/to/plugins/marketplaces/han/do/do-accessibility-engineering",
			);
			expect(result).toBe("do-accessibility-engineering");
		});

		test("extracts plugin name from hashi path", () => {
			const result = getPluginNameFromRoot(
				"/path/to/plugins/marketplaces/han/hashi/hashi-github",
			);
			expect(result).toBe("hashi-github");
		});

		test("handles simple path", () => {
			const result = getPluginNameFromRoot("/plugins/my-plugin");
			expect(result).toBe("my-plugin");
		});

		test("handles single segment path", () => {
			const result = getPluginNameFromRoot("plugin-name");
			expect(result).toBe("plugin-name");
		});

		test("handles path with trailing slash", () => {
			// Note: trailing slash is handled by filter(Boolean)
			const result = getPluginNameFromRoot("/path/to/plugin/");
			expect(result).toBe("plugin");
		});

		test("handles root path", () => {
			const result = getPluginNameFromRoot("/");
			expect(result).toBe("");
		});

		test("handles empty string", () => {
			const result = getPluginNameFromRoot("");
			expect(result).toBe("");
		});

		test("handles Windows-style path if split on forward slash", () => {
			// This tests that function uses "/" for splitting
			const result = getPluginNameFromRoot("C:/Users/plugins/my-plugin");
			expect(result).toBe("my-plugin");
		});

		// Tests for versioned cache paths
		test("handles versioned cache path", () => {
			const result = getPluginNameFromRoot(
				"/path/to/plugins/cache/han/jutsu-tailwind/1.1.1",
			);
			expect(result).toBe("jutsu-tailwind");
		});

		test("handles versioned cache path with pre-release", () => {
			const result = getPluginNameFromRoot(
				"/path/to/plugins/cache/han/jutsu-typescript/1.8.13-beta.1",
			);
			expect(result).toBe("jutsu-typescript");
		});

		test("handles versioned cache path with zero versions", () => {
			const result = getPluginNameFromRoot(
				"/path/to/plugins/cache/han/jutsu-react/0.1.0",
			);
			expect(result).toBe("jutsu-react");
		});
	});
});
