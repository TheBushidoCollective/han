import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	detectPluginsByMarkers,
	type PluginWithDetection,
} from "../lib/validation/index.ts";

describe("marker-detection", () => {
	let testDir: string;

	beforeEach(() => {
		// Create a unique temp directory for each test
		testDir = join(
			tmpdir(),
			`han-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		// Clean up temp directory
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("detectPluginsByMarkers", () => {
		test("detects plugin when marker file exists", () => {
			// Create tsconfig.json marker file
			writeFileSync(join(testDir, "tsconfig.json"), "{}");

			const plugins: PluginWithDetection[] = [
				{
					name: "jutsu-typescript",
					detection: { dirsWith: ["tsconfig.json"] },
				},
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			expect(result.detected).toContain("jutsu-typescript");
			expect(result.confident).toContain("jutsu-typescript");
			expect(result.possible).not.toContain("jutsu-typescript");
		});

		test("does not detect plugin when marker file is missing", () => {
			// Empty directory - no tsconfig.json

			const plugins: PluginWithDetection[] = [
				{
					name: "jutsu-typescript",
					detection: { dirsWith: ["tsconfig.json"] },
				},
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			expect(result.detected).not.toContain("jutsu-typescript");
			expect(result.confident).not.toContain("jutsu-typescript");
		});

		test("detects plugin in subdirectory", () => {
			// Create marker file in subdirectory
			const subDir = join(testDir, "packages", "myapp");
			mkdirSync(subDir, { recursive: true });
			writeFileSync(join(subDir, "tsconfig.json"), "{}");

			const plugins: PluginWithDetection[] = [
				{
					name: "jutsu-typescript",
					detection: { dirsWith: ["tsconfig.json"] },
				},
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			expect(result.detected).toContain("jutsu-typescript");
			expect(result.confident).toContain("jutsu-typescript");
		});

		test("handles multiple marker files (OR logic)", () => {
			// Create only one of multiple possible markers
			writeFileSync(join(testDir, "bun.lock"), "");

			const plugins: PluginWithDetection[] = [
				{
					name: "jutsu-bun",
					detection: { dirsWith: ["bun.lock", "bun.lockb"] },
				},
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			expect(result.detected).toContain("jutsu-bun");
			expect(result.confident).toContain("jutsu-bun");
		});

		test("marks as possible when dirTest fails", () => {
			// Create package.json but without prettier dependency
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({ dependencies: {} }),
			);

			const plugins: PluginWithDetection[] = [
				{
					name: "jutsu-prettier",
					detection: {
						dirsWith: ["package.json"],
						dirTest: ["grep -qE '\"prettier\":' package.json"],
					},
				},
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			expect(result.detected).toContain("jutsu-prettier");
			expect(result.confident).not.toContain("jutsu-prettier");
			expect(result.possible).toContain("jutsu-prettier");
		});

		test("marks as confident when dirTest passes", () => {
			// Create package.json with prettier dependency
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({ devDependencies: { prettier: "^3.0.0" } }),
			);

			const plugins: PluginWithDetection[] = [
				{
					name: "jutsu-prettier",
					detection: {
						dirsWith: ["package.json"],
						dirTest: ["grep -qE '\"prettier\":' package.json"],
					},
				},
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			expect(result.detected).toContain("jutsu-prettier");
			expect(result.confident).toContain("jutsu-prettier");
			expect(result.possible).not.toContain("jutsu-prettier");
		});

		test("handles plugins without detection criteria", () => {
			const plugins: PluginWithDetection[] = [
				{ name: "bushido" }, // No detection field
				{ name: "jutsu-tdd", detection: {} }, // Empty detection
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			expect(result.detected).not.toContain("bushido");
			expect(result.detected).not.toContain("jutsu-tdd");
		});

		test("handles glob patterns with wildcards", () => {
			// Create a .ts file
			writeFileSync(join(testDir, "app.ts"), "");

			const plugins: PluginWithDetection[] = [
				{
					name: "jutsu-typescript-files",
					detection: { dirsWith: ["*.ts"] },
				},
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			expect(result.detected).toContain("jutsu-typescript-files");
		});

		test("skips node_modules directory", () => {
			// Create marker file only in node_modules
			const nodeModulesDir = join(testDir, "node_modules", "some-package");
			mkdirSync(nodeModulesDir, { recursive: true });
			writeFileSync(join(nodeModulesDir, "tsconfig.json"), "{}");

			const plugins: PluginWithDetection[] = [
				{
					name: "jutsu-typescript",
					detection: { dirsWith: ["tsconfig.json"] },
				},
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			// Should not find the marker in node_modules
			expect(result.detected).not.toContain("jutsu-typescript");
		});

		test("provides details about where markers were found", () => {
			// Create markers in multiple locations
			writeFileSync(join(testDir, "tsconfig.json"), "{}");
			const subDir = join(testDir, "packages", "lib");
			mkdirSync(subDir, { recursive: true });
			writeFileSync(join(subDir, "tsconfig.json"), "{}");

			const plugins: PluginWithDetection[] = [
				{
					name: "jutsu-typescript",
					detection: { dirsWith: ["tsconfig.json"] },
				},
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			expect(result.details.has("jutsu-typescript")).toBe(true);
			const dirs = result.details.get("jutsu-typescript");
			expect(dirs).toBeDefined();
			expect(dirs?.length).toBeGreaterThanOrEqual(2);
		});

		test("handles dirTest-only detection", () => {
			// Create the marker file that the dirTest will check
			mkdirSync(join(testDir, ".claude-plugin"), { recursive: true });
			writeFileSync(join(testDir, ".claude-plugin", "marketplace.json"), "{}");

			const plugins: PluginWithDetection[] = [
				{
					name: "do-claude-plugin-development",
					detection: {
						dirTest: ["test -f .claude-plugin/marketplace.json"],
					},
				},
			];

			const result = detectPluginsByMarkers(plugins, testDir);

			expect(result.detected).toContain("do-claude-plugin-development");
			expect(result.confident).toContain("do-claude-plugin-development");
		});
	});
});
