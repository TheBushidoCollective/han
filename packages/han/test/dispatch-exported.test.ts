/**
 * Tests for exported functions in dispatch.ts
 * These tests directly call the exported functions to ensure coverage
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Command } from "commander";
import {
	deriveHookName,
	registerHookDispatch,
	resolveToAbsolute,
} from "../lib/commands/hook/dispatch.ts";

describe("dispatch.ts exported functions", () => {
	describe("resolveToAbsolute", () => {
		const originalCwd = process.cwd();

		afterEach(() => {
			try {
				process.chdir(originalCwd);
			} catch {
				// Already at original cwd
			}
		});

		test("returns absolute path unchanged", () => {
			expect(resolveToAbsolute("/usr/local/bin")).toBe("/usr/local/bin");
			expect(resolveToAbsolute("/home/user/project")).toBe(
				"/home/user/project",
			);
			expect(resolveToAbsolute("/")).toBe("/");
		});

		test("resolves relative path to absolute", () => {
			const cwd = process.cwd();
			expect(resolveToAbsolute("src")).toBe(join(cwd, "src"));
			expect(resolveToAbsolute("lib/commands")).toBe(join(cwd, "lib/commands"));
		});

		test("resolves ./ prefix", () => {
			const cwd = process.cwd();
			expect(resolveToAbsolute("./config")).toBe(join(cwd, "./config"));
		});

		test("resolves ../ prefix", () => {
			const cwd = process.cwd();
			expect(resolveToAbsolute("../parent")).toBe(join(cwd, "../parent"));
		});

		test("handles empty string", () => {
			expect(resolveToAbsolute("")).toBe(process.cwd());
		});

		test("handles complex relative paths", () => {
			const cwd = process.cwd();
			expect(resolveToAbsolute("a/b/c/d/e")).toBe(join(cwd, "a/b/c/d/e"));
			expect(resolveToAbsolute("../../up/two")).toBe(join(cwd, "../../up/two"));
		});
	});

	describe("deriveHookName", () => {
		test("extracts name from .md file in hooks directory", () => {
			expect(deriveHookName("cat hooks/test.md", "plugin")).toBe("test");
			expect(deriveHookName("cat hooks/validation.md", "plugin")).toBe(
				"validation",
			);
			expect(deriveHookName("cat hooks/pre-commit.md", "plugin")).toBe(
				"pre-commit",
			);
		});

		test("extracts name from .sh file in hooks directory", () => {
			expect(deriveHookName("bash hooks/test.sh", "plugin")).toBe("test");
			expect(
				// biome-ignore lint/suspicious/noTemplateCurlyInString: testing template
				deriveHookName("${CLAUDE_PLUGIN_ROOT}/hooks/validate.sh", "plugin"),
			).toBe("validate");
		});

		test("handles complex commands with hooks path", () => {
			expect(
				deriveHookName("npx han hook run hooks/quality.md", "plugin"),
			).toBe("quality");
			expect(deriveHookName("/usr/bin/cat hooks/check-123.md", "plugin")).toBe(
				"check-123",
			);
		});

		test("extracts names with numbers", () => {
			expect(deriveHookName("cat hooks/test123.md", "plugin")).toBe("test123");
			expect(deriveHookName("cat hooks/hook2.sh", "plugin")).toBe("hook2");
		});

		test("extracts names with multiple dashes", () => {
			expect(deriveHookName("cat hooks/pre-commit-check.md", "plugin")).toBe(
				"pre-commit-check",
			);
			expect(deriveHookName("cat hooks/a-b-c-d.sh", "plugin")).toBe("a-b-c-d");
		});

		test("falls back to plugin name when no match", () => {
			expect(deriveHookName("npm test", "my-plugin")).toBe("my-plugin");
			expect(deriveHookName("echo hello", "test-plugin")).toBe("test-plugin");
			expect(deriveHookName("node script.js", "fallback")).toBe("fallback");
		});

		test("does not match uppercase letters", () => {
			// Regex only matches [a-z0-9-]+
			expect(deriveHookName("cat hooks/MyHook.md", "plugin")).toBe("plugin");
			expect(deriveHookName("cat hooks/TEST.md", "plugin")).toBe("plugin");
		});

		test("does not match underscores", () => {
			// Regex only matches [a-z0-9-]+
			expect(deriveHookName("cat hooks/my_hook.md", "plugin")).toBe("plugin");
		});

		test("handles edge cases", () => {
			expect(deriveHookName("", "plugin")).toBe("plugin");
			expect(deriveHookName("hooks/test.txt", "plugin")).toBe("plugin"); // .txt not matched
			expect(deriveHookName("other/test.md", "plugin")).toBe("plugin"); // not in hooks/
		});
	});

	describe("registerHookDispatch", () => {
		let hookCommand: Command;
		let _dispatchCommand: Command | null = null;

		beforeEach(() => {
			hookCommand = new Command("hook");

			// Spy on the command method to capture the registered subcommand
			const originalCommand = hookCommand.command.bind(hookCommand);
			hookCommand.command = (nameAndArgs: string) => {
				const cmd = originalCommand(nameAndArgs);
				if (nameAndArgs.includes("dispatch")) {
					_dispatchCommand = cmd;
				}
				return cmd;
			};
		});

		afterEach(() => {
			_dispatchCommand = null;
		});

		test("registers dispatch subcommand", () => {
			registerHookDispatch(hookCommand);

			// Verify that a command was registered
			const commands = hookCommand.commands;
			expect(commands.length).toBeGreaterThan(0);

			// Find the dispatch command
			const dispatch = commands.find((cmd) => cmd.name() === "dispatch");
			expect(dispatch).toBeDefined();
		});

		test("dispatch command requires hookType argument", () => {
			registerHookDispatch(hookCommand);

			const dispatch = hookCommand.commands.find(
				(cmd) => cmd.name() === "dispatch",
			);
			expect(dispatch).toBeDefined();

			// Check the command signature
			const usage = dispatch?.usage();
			expect(usage).toContain("hookType");
		});

		test("dispatch command has --all option", () => {
			registerHookDispatch(hookCommand);

			const dispatch = hookCommand.commands.find(
				(cmd) => cmd.name() === "dispatch",
			);
			expect(dispatch).toBeDefined();

			// Check for --all option
			const options = dispatch?.options || [];
			const allOption = options.find((opt) => opt.long === "--all");
			expect(allOption).toBeDefined();
		});

		test("dispatch command has --no-cache option", () => {
			registerHookDispatch(hookCommand);

			const dispatch = hookCommand.commands.find(
				(cmd) => cmd.name() === "dispatch",
			);
			expect(dispatch).toBeDefined();

			const options = dispatch?.options || [];
			const noCacheOption = options.find((opt) => opt.long === "--no-cache");
			expect(noCacheOption).toBeDefined();
		});

		test("dispatch command has --no-checkpoints option", () => {
			registerHookDispatch(hookCommand);

			const dispatch = hookCommand.commands.find(
				(cmd) => cmd.name() === "dispatch",
			);
			expect(dispatch).toBeDefined();

			const options = dispatch?.options || [];
			const noCheckpointsOption = options.find(
				(opt) => opt.long === "--no-checkpoints",
			);
			expect(noCheckpointsOption).toBeDefined();
		});

		test("dispatch command has description", () => {
			registerHookDispatch(hookCommand);

			const dispatch = hookCommand.commands.find(
				(cmd) => cmd.name() === "dispatch",
			);
			expect(dispatch).toBeDefined();

			const description = dispatch?.description();
			expect(description).toBeTruthy();
			expect(description).toContain("dispatch");
		});
	});
});

describe("dispatch.ts edge cases", () => {
	test("resolveToAbsolute with path containing dots", () => {
		expect(resolveToAbsolute("/path/to/.hidden")).toBe("/path/to/.hidden");
		expect(resolveToAbsolute(".hidden/file")).toBe(
			join(process.cwd(), ".hidden/file"),
		);
	});

	test("resolveToAbsolute with path containing spaces", () => {
		const cwd = process.cwd();
		expect(resolveToAbsolute("my folder")).toBe(join(cwd, "my folder"));
		expect(resolveToAbsolute("/my folder/file")).toBe("/my folder/file");
	});

	test("deriveHookName with very long hook names", () => {
		const longName = "a".repeat(100);
		expect(deriveHookName(`cat hooks/${longName}.md`, "plugin")).toBe(longName);
	});

	test("deriveHookName with single character hook names", () => {
		expect(deriveHookName("cat hooks/a.md", "plugin")).toBe("a");
		expect(deriveHookName("cat hooks/1.sh", "plugin")).toBe("1");
	});

	test("deriveHookName preserves full matched pattern", () => {
		// The regex matches the full hook name including all valid characters
		expect(deriveHookName("cat hooks/test-123-abc-456.md", "plugin")).toBe(
			"test-123-abc-456",
		);
	});
});
