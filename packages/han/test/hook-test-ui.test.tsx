/**
 * Tests for HookTestUI component using ink-testing-library
 */
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { HookTestUI } from "../lib/hook-test-ui.tsx";

interface HookResult {
	plugin: string;
	command: string;
	success: boolean;
	output: string[];
	isPrompt?: boolean;
	timedOut?: boolean;
}

interface HookStructureItem {
	plugin: string;
	command: string;
	pluginDir: string;
	type: "command" | "prompt";
	timeout?: number;
}

describe("HookTestUI component", () => {
	describe("initial rendering", () => {
		test("renders header text", () => {
			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={new Map()}
					hookResults={new Map()}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("Hook Test");
		});

		test("shows navigation instructions when not complete", () => {
			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={new Map()}
					hookResults={new Map()}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("navigate");
			expect(lastFrame()).toContain("Enter");
			expect(lastFrame()).toContain("Esc");
		});

		test("does not show instructions when complete", () => {
			const { lastFrame } = render(
				<HookTestUI
					hookTypes={[]}
					hookStructure={new Map()}
					hookResults={new Map()}
					currentType={null}
					isComplete={true}
					verbose={false}
				/>,
			);

			// Instructions should not be shown in complete state
			expect(lastFrame()).not.toContain("navigate");
		});
	});

	describe("hook type display", () => {
		test("displays hook types", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={new Map()}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("Stop");
		});

		test("displays multiple hook types", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
				["PreCommit", [{ plugin: "jutsu-biome", command: "biome check", pluginDir: "/plugins/jutsu-biome", type: "command" }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop", "PreCommit"]}
					hookStructure={hookStructure}
					hookResults={new Map()}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("Stop");
			expect(lastFrame()).toContain("PreCommit");
		});
	});

	describe("status indicators", () => {
		test("shows pending indicator for pending hooks", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={new Map()}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("○");
		});

		test("shows completed indicator for successful hooks", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);
			const hookResults = new Map<string, HookResult[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", success: true, output: [] }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={hookResults}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("✓");
		});

		test("shows failed indicator for failed hooks", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);
			const hookResults = new Map<string, HookResult[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", success: false, output: ["Error"] }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={hookResults}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("✗");
		});
	});

	describe("hook counts", () => {
		test("shows hook counts for pending hooks", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [
					{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" },
					{ plugin: "jutsu-biome", command: "biome check", pluginDir: "/plugins/jutsu-biome", type: "command" },
				]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={new Map()}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("(0/2)");
		});

		test("shows hook counts for completed hooks", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [
					{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" },
				]],
			]);
			const hookResults = new Map<string, HookResult[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", success: true, output: [] }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={hookResults}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("(1/1)");
		});
	});

	describe("completion state", () => {
		test("shows checkmark for successful hooks on completion", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);
			const hookResults = new Map<string, HookResult[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", success: true, output: [] }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={hookResults}
					currentType={null}
					isComplete={true}
					verbose={false}
				/>,
			);

			// Completion is written to stdout, not rendered in component
			// But the summary shows checkmark and counts
			expect(lastFrame()).toContain("✓");
			expect(lastFrame()).toContain("Stop");
			expect(lastFrame()).toContain("1/1");
		});

		test("shows X for failed hooks on completion", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);
			const hookResults = new Map<string, HookResult[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", success: false, output: ["Error"] }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={hookResults}
					currentType={null}
					isComplete={true}
					verbose={false}
				/>,
			);

			// Failed hooks show X
			expect(lastFrame()).toContain("✗");
			expect(lastFrame()).toContain("Stop");
		});

		test("shows hook counts on completion", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);
			const hookResults = new Map<string, HookResult[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", success: false, output: ["Test failed: expected 1 to be 2"] }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={hookResults}
					currentType={null}
					isComplete={true}
					verbose={false}
				/>,
			);

			// Shows counts in format (passed/total)
			expect(lastFrame()).toContain("0/1");
		});
	});

	describe("timeout indication", () => {
		test("shows failed indicator for timed out hooks", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);
			const hookResults = new Map<string, HookResult[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", success: false, output: [], timedOut: true }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={hookResults}
					currentType={null}
					isComplete={true}
					verbose={false}
				/>,
			);

			// Timed out hooks show as failed
			expect(lastFrame()).toContain("✗");
		});
	});

	describe("empty states", () => {
		test("renders with empty hook types", () => {
			const { lastFrame } = render(
				<HookTestUI
					hookTypes={[]}
					hookStructure={new Map()}
					hookResults={new Map()}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("Hook Test");
		});

		test("renders with no results", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={new Map()}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			expect(lastFrame()).toContain("Stop");
			expect(lastFrame()).toContain("(0/1)");
		});
	});

	describe("verbose mode", () => {
		test("shows hook results when verbose and complete", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);
			const hookResults = new Map<string, HookResult[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", success: true, output: ["All tests passed"] }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={hookResults}
					currentType={null}
					isComplete={true}
					verbose={true}
				/>,
			);

			// Even in verbose mode, completion output is written to stdout
			// The component shows the summary with checkmark
			expect(lastFrame()).toContain("✓");
			expect(lastFrame()).toContain("Stop");
		});
	});

	describe("cursor selection", () => {
		test("shows selection cursor indicator", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={new Map()}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			// Selection indicator
			expect(lastFrame()).toContain("▸");
		});
	});

	describe("expand/collapse indicators", () => {
		test("shows expand indicator for collapsed items", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" }]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={new Map()}
					currentType={null}
					isComplete={false}
					verbose={false}
				/>,
			);

			// Collapsed indicator
			expect(lastFrame()).toContain("▸");
		});
	});

	describe("mixed states", () => {
		test("handles mix of passed and failed hooks", () => {
			const hookStructure = new Map<string, HookStructureItem[]>([
				["Stop", [
					{ plugin: "jutsu-bun", command: "bun test", pluginDir: "/plugins/jutsu-bun", type: "command" },
					{ plugin: "jutsu-biome", command: "biome check", pluginDir: "/plugins/jutsu-biome", type: "command" },
				]],
			]);
			const hookResults = new Map<string, HookResult[]>([
				["Stop", [
					{ plugin: "jutsu-bun", command: "bun test", success: true, output: [] },
					{ plugin: "jutsu-biome", command: "biome check", success: false, output: ["Error"] },
				]],
			]);

			const { lastFrame } = render(
				<HookTestUI
					hookTypes={["Stop"]}
					hookStructure={hookStructure}
					hookResults={hookResults}
					currentType={null}
					isComplete={true}
					verbose={false}
				/>,
			);

			// Shows as failed because some hooks failed
			expect(lastFrame()).toContain("✗");
			// Shows partial success count
			expect(lastFrame()).toContain("1/2");
		});
	});
});
