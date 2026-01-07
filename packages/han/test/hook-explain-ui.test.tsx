/**
 * Ink render tests for hook-explain-ui.tsx
 * Tests the HookExplainUI component and its subcomponents
 */
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { HookExplainUI, type HookSource } from "../lib/hooks/index.ts";

describe("hook-explain-ui.tsx", () => {
	describe("HookExplainUI - Empty State", () => {
		test("renders empty state when no hooks provided", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("No hooks configured");
			expect(output).toContain("Use --all to include hooks");
		});

		test("renders empty state without hint when showAll is true", () => {
			const { lastFrame } = render(<HookExplainUI hooks={[]} showAll={true} />);
			const output = lastFrame();
			expect(output).toContain("No hooks configured");
			expect(output).not.toContain("Use --all to include hooks");
		});
	});

	describe("HookExplainUI - With Hooks", () => {
		const samplePluginHook: HookSource = {
			source: "/path/to/plugin",
			pluginName: "jutsu-typescript",
			marketplace: "han",
			hookType: "PreToolUse",
			hooks: [
				{
					name: "typecheck",
					command: "han hook run jutsu-typescript typecheck",
					description: "Run TypeScript type checking",
					toolFilter: ["Edit", "Write"],
				},
			],
		};

		const sampleSettingsHook: HookSource = {
			source: "/path/to/settings.json",
			scope: "user",
			hookType: "SessionStart",
			hooks: [
				{
					command: "han hook dispatch SessionStart",
					description: "Dispatch session start hooks",
				},
			],
		};

		test("renders header with hooks present", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("ORCHESTRATOR-MANAGED HOOKS");
			expect(output).toContain("Han plugins only");
		});

		test("renders header with showAll true", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={true} />,
			);
			const output = lastFrame();
			expect(output).toContain("all sources");
		});

		test("renders plugin hook source with name and marketplace", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("jutsu-typescript");
			expect(output).toContain("@han");
			expect(output).toContain("PreToolUse");
		});

		test("renders settings hook source with scope", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[sampleSettingsHook]} showAll={true} />,
			);
			const output = lastFrame();
			expect(output).toContain("Settings");
			expect(output).toContain("user");
		});

		test("renders command hook details with name", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("typecheck");
			expect(output).toContain("han hook run jutsu-typescript typecheck");
		});

		test("renders hook description", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("Run TypeScript type checking");
		});

		test("renders tool filter", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("Tool filter:");
			expect(output).toContain("Edit, Write");
		});

		test("renders summary section", () => {
			const hooks: HookSource[] = [samplePluginHook, sampleSettingsHook];
			const { lastFrame } = render(
				<HookExplainUI hooks={hooks} showAll={true} />,
			);
			const output = lastFrame();
			expect(output).toContain("SUMMARY");
			expect(output).toContain("Total plugins:");
			expect(output).toContain("Total hooks:");
			expect(output).toContain("Event types:");
		});

		test("renders HOW IT WORKS section", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("HOW IT WORKS:");
			expect(output).toContain("central orchestrator");
		});

		test("renders path information", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("Path:");
			expect(output).toContain("/path/to/plugin");
		});

		test("groups hooks by type", () => {
			const hooks: HookSource[] = [
				samplePluginHook,
				{
					...samplePluginHook,
					source: "/another/path",
					pluginName: "jutsu-biome",
				},
				sampleSettingsHook,
			];
			const { lastFrame } = render(
				<HookExplainUI hooks={hooks} showAll={true} />,
			);
			const output = lastFrame();
			// Should show both PreToolUse and SessionStart sections
			expect(output).toContain("PreToolUse");
			expect(output).toContain("SessionStart");
			// PreToolUse should show "(2 plugins"
			expect(output).toContain("2 plugin");
		});

		test("renders multiple hooks within a single source", () => {
			const multiHookSource: HookSource = {
				source: "/path/to/hooks",
				pluginName: "test-plugin",
				marketplace: "han",
				hookType: "Stop",
				hooks: [
					{ name: "lint", command: "bun run lint" },
					{ name: "test", command: "bun run test" },
					{ command: "bun run format" },
				],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[multiHookSource]} showAll={false} />,
			);
			const output = lastFrame();
			// Check hook names are rendered (colon may be rendered separately)
			expect(output).toContain("lint");
			expect(output).toContain("test");
			expect(output).toContain("Hook 3");
			expect(output).toContain("bun run lint");
			expect(output).toContain("bun run test");
			expect(output).toContain("bun run format");
		});
	});

	describe("HookExplainUI - Edge Cases", () => {
		test("handles hook with dirsWith", () => {
			const hookWithDirs: HookSource = {
				source: "/path",
				pluginName: "test",
				marketplace: "han",
				hookType: "Test",
				hooks: [
					{
						command: "test",
						dirsWith: ["package.json", "tsconfig.json"],
					},
				],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[hookWithDirs]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("Directories with:");
			expect(output).toContain("package.json, tsconfig.json");
		});

		test("handles hook with ifChanged", () => {
			const hookWithIfChanged: HookSource = {
				source: "/path",
				pluginName: "test",
				marketplace: "han",
				hookType: "Test",
				hooks: [
					{
						command: "test",
						ifChanged: ["**/*.ts", "**/*.tsx"],
					},
				],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[hookWithIfChanged]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("If changed:");
			expect(output).toContain("**/*.ts, **/*.tsx");
		});

		test("handles hook with dependsOn", () => {
			const hookWithDeps: HookSource = {
				source: "/path",
				pluginName: "test",
				marketplace: "han",
				hookType: "Test",
				hooks: [
					{
						command: "test",
						dependsOn: [
							{ plugin: "jutsu-typescript", hook: "typecheck" },
							{ plugin: "jutsu-biome", hook: "lint", optional: true },
						],
					},
				],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[hookWithDeps]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("Depends on:");
			expect(output).toContain("jutsu-typescript/typecheck");
			expect(output).toContain("jutsu-biome/lint (optional)");
		});

		test("handles hook with tip", () => {
			const hookWithTip: HookSource = {
				source: "/path",
				pluginName: "test",
				marketplace: "han",
				hookType: "Test",
				hooks: [
					{
						command: "test",
						tip: "Run with --verbose for more output",
					},
				],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[hookWithTip]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("Tip:");
			expect(output).toContain("Run with --verbose for more output");
		});

		test("sorts hook types in logical order", () => {
			const hooks: HookSource[] = [
				{
					source: "/z",
					pluginName: "z",
					marketplace: "han",
					hookType: "Stop",
					hooks: [{ command: "z" }],
				},
				{
					source: "/a",
					pluginName: "a",
					marketplace: "han",
					hookType: "SessionStart",
					hooks: [{ command: "a" }],
				},
				{
					source: "/m",
					pluginName: "m",
					marketplace: "han",
					hookType: "PreToolUse",
					hooks: [{ command: "m" }],
				},
			];
			const { lastFrame } = render(
				<HookExplainUI hooks={hooks} showAll={false} />,
			);
			const output = lastFrame() || "";
			// SessionStart should come before PreToolUse which should come before Stop
			const sessionIndex = output.indexOf("SessionStart");
			const preToolIndex = output.indexOf("PreToolUse");
			const stopIndex = output.indexOf("Stop");
			expect(sessionIndex).toBeLessThan(preToolIndex);
			expect(preToolIndex).toBeLessThan(stopIndex);
		});

		test("handles single plugin with singular text", () => {
			const singleSource: HookSource = {
				source: "/path",
				pluginName: "single",
				marketplace: "han",
				hookType: "Test",
				hooks: [{ command: "test" }],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[singleSource]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("1 plugin");
			expect(output).not.toContain("1 plugins");
		});

		test("handles empty hooks array in source", () => {
			const emptyHooksSource: HookSource = {
				source: "/path",
				pluginName: "empty",
				marketplace: "han",
				hookType: "Empty",
				hooks: [],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[emptyHooksSource]} showAll={false} />,
			);
			const output = lastFrame();
			// Should still render the source but without hook entries
			expect(output).toContain("empty");
		});

		test("counts hooks with caching correctly", () => {
			const hooks: HookSource[] = [
				{
					source: "/path1",
					pluginName: "test1",
					marketplace: "han",
					hookType: "Stop",
					hooks: [
						{ command: "test1", ifChanged: ["*.ts"] },
						{ command: "test2" },
					],
				},
			];
			const { lastFrame } = render(
				<HookExplainUI hooks={hooks} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("With caching (if_changed):");
		});
	});
});
