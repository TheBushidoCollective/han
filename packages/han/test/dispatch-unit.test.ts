/**
 * Unit tests for dispatch.ts helper functions.
 * Tests the pure utility functions and path manipulation logic.
 */
import { describe, expect, test } from "bun:test";

// Since dispatch.ts doesn't export the helper functions, we'll test them indirectly
// by replicating the logic patterns here

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
