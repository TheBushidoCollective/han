/**
 * Tests for shell completion system
 */
import { describe, expect, test } from "bun:test";

describe("completion", () => {
	describe("shell script generation", () => {
		describe("bash completion", () => {
			test("generates valid bash completion script", async () => {
				const { generateBashCompletion } = await import(
					"../lib/commands/completion/bash.ts"
				);
				const script = generateBashCompletion();

				expect(script).toContain("_han_completions()");
				expect(script).toContain("complete -F _han_completions han");
				expect(script).toContain("COMPREPLY=");
			});

			test("includes installation instructions", async () => {
				const { generateBashCompletion } = await import(
					"../lib/commands/completion/bash.ts"
				);
				const script = generateBashCompletion();

				expect(script).toContain("~/.bashrc");
				expect(script).toContain("han completion bash");
			});

			test("calls han --get-completions for dynamic completion", async () => {
				const { generateBashCompletion } = await import(
					"../lib/commands/completion/bash.ts"
				);
				const script = generateBashCompletion();

				expect(script).toContain("han --get-completions");
			});
		});

		describe("zsh completion", () => {
			test("generates valid zsh completion script", async () => {
				const { generateZshCompletion } = await import(
					"../lib/commands/completion/zsh.ts"
				);
				const script = generateZshCompletion();

				expect(script).toContain("#compdef han");
				expect(script).toContain("_han()");
				expect(script).toContain("compdef _han han");
			});

			test("includes installation instructions", async () => {
				const { generateZshCompletion } = await import(
					"../lib/commands/completion/zsh.ts"
				);
				const script = generateZshCompletion();

				expect(script).toContain("~/.zshrc");
				expect(script).toContain("han completion zsh");
			});

			test("handles descriptions in completions", async () => {
				const { generateZshCompletion } = await import(
					"../lib/commands/completion/zsh.ts"
				);
				const script = generateZshCompletion();

				expect(script).toContain("completions_with_descriptions");
				expect(script).toContain("_describe");
			});

			test("calls han --get-completions for dynamic completion", async () => {
				const { generateZshCompletion } = await import(
					"../lib/commands/completion/zsh.ts"
				);
				const script = generateZshCompletion();

				expect(script).toContain("han --get-completions");
			});
		});

		describe("fish completion", () => {
			test("generates valid fish completion script", async () => {
				const { generateFishCompletion } = await import(
					"../lib/commands/completion/fish.ts"
				);
				const script = generateFishCompletion();

				expect(script).toContain("function __han_completions");
				expect(script).toContain("complete -c han");
			});

			test("includes installation instructions", async () => {
				const { generateFishCompletion } = await import(
					"../lib/commands/completion/fish.ts"
				);
				const script = generateFishCompletion();

				expect(script).toContain("~/.config/fish/completions/han.fish");
				expect(script).toContain("han completion fish");
			});

			test("disables file completions", async () => {
				const { generateFishCompletion } = await import(
					"../lib/commands/completion/fish.ts"
				);
				const script = generateFishCompletion();

				expect(script).toContain("complete -c han -f");
			});

			test("calls han --get-completions for dynamic completion", async () => {
				const { generateFishCompletion } = await import(
					"../lib/commands/completion/fish.ts"
				);
				const script = generateFishCompletion();

				expect(script).toContain("han --get-completions");
			});
		});
	});

	describe("completions data", () => {
		describe("static completions", () => {
			test("SCOPE_COMPLETIONS has expected values", async () => {
				const { SCOPE_COMPLETIONS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(SCOPE_COMPLETIONS.length).toBe(3);
				expect(SCOPE_COMPLETIONS.find((c) => c.value === "user")).toBeDefined();
				expect(
					SCOPE_COMPLETIONS.find((c) => c.value === "project"),
				).toBeDefined();
				expect(
					SCOPE_COMPLETIONS.find((c) => c.value === "local"),
				).toBeDefined();
			});

			test("SCOPE_WITH_ALL_COMPLETIONS includes all scope", async () => {
				const { SCOPE_WITH_ALL_COMPLETIONS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(SCOPE_WITH_ALL_COMPLETIONS.length).toBe(4);
				expect(
					SCOPE_WITH_ALL_COMPLETIONS.find((c) => c.value === "all"),
				).toBeDefined();
			});

			test("PERIOD_COMPLETIONS has expected values", async () => {
				const { PERIOD_COMPLETIONS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(PERIOD_COMPLETIONS.length).toBe(3);
				expect(PERIOD_COMPLETIONS.find((c) => c.value === "day")).toBeDefined();
				expect(
					PERIOD_COMPLETIONS.find((c) => c.value === "week"),
				).toBeDefined();
				expect(
					PERIOD_COMPLETIONS.find((c) => c.value === "month"),
				).toBeDefined();
			});

			test("TASK_TYPE_COMPLETIONS has expected values", async () => {
				const { TASK_TYPE_COMPLETIONS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(TASK_TYPE_COMPLETIONS.length).toBe(4);
				expect(
					TASK_TYPE_COMPLETIONS.find((c) => c.value === "implementation"),
				).toBeDefined();
				expect(
					TASK_TYPE_COMPLETIONS.find((c) => c.value === "fix"),
				).toBeDefined();
				expect(
					TASK_TYPE_COMPLETIONS.find((c) => c.value === "refactor"),
				).toBeDefined();
				expect(
					TASK_TYPE_COMPLETIONS.find((c) => c.value === "research"),
				).toBeDefined();
			});

			test("LAYER_COMPLETIONS has expected values", async () => {
				const { LAYER_COMPLETIONS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(LAYER_COMPLETIONS.length).toBe(4);
				expect(
					LAYER_COMPLETIONS.find((c) => c.value === "observations"),
				).toBeDefined();
				expect(
					LAYER_COMPLETIONS.find((c) => c.value === "summaries"),
				).toBeDefined();
				expect(
					LAYER_COMPLETIONS.find((c) => c.value === "transcripts"),
				).toBeDefined();
				expect(LAYER_COMPLETIONS.find((c) => c.value === "team")).toBeDefined();
			});

			test("SEVERITY_COMPLETIONS has expected values", async () => {
				const { SEVERITY_COMPLETIONS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(SEVERITY_COMPLETIONS.length).toBe(3);
				expect(
					SEVERITY_COMPLETIONS.find((c) => c.value === "low"),
				).toBeDefined();
				expect(
					SEVERITY_COMPLETIONS.find((c) => c.value === "medium"),
				).toBeDefined();
				expect(
					SEVERITY_COMPLETIONS.find((c) => c.value === "high"),
				).toBeDefined();
			});

			test("SHELL_COMPLETIONS has expected values", async () => {
				const { SHELL_COMPLETIONS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(SHELL_COMPLETIONS.length).toBe(3);
				expect(SHELL_COMPLETIONS.find((c) => c.value === "bash")).toBeDefined();
				expect(SHELL_COMPLETIONS.find((c) => c.value === "zsh")).toBeDefined();
				expect(SHELL_COMPLETIONS.find((c) => c.value === "fish")).toBeDefined();
			});

			test("CHECKPOINT_TYPE_COMPLETIONS has expected values", async () => {
				const { CHECKPOINT_TYPE_COMPLETIONS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(CHECKPOINT_TYPE_COMPLETIONS.length).toBe(2);
				expect(
					CHECKPOINT_TYPE_COMPLETIONS.find((c) => c.value === "session"),
				).toBeDefined();
				expect(
					CHECKPOINT_TYPE_COMPLETIONS.find((c) => c.value === "agent"),
				).toBeDefined();
			});
		});

		describe("COMMANDS structure", () => {
			test("top-level commands are defined", async () => {
				const { COMMANDS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(COMMANDS[""]).toContain("plugin");
				expect(COMMANDS[""]).toContain("hook");
				expect(COMMANDS[""]).toContain("memory");
				expect(COMMANDS[""]).toContain("metrics");
				expect(COMMANDS[""]).toContain("checkpoint");
				expect(COMMANDS[""]).toContain("completion");
			});

			test("plugin subcommands are defined", async () => {
				const { COMMANDS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(COMMANDS.plugin).toContain("install");
				expect(COMMANDS.plugin).toContain("list");
				expect(COMMANDS.plugin).toContain("uninstall");
				expect(COMMANDS.plugin).toContain("search");
			});

			test("hook subcommands are defined", async () => {
				const { COMMANDS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(COMMANDS.hook).toContain("run");
				expect(COMMANDS.hook).toContain("dispatch");
				expect(COMMANDS.hook).toContain("explain");
			});

			test("checkpoint subcommands are defined", async () => {
				const { COMMANDS } = await import(
					"../lib/commands/completion/completions.ts"
				);

				expect(COMMANDS.checkpoint).toContain("capture");
				expect(COMMANDS.checkpoint).toContain("list");
				expect(COMMANDS.checkpoint).toContain("clean");
			});
		});

		describe("CompletionItem interface", () => {
			test("CompletionItem has value field", async () => {
				const item: import("../lib/commands/completion/completions.ts").CompletionItem =
					{
						value: "test",
					};

				expect(item.value).toBe("test");
			});

			test("CompletionItem has optional description", async () => {
				const item: import("../lib/commands/completion/completions.ts").CompletionItem =
					{
						value: "test",
						description: "A test completion",
					};

				expect(item.description).toBe("A test completion");
			});

			test("descriptions are optional", async () => {
				const item: import("../lib/commands/completion/completions.ts").CompletionItem =
					{
						value: "test",
					};

				expect(item.description).toBeUndefined();
			});
		});
	});

	describe("getCompletionsForContext", () => {
		test("returns top-level commands for empty input", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext([]);

			expect(completions.find((c) => c.value === "plugin")).toBeDefined();
			expect(completions.find((c) => c.value === "hook")).toBeDefined();
		});

		test("returns top-level commands when han is first word", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext(["han"]);

			expect(completions.find((c) => c.value === "plugin")).toBeDefined();
		});

		test("filters top-level commands by prefix", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext(["pl"]);

			expect(completions.length).toBe(1);
			expect(completions[0].value).toBe("plugin");
		});

		test("returns subcommands for first-level command", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext(["plugin", ""]);

			expect(completions.find((c) => c.value === "install")).toBeDefined();
			expect(completions.find((c) => c.value === "list")).toBeDefined();
		});

		test("filters subcommands by prefix", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext(["plugin", "in"]);

			expect(completions.length).toBe(1);
			expect(completions[0].value).toBe("install");
		});

		test("returns scope completions for --scope option", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext([
				"plugin",
				"install",
				"--scope",
				"",
			]);

			expect(completions.find((c) => c.value === "user")).toBeDefined();
			expect(completions.find((c) => c.value === "project")).toBeDefined();
			expect(completions.find((c) => c.value === "local")).toBeDefined();
		});

		test("returns scope with all for plugin list --scope", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext([
				"plugin",
				"list",
				"--scope",
				"",
			]);

			expect(completions.find((c) => c.value === "all")).toBeDefined();
		});

		test("returns period completions for --period option", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext([
				"metrics",
				"show",
				"--period",
				"",
			]);

			expect(completions.find((c) => c.value === "day")).toBeDefined();
			expect(completions.find((c) => c.value === "week")).toBeDefined();
			expect(completions.find((c) => c.value === "month")).toBeDefined();
		});

		test("returns layer completions for --layer option", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext([
				"index",
				"run",
				"--layer",
				"",
			]);

			expect(completions.find((c) => c.value === "observations")).toBeDefined();
			expect(completions.find((c) => c.value === "transcripts")).toBeDefined();
		});

		test("returns checkpoint types for checkpoint capture --type", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext([
				"checkpoint",
				"capture",
				"--type",
				"",
			]);

			expect(completions.find((c) => c.value === "session")).toBeDefined();
			expect(completions.find((c) => c.value === "agent")).toBeDefined();
		});

		test("returns task types for --type option", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext([
				"other",
				"command",
				"--type",
				"",
			]);

			expect(
				completions.find((c) => c.value === "implementation"),
			).toBeDefined();
			expect(completions.find((c) => c.value === "fix")).toBeDefined();
		});

		test("returns shell completions for completion command", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext(["completion", ""]);

			expect(completions.find((c) => c.value === "bash")).toBeDefined();
			expect(completions.find((c) => c.value === "zsh")).toBeDefined();
			expect(completions.find((c) => c.value === "fish")).toBeDefined();
		});

		test("returns severity completions for --min-severity option", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext([
				"metrics",
				"detect-patterns",
				"--min-severity",
				"",
			]);

			expect(completions.find((c) => c.value === "low")).toBeDefined();
			expect(completions.find((c) => c.value === "medium")).toBeDefined();
			expect(completions.find((c) => c.value === "high")).toBeDefined();
		});

		test("returns empty array for unknown contexts", async () => {
			const { getCompletionsForContext } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = await getCompletionsForContext([
				"unknown",
				"command",
				"context",
			]);

			expect(completions).toEqual([]);
		});
	});

	describe("getInstalledPluginCompletions", () => {
		test("returns array of CompletionItems", async () => {
			const { getInstalledPluginCompletions } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = getInstalledPluginCompletions();

			expect(Array.isArray(completions)).toBe(true);
		});

		test("deduplicates plugins across scopes", async () => {
			const { getInstalledPluginCompletions } = await import(
				"../lib/commands/completion/completions.ts"
			);

			const completions = getInstalledPluginCompletions();

			// Check that there are no duplicate values
			const values = completions.map((c) => c.value);
			const uniqueValues = [...new Set(values)];
			expect(values.length).toBe(uniqueValues.length);
		});
	});

	describe("index exports", () => {
		test("registerCompletionCommand is exported", async () => {
			const index = await import("../lib/commands/completion/index.ts");

			expect(typeof index.registerCompletionCommand).toBe("function");
		});

		test("handleGetCompletions is exported", async () => {
			const index = await import("../lib/commands/completion/index.ts");

			expect(typeof index.handleGetCompletions).toBe("function");
		});
	});
});
