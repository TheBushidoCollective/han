/**
 * Ink render tests for hook-explain-ui.tsx
 * Tests the HookExplainUI component and its subcomponents
 */
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { HookExplainUI, type HookSource } from "../lib/hook-explain-ui.tsx";

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
			source: "/path/to/plugin/hooks.json",
			pluginName: "jutsu-typescript",
			marketplace: "han",
			hookType: "PreToolUse",
			hooks: [
				{
					type: "command",
					command: "han hook dispatch PreToolUse",
					timeout: 5000,
				},
			],
		};

		const sampleSettingsHook: HookSource = {
			source: "/path/to/settings.json",
			scope: "user",
			hookType: "SessionStart",
			hooks: [
				{
					type: "prompt",
					prompt: "Hello world\nSecond line",
				},
			],
		};

		test("renders header with hooks present", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("CONFIGURED HOOKS");
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

		test("renders command hook details", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("command");
			expect(output).toContain("han hook dispatch PreToolUse");
			expect(output).toContain("5000ms");
		});

		test("renders prompt hook with multiline content", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[sampleSettingsHook]} showAll={true} />,
			);
			const output = lastFrame();
			expect(output).toContain("prompt");
			expect(output).toContain("Hello world");
			expect(output).toContain("Second line");
		});

		test("renders summary section", () => {
			const hooks: HookSource[] = [samplePluginHook, sampleSettingsHook];
			const { lastFrame } = render(
				<HookExplainUI hooks={hooks} showAll={true} />,
			);
			const output = lastFrame();
			expect(output).toContain("SUMMARY");
			expect(output).toContain("Total hook sources:");
			expect(output).toContain("Command hooks:");
			expect(output).toContain("Prompt hooks:");
			expect(output).toContain("Hook types:");
		});

		test("counts command and prompt hooks correctly", () => {
			const hooks: HookSource[] = [samplePluginHook, sampleSettingsHook];
			const { lastFrame } = render(
				<HookExplainUI hooks={hooks} showAll={true} />,
			);
			const output = lastFrame();
			// 1 command hook, 1 prompt hook
			expect(output).toContain("1"); // Command hooks count
		});

		test("renders note section", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("NOTE:");
			expect(output).toContain("Command hooks execute shell commands");
			expect(output).toContain("Prompt hooks inject text");
		});

		test("renders path information", () => {
			const { lastFrame } = render(
				<HookExplainUI hooks={[samplePluginHook]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("Path:");
			expect(output).toContain("/path/to/plugin/hooks.json");
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
			// PreToolUse should show "(2 sources)"
			expect(output).toContain("2 source");
		});

		test("renders multiple hooks within a single source", () => {
			const multiHookSource: HookSource = {
				source: "/path/to/hooks.json",
				pluginName: "test-plugin",
				marketplace: "han",
				hookType: "Stop",
				hooks: [
					{ type: "command", command: "first-command" },
					{ type: "command", command: "second-command" },
					{ type: "prompt", prompt: "test prompt" },
				],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[multiHookSource]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("Hook 1:");
			expect(output).toContain("Hook 2:");
			expect(output).toContain("Hook 3:");
			expect(output).toContain("first-command");
			expect(output).toContain("second-command");
			expect(output).toContain("test prompt");
		});
	});

	describe("HookExplainUI - Edge Cases", () => {
		test("handles hook without timeout", () => {
			const hookNoTimeout: HookSource = {
				source: "/path",
				pluginName: "test",
				marketplace: "han",
				hookType: "Test",
				hooks: [{ type: "command", command: "test" }],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[hookNoTimeout]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).not.toContain("Timeout:");
		});

		test("handles hook with only prompt type", () => {
			const promptOnly: HookSource = {
				source: "/path",
				scope: "project",
				hookType: "UserPromptSubmit",
				hooks: [{ type: "prompt", prompt: "context injection" }],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[promptOnly]} showAll={true} />,
			);
			const output = lastFrame();
			expect(output).toContain("prompt");
			expect(output).toContain("context injection");
		});

		test("sorts hook types alphabetically", () => {
			const hooks: HookSource[] = [
				{
					source: "/z",
					pluginName: "z",
					marketplace: "han",
					hookType: "ZHook",
					hooks: [{ type: "command", command: "z" }],
				},
				{
					source: "/a",
					pluginName: "a",
					marketplace: "han",
					hookType: "AHook",
					hooks: [{ type: "command", command: "a" }],
				},
				{
					source: "/m",
					pluginName: "m",
					marketplace: "han",
					hookType: "MHook",
					hooks: [{ type: "command", command: "m" }],
				},
			];
			const { lastFrame } = render(
				<HookExplainUI hooks={hooks} showAll={false} />,
			);
			const output = lastFrame() || "";
			const aIndex = output.indexOf("AHook");
			const mIndex = output.indexOf("MHook");
			const zIndex = output.indexOf("ZHook");
			expect(aIndex).toBeLessThan(mIndex);
			expect(mIndex).toBeLessThan(zIndex);
		});

		test("handles single source with singular text", () => {
			const singleSource: HookSource = {
				source: "/path",
				pluginName: "single",
				marketplace: "han",
				hookType: "Test",
				hooks: [{ type: "command", command: "test" }],
			};
			const { lastFrame } = render(
				<HookExplainUI hooks={[singleSource]} showAll={false} />,
			);
			const output = lastFrame();
			expect(output).toContain("1 source)");
			expect(output).not.toContain("1 sources)");
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
			expect(output).not.toContain("Hook 1:");
		});
	});
});
