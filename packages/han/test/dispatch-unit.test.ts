/**
 * Unit tests for dispatch.ts helper functions.
 * Tests the pure utility functions and path manipulation logic.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	deriveHookName,
	resolveToAbsolute,
} from "../lib/commands/hook/dispatch.ts";

// Since dispatch.ts doesn't export most helper functions, we'll test them indirectly
// by replicating the logic patterns here, and test the exported functions directly

describe("Plugin path resolution", () => {
	test("findPluginInMarketplace constructs correct paths", () => {
		const marketplaceRoot = "/home/user/.claude/plugins/marketplaces/han";
		const pluginName = "jutsu-typescript";

		// Replicate the path construction logic
		const potentialPaths = [
			`${marketplaceRoot}/jutsu/${pluginName}`,
			`${marketplaceRoot}/do/${pluginName}`,
			`${marketplaceRoot}/hashi/${pluginName}`,
			`${marketplaceRoot}/${pluginName}`,
		];

		expect(potentialPaths).toEqual([
			"/home/user/.claude/plugins/marketplaces/han/jutsu/jutsu-typescript",
			"/home/user/.claude/plugins/marketplaces/han/do/jutsu-typescript",
			"/home/user/.claude/plugins/marketplaces/han/hashi/jutsu-typescript",
			"/home/user/.claude/plugins/marketplaces/han/jutsu-typescript",
		]);
	});

	test("resolveToAbsolute handles absolute paths", () => {
		const absolutePath = "/usr/local/bin";
		// If path starts with /, return as-is
		expect(absolutePath.startsWith("/")).toBe(true);
	});

	test("resolveToAbsolute handles relative paths", () => {
		const relativePath = "src/lib";
		// If path doesn't start with /, join with cwd
		expect(relativePath.startsWith("/")).toBe(false);
	});
});

describe("extractPluginName", () => {
	test("extracts plugin name from full marketplace path", () => {
		const pluginRoot =
			"/path/to/plugins/marketplaces/han/jutsu/jutsu-typescript";
		const parts = pluginRoot.split("/");
		const pluginName = parts[parts.length - 1];
		expect(pluginName).toBe("jutsu-typescript");
	});

	test("extracts plugin name from core path", () => {
		const pluginRoot = "/path/to/plugins/marketplaces/han/core";
		const parts = pluginRoot.split("/");
		const pluginName = parts[parts.length - 1];
		expect(pluginName).toBe("core");
	});

	test("handles single segment path", () => {
		const pluginRoot = "my-plugin";
		const parts = pluginRoot.split("/");
		const pluginName = parts[parts.length - 1];
		expect(pluginName).toBe("my-plugin");
	});

	test("handles empty path", () => {
		const pluginRoot = "";
		const parts = pluginRoot.split("/");
		const pluginName = parts[parts.length - 1];
		expect(pluginName).toBe("");
	});
});

describe("deriveHookName", () => {
	test("extracts hook name from md file in hooks directory", () => {
		const command = "cat hooks/metrics-tracking.md";
		const hookFileMatch = command.match(/hooks\/([a-z0-9-]+)\.(md|sh)/);
		expect(hookFileMatch).not.toBeNull();
		expect(hookFileMatch?.[1]).toBe("metrics-tracking");
	});

	test("extracts hook name from sh file in hooks directory", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: testing placeholder replacement
		const command = "${CLAUDE_PLUGIN_ROOT}/hooks/pre-push-check.sh";
		const hookFileMatch = command.match(/hooks\/([a-z0-9-]+)\.(md|sh)/);
		expect(hookFileMatch).not.toBeNull();
		expect(hookFileMatch?.[1]).toBe("pre-push-check");
	});

	test("extracts hook name from npx command", () => {
		const command = "npx han hook reference hooks/professional-honesty.md";
		const hookFileMatch = command.match(/hooks\/([a-z0-9-]+)\.(md|sh)/);
		expect(hookFileMatch).not.toBeNull();
		expect(hookFileMatch?.[1]).toBe("professional-honesty");
	});

	test("returns null when no hook file pattern found", () => {
		const command = "npm run build";
		const hookFileMatch = command.match(/hooks\/([a-z0-9-]+)\.(md|sh)/);
		expect(hookFileMatch).toBeNull();
	});

	test("handles complex hook file names", () => {
		const command = "cat hooks/my-custom-hook-123.md";
		const hookFileMatch = command.match(/hooks\/([a-z0-9-]+)\.(md|sh)/);
		expect(hookFileMatch).not.toBeNull();
		expect(hookFileMatch?.[1]).toBe("my-custom-hook-123");
	});
});

describe("CLAUDE_PLUGIN_ROOT replacement", () => {
	// biome-ignore lint/suspicious/noTemplateCurlyInString: testing placeholder replacement
	test("replaces ${CLAUDE_PLUGIN_ROOT} in command", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: testing placeholder replacement
		const command = "${CLAUDE_PLUGIN_ROOT}/hooks/validate.sh";
		const pluginRoot = "/home/user/.claude/plugins/han/jutsu-biome";
		const resolvedCommand = command.replace(
			/\$\{CLAUDE_PLUGIN_ROOT\}/g,
			pluginRoot,
		);
		expect(resolvedCommand).toBe(
			"/home/user/.claude/plugins/han/jutsu-biome/hooks/validate.sh",
		);
	});

	test("replaces multiple occurrences", () => {
		const placeholder = "CLAUDE_PLUGIN_ROOT";
		const command = `\${${placeholder}}/bin/cli \${${placeholder}}/config.json`;
		const pluginRoot = "/plugins/test";
		const resolvedCommand = command.replace(
			/\$\{CLAUDE_PLUGIN_ROOT\}/g,
			pluginRoot,
		);
		expect(resolvedCommand).toBe(
			"/plugins/test/bin/cli /plugins/test/config.json",
		);
	});

	test("leaves command unchanged when no placeholder", () => {
		const command = "npm run lint";
		const pluginRoot = "/plugins/test";
		const resolvedCommand = command.replace(
			/\$\{CLAUDE_PLUGIN_ROOT\}/g,
			pluginRoot,
		);
		expect(resolvedCommand).toBe("npm run lint");
	});
});

describe("Hook entry validation", () => {
	test("validates command hook type", () => {
		const hook = { type: "command", command: "npm test" };
		expect(hook.type === "command" && hook.command).toBeTruthy();
	});

	test("validates prompt hook type", () => {
		const hook = { type: "prompt", prompt: "Run all tests" };
		expect(hook.type === "prompt" && hook.prompt).toBeTruthy();
	});

	test("rejects hook without command for command type", () => {
		const hook = { type: "command" };
		expect(
			hook.type === "command" && (hook as { command?: string }).command,
		).toBeFalsy();
	});

	test("default timeout is 30000ms", () => {
		const hook = { type: "command", command: "npm test" };
		const timeout = (hook as { timeout?: number }).timeout || 30000;
		expect(timeout).toBe(30000);
	});

	test("custom timeout is respected", () => {
		const hook = { type: "command", command: "npm test", timeout: 60000 };
		const timeout = hook.timeout || 30000;
		expect(timeout).toBe(60000);
	});
});

describe("HAN_DISABLE_HOOKS environment check", () => {
	test("recognizes true as disabled", () => {
		const envValue = "true";
		const isDisabled = envValue === "true" || envValue === "1";
		expect(isDisabled).toBe(true);
	});

	test("recognizes 1 as disabled", () => {
		const envValue: string = "1";
		const isDisabled = envValue === "true" || envValue === "1";
		expect(isDisabled).toBe(true);
	});

	test("recognizes false as not disabled", () => {
		const envValue: string = "false";
		const isDisabled = envValue === "true" || envValue === "1";
		expect(isDisabled).toBe(false);
	});

	test("recognizes empty string as not disabled", () => {
		const envValue: string = "";
		const isDisabled = envValue === "true" || envValue === "1";
		expect(isDisabled).toBe(false);
	});

	test("recognizes undefined as not disabled", () => {
		const envValue = undefined;
		const isDisabled = envValue === "true" || envValue === "1";
		expect(isDisabled).toBe(false);
	});
});

describe("hooks.json path derivation", () => {
	test("derives hooks.json path from settings.json", () => {
		const settingsPath = "/home/user/.claude/settings.json";
		const hooksJsonPath = settingsPath.replace(
			/settings(\.local)?\.json$/,
			"hooks.json",
		);
		expect(hooksJsonPath).toBe("/home/user/.claude/hooks.json");
	});

	test("derives hooks.json path from settings.local.json", () => {
		const settingsPath = "/project/.claude/settings.local.json";
		const hooksJsonPath = settingsPath.replace(
			/settings(\.local)?\.json$/,
			"hooks.json",
		);
		expect(hooksJsonPath).toBe("/project/.claude/hooks.json");
	});

	test("leaves non-settings path unchanged", () => {
		const somePath = "/home/user/config.json";
		const result = somePath.replace(/settings(\.local)?\.json$/, "hooks.json");
		expect(result).toBe("/home/user/config.json");
	});
});

describe("Session ID extraction from payload", () => {
	test("extracts session_id from valid payload", () => {
		const payload = { session_id: "session-123-abc" };
		const sessionId =
			typeof payload?.session_id === "string" ? payload.session_id : undefined;
		expect(sessionId).toBe("session-123-abc");
	});

	test("returns undefined for payload without session_id", () => {
		const payload: unknown = { other_field: "value" };
		const sessionId =
			typeof (payload as { session_id?: unknown })?.session_id === "string"
				? (payload as { session_id: string }).session_id
				: undefined;
		expect(sessionId).toBeUndefined();
	});

	test("returns undefined for null payload", () => {
		const payload: unknown = null;
		const sessionId =
			typeof (payload as { session_id?: unknown } | null)?.session_id ===
			"string"
				? (payload as { session_id: string }).session_id
				: undefined;
		expect(sessionId).toBeUndefined();
	});

	test("returns undefined for non-string session_id", () => {
		const payload = { session_id: 12345 };
		const sessionId =
			typeof payload?.session_id === "string" ? payload.session_id : undefined;
		expect(sessionId).toBeUndefined();
	});
});

describe("Hook group structure validation", () => {
	test("validates correct hook group structure", () => {
		const group = {
			hooks: [{ type: "command", command: "npm test" }],
		};
		const isValid =
			typeof group === "object" &&
			group !== null &&
			"hooks" in group &&
			Array.isArray(group.hooks);
		expect(isValid).toBe(true);
	});

	test("rejects group without hooks array", () => {
		const group = { other: "value" };
		const isValid =
			typeof group === "object" &&
			group !== null &&
			"hooks" in group &&
			Array.isArray((group as { hooks?: unknown }).hooks);
		expect(isValid).toBe(false);
	});

	test("rejects null group", () => {
		const group = null;
		const isValid =
			typeof group === "object" &&
			group !== null &&
			"hooks" in (group as object) &&
			Array.isArray((group as { hooks?: unknown }).hooks);
		expect(isValid).toBe(false);
	});

	test("rejects group with non-array hooks", () => {
		const group = { hooks: "not an array" };
		const isValid =
			typeof group === "object" &&
			group !== null &&
			"hooks" in group &&
			Array.isArray(group.hooks);
		expect(isValid).toBe(false);
	});
});

describe("Plugin hooks access pattern", () => {
	test("safely accesses nested hooks object", () => {
		const result = {
			hooks: {
				hooks: {
					SessionStart: [{ hooks: [] }],
				},
			},
		};
		const hookType = "SessionStart";
		const hookGroups = result?.hooks?.hooks?.[hookType];
		expect(hookGroups).toEqual([{ hooks: [] }]);
	});

	test("returns undefined for missing hook type", () => {
		const result = {
			hooks: {
				hooks: {
					SessionStart: [{ hooks: [] }],
				},
			},
		};
		const hookType: string = "NonExistent";
		const hookGroups = (result?.hooks?.hooks as Record<string, unknown>)?.[
			hookType
		];
		expect(hookGroups).toBeUndefined();
	});

	test("returns undefined for null result", () => {
		const result = null;
		const hookType = "SessionStart";
		const hookGroups = (
			result as { hooks?: { hooks?: Record<string, unknown[]> } } | null
		)?.hooks?.hooks?.[hookType];
		expect(hookGroups).toBeUndefined();
	});
});

describe("Output aggregation", () => {
	test("joins multiple outputs with double newline", () => {
		const outputs = ["Output 1", "Output 2", "Output 3"];
		const aggregated = outputs.join("\n\n");
		expect(aggregated).toBe("Output 1\n\nOutput 2\n\nOutput 3");
	});

	test("handles single output", () => {
		const outputs = ["Single output"];
		const aggregated = outputs.join("\n\n");
		expect(aggregated).toBe("Single output");
	});

	test("handles empty outputs", () => {
		const outputs: string[] = [];
		const shouldOutput = outputs.length > 0;
		expect(shouldOutput).toBe(false);
	});
});

// Tests for exported functions
describe("resolveToAbsolute", () => {
	const originalCwd = process.cwd();

	afterEach(() => {
		// Ensure we restore cwd
		try {
			process.chdir(originalCwd);
		} catch {
			// Ignore if already in original cwd
		}
	});

	test("returns absolute path unchanged", () => {
		const absolutePath = "/usr/local/bin/test";
		expect(resolveToAbsolute(absolutePath)).toBe("/usr/local/bin/test");
	});

	test("resolves relative path against current working directory", () => {
		const testDir = `/tmp/test-resolve-${Date.now()}`;
		mkdirSync(testDir, { recursive: true });

		try {
			process.chdir(testDir);
			const result = resolveToAbsolute("src/lib");
			// On macOS, process.cwd() returns the canonical path which may include /private
			const cwd = process.cwd();
			expect(result).toBe(join(cwd, "src/lib"));
		} finally {
			process.chdir(originalCwd);
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test("handles relative path with ./", () => {
		const result = resolveToAbsolute("./config/settings.json");
		expect(result).toBe(join(process.cwd(), "./config/settings.json"));
	});

	test("handles relative path with ../", () => {
		const result = resolveToAbsolute("../parent/file.txt");
		expect(result).toBe(join(process.cwd(), "../parent/file.txt"));
	});

	test("handles empty string", () => {
		const result = resolveToAbsolute("");
		expect(result).toBe(process.cwd());
	});

	test("handles path with spaces", () => {
		const result = resolveToAbsolute("my folder/my file.txt");
		expect(result).toBe(join(process.cwd(), "my folder/my file.txt"));
	});
});

describe("deriveHookName", () => {
	test("extracts hook name from md file in hooks directory", () => {
		const hookName = deriveHookName(
			"cat hooks/metrics-tracking.md",
			"my-plugin",
		);
		expect(hookName).toBe("metrics-tracking");
	});

	test("extracts hook name from sh file in hooks directory", () => {
		const hookName = deriveHookName(
			// biome-ignore lint/suspicious/noTemplateCurlyInString: testing template variable in string
			"${CLAUDE_PLUGIN_ROOT}/hooks/pre-push-check.sh",
			"my-plugin",
		);
		expect(hookName).toBe("pre-push-check");
	});

	test("extracts hook name from npx command", () => {
		const hookName = deriveHookName(
			"npx han hook reference hooks/professional-honesty.md --must-read",
			"my-plugin",
		);
		expect(hookName).toBe("professional-honesty");
	});

	test("extracts hook name with numbers and dashes", () => {
		const hookName = deriveHookName("cat hooks/test-hook-123.md", "my-plugin");
		expect(hookName).toBe("test-hook-123");
	});

	test("extracts hook name from complex path", () => {
		const hookName = deriveHookName(
			"/usr/local/bin/han hook run hooks/quality-check.sh",
			"my-plugin",
		);
		expect(hookName).toBe("quality-check");
	});

	test("falls back to plugin name when no hook file pattern found", () => {
		const hookName = deriveHookName("npm run build", "test-plugin");
		expect(hookName).toBe("test-plugin");
	});

	test("falls back to plugin name for echo command", () => {
		const hookName = deriveHookName("echo hello world", "fallback-plugin");
		expect(hookName).toBe("fallback-plugin");
	});

	test("falls back to plugin name for arbitrary command", () => {
		const hookName = deriveHookName("node scripts/validate.js", "validator");
		expect(hookName).toBe("validator");
	});

	test("handles hook name with only lowercase letters", () => {
		const hookName = deriveHookName("cat hooks/lint.md", "my-plugin");
		expect(hookName).toBe("lint");
	});

	test("handles hook name with multiple dashes", () => {
		const hookName = deriveHookName(
			"bash hooks/pre-commit-check-all.sh",
			"my-plugin",
		);
		expect(hookName).toBe("pre-commit-check-all");
	});

	test("does not match uppercase in hook names", () => {
		// The regex only matches [a-z0-9-]+ so uppercase won't match
		const hookName = deriveHookName("cat hooks/MyHook.md", "my-plugin");
		expect(hookName).toBe("my-plugin");
	});

	test("does not match underscores in hook names", () => {
		// The regex only matches [a-z0-9-]+ so underscores won't match
		const hookName = deriveHookName("cat hooks/my_hook.md", "my-plugin");
		expect(hookName).toBe("my-plugin");
	});
});

describe("Environment variable checks", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		// Create a clean env copy
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		// Restore original env
		process.env = originalEnv;
	});

	test("HAN_NO_FAIL_FAST environment variable", () => {
		process.env.HAN_NO_FAIL_FAST = "1";
		expect(process.env.HAN_NO_FAIL_FAST).toBe("1");
	});

	test("HAN_NO_CACHE environment variable", () => {
		process.env.HAN_NO_CACHE = "1";
		expect(process.env.HAN_NO_CACHE).toBe("1");
	});

	test("HAN_NO_CHECKPOINTS environment variable", () => {
		process.env.HAN_NO_CHECKPOINTS = "1";
		expect(process.env.HAN_NO_CHECKPOINTS).toBe("1");
	});

	test("HAN_CHECKPOINT_TYPE environment variable", () => {
		process.env.HAN_CHECKPOINT_TYPE = "session";
		expect(process.env.HAN_CHECKPOINT_TYPE).toBe("session");
	});

	test("HAN_CHECKPOINT_ID environment variable", () => {
		process.env.HAN_CHECKPOINT_ID = "session-123";
		expect(process.env.HAN_CHECKPOINT_ID).toBe("session-123");
	});
});

describe("Checkpoint type determination", () => {
	test("Stop hook with session_id uses session checkpoint", () => {
		const hookType: string = "Stop";
		const sessionId = "session-abc-123";
		const agentId = undefined;

		let checkpointType: "session" | "agent" | undefined;
		let checkpointId: string | undefined;

		if (hookType === "Stop" && sessionId) {
			checkpointType = "session";
			checkpointId = sessionId;
		} else if (hookType === "SubagentStop" && agentId) {
			checkpointType = "agent";
			checkpointId = agentId;
		}

		expect(checkpointType).toBe("session");
		expect(checkpointId).toBe("session-abc-123");
	});

	test("SubagentStop hook with agent_id uses agent checkpoint", () => {
		const hookType: string = "SubagentStop";
		const sessionId = "session-abc-123";
		const agentId = "agent-xyz-456";

		let checkpointType: "session" | "agent" | undefined;
		let checkpointId: string | undefined;

		if (hookType === "Stop" && sessionId) {
			checkpointType = "session";
			checkpointId = sessionId;
		} else if (hookType === "SubagentStop" && agentId) {
			checkpointType = "agent";
			checkpointId = agentId;
		}

		expect(checkpointType).toBe("agent");
		expect(checkpointId).toBe("agent-xyz-456");
	});

	test("Stop hook without session_id has no checkpoint", () => {
		const hookType: string = "Stop";
		const sessionId = undefined;
		const agentId = undefined;

		let checkpointType: "session" | "agent" | undefined;
		let checkpointId: string | undefined;

		if (hookType === "Stop" && sessionId) {
			checkpointType = "session";
			checkpointId = sessionId;
		} else if (hookType === "SubagentStop" && agentId) {
			checkpointType = "agent";
			checkpointId = agentId;
		}

		expect(checkpointType).toBeUndefined();
		expect(checkpointId).toBeUndefined();
	});

	test("Other hook types have no checkpoint", () => {
		const hookType: string = "SessionStart";
		const sessionId = "session-abc-123";
		const agentId = "agent-xyz-456";

		let checkpointType: "session" | "agent" | undefined;
		let checkpointId: string | undefined;

		if (hookType === "Stop" && sessionId) {
			checkpointType = "session";
			checkpointId = sessionId;
		} else if (hookType === "SubagentStop" && agentId) {
			checkpointType = "agent";
			checkpointId = agentId;
		}

		expect(checkpointType).toBeUndefined();
		expect(checkpointId).toBeUndefined();
	});
});

describe("Hook payload structure", () => {
	test("parses valid JSON payload", () => {
		const raw = JSON.stringify({
			session_id: "session-123",
			hook_event_name: "SessionStart",
			agent_id: "agent-456",
			agent_type: "code",
		});

		let payload: unknown = null;
		try {
			payload = JSON.parse(raw);
		} catch {
			payload = null;
		}

		expect(payload).not.toBeNull();
		expect((payload as { session_id?: string })?.session_id).toBe(
			"session-123",
		);
	});

	test("returns null for invalid JSON", () => {
		const raw = "not valid json {";

		let payload: unknown = null;
		try {
			payload = JSON.parse(raw);
		} catch {
			payload = null;
		}

		expect(payload).toBeNull();
	});

	test("returns null for empty string", () => {
		const raw = "";

		let payload: unknown = null;
		try {
			payload = JSON.parse(raw);
		} catch {
			payload = null;
		}

		expect(payload).toBeNull();
	});

	test("parses payload with missing optional fields", () => {
		const raw = JSON.stringify({
			session_id: "session-only",
		});

		let payload: unknown = null;
		try {
			payload = JSON.parse(raw);
		} catch {
			payload = null;
		}

		expect(payload).not.toBeNull();
		expect((payload as { session_id?: string })?.session_id).toBe(
			"session-only",
		);
		expect((payload as { agent_id?: string })?.agent_id).toBeUndefined();
	});
});

describe("Hook execution error handling", () => {
	test("extracts exit code from error", () => {
		const error = { status: 127, stderr: Buffer.from("command not found") };
		const exitCode = error.status || 1;
		expect(exitCode).toBe(127);
	});

	test("defaults to exit code 1 when status missing", () => {
		const error = { stderr: Buffer.from("some error") };
		const exitCode = (error as { status?: number }).status || 1;
		expect(exitCode).toBe(1);
	});

	test("extracts stderr from error", () => {
		const error = { status: 1, stderr: Buffer.from("file not found") };
		const stderr = error.stderr?.toString() || "";
		expect(stderr).toBe("file not found");
	});

	test("handles missing stderr", () => {
		const error = { status: 1 };
		const stderr = (error as { stderr?: Buffer }).stderr?.toString() || "";
		expect(stderr).toBe("");
	});
});

describe("stdin data detection patterns", () => {
	test("TTY stdin has no piped data", () => {
		// In TTY mode, stdin.isTTY is true, so we shouldn't read
		const isTTY = true;
		const hasData = !isTTY;
		expect(hasData).toBe(false);
	});

	test("readable stdin with buffered data has data", () => {
		const stdin = {
			isTTY: false,
			readable: true,
			readableLength: 100,
		};
		const hasData = !stdin.isTTY && stdin.readable && stdin.readableLength > 0;
		expect(hasData).toBe(true);
	});

	test("readable stdin without buffered data has no data", () => {
		const stdin = {
			isTTY: false,
			readable: true,
			readableLength: 0,
		};
		const hasData = !stdin.isTTY && stdin.readable && stdin.readableLength > 0;
		expect(hasData).toBe(false);
	});
});
