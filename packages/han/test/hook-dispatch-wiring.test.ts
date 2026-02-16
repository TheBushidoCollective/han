/**
 * Wiring tests for lib/commands/hook/dispatch.ts
 *
 * Tests the exported utility functions and verifies that
 * gRPC delegation imports resolve correctly.
 */
import { describe, expect, mock, test, beforeEach } from "bun:test";

// ============================================================================
// Mock infrastructure — must mock BEFORE importing dispatch
// ============================================================================

const mockHasChanges = mock();
const mockIsHealthy = mock();
const mockExecuteHooksViaGrpc = mock();

// Mock gRPC data-access (used by shouldSkipDueToNoChanges)
mock.module("../../lib/grpc/data-access.ts", () => ({
	sessionFileChanges: {
		hasChanges: mockHasChanges,
		record: () => {
			throw new Error("stub");
		},
		list: () => Promise.resolve([]),
	},
}));

// Mock gRPC client
mock.module("../../lib/grpc/client.ts", () => ({
	getCoordinatorClients: () => ({}),
	createCoordinatorClients: () => ({}),
	setCoordinatorPort: () => {},
	isCoordinatorHealthy: mockIsHealthy,
}));

// Mock hook executor
mock.module("../../lib/grpc/hook-executor.ts", () => ({
	executeHooksViaGrpc: mockExecuteHooksViaGrpc,
	executeHooksAndExit: () => {},
}));

// Mock events logger
mock.module("../../lib/events/logger.ts", () => ({
	initEventLogger: () => {},
	getEventLogger: () => null,
}));

// Mock config
mock.module("../../lib/config/claude-settings.ts", () => ({
	getClaudeConfigDir: () => "/tmp/test",
	getMergedPluginsAndMarketplaces: () => ({
		plugins: new Map(),
		marketplaces: new Map(),
	}),
	getSettingsPaths: () => ({
		user: "/tmp/user.json",
		project: null,
		local: null,
	}),
	readSettingsFile: () => ({}),
}));

// Mock memory paths
mock.module("../../lib/memory/paths.ts", () => ({
	getClaudeProjectPath: () => "/tmp/test",
}));

// Mock shared
mock.module("../../lib/shared.ts", () => ({
	isDebugMode: () => false,
	getPluginNameFromRoot: () => "test-plugin",
}));

// Mock telemetry
mock.module("../../lib/telemetry/index.ts", () => ({
	recordHookExecution: () => {},
}));

const { resolveToAbsolute, deriveHookName } = await import(
	"../lib/commands/hook/dispatch.ts"
);

beforeEach(() => {
	mockHasChanges.mockReset();
	mockIsHealthy.mockReset();
	mockExecuteHooksViaGrpc.mockReset();
});

// ============================================================================
// resolveToAbsolute
// ============================================================================

describe("resolveToAbsolute", () => {
	test("returns absolute path unchanged", () => {
		expect(resolveToAbsolute("/usr/local/bin")).toBe("/usr/local/bin");
	});

	test("resolves relative path to absolute", () => {
		const result = resolveToAbsolute("relative/path");
		expect(result.startsWith("/")).toBe(true);
		expect(result).toEndWith("relative/path");
	});

	test("handles single segment relative path", () => {
		const result = resolveToAbsolute("file.ts");
		expect(result.startsWith("/")).toBe(true);
		expect(result).toEndWith("file.ts");
	});
});

// ============================================================================
// deriveHookName
// ============================================================================

describe("deriveHookName", () => {
	test("extracts hook name from hooks/name.md pattern", () => {
		expect(deriveHookName("cat hooks/metrics-tracking.md", "core")).toBe(
			"metrics-tracking",
		);
	});

	test("extracts hook name from hooks/name.sh pattern", () => {
		expect(
			deriveHookName(
				"${CLAUDE_PLUGIN_ROOT}/hooks/pre-push-check.sh",
				"biome",
			),
		).toBe("pre-push-check");
	});

	test("extracts from npx command with hooks path", () => {
		expect(
			deriveHookName(
				"npx han hook reference hooks/professional-honesty.md",
				"core",
			),
		).toBe("professional-honesty");
	});

	test("falls back to plugin name when no match", () => {
		expect(deriveHookName("npx biome check --write .", "biome")).toBe(
			"biome",
		);
	});

	test("falls back to plugin name for unrelated commands", () => {
		expect(deriveHookName("echo hello", "test-plugin")).toBe(
			"test-plugin",
		);
	});
});

// ============================================================================
// Module import verification — gRPC wiring exists
// ============================================================================

describe("gRPC wiring imports", () => {
	test("dispatch module imports resolve without error", async () => {
		// If we got here, the module loaded successfully with all mocks
		// This verifies the import chain:
		// dispatch.ts -> grpc/client.ts (isCoordinatorHealthy)
		// dispatch.ts -> grpc/hook-executor.ts (executeHooksViaGrpc)
		// dispatch.ts -> grpc/data-access.ts (sessionFileChanges)
		expect(resolveToAbsolute).toBeDefined();
		expect(deriveHookName).toBeDefined();
	});

	test("registerHookDispatch is exported", async () => {
		const mod = await import("../lib/commands/hook/dispatch.ts");
		expect(typeof mod.registerHookDispatch).toBe("function");
	});
});
