/**
 * Behavioral tests for lib/grpc/hook-executor.ts
 *
 * Tests the actual streaming logic, stdout/stderr forwarding,
 * exit code selection, and error handling — NOT just exports.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// ============================================================================
// Mock infrastructure
// ============================================================================

/** Create an async iterable from an array of HookOutput-like objects */
function makeStream(outputs: HookOutputLike[]) {
	return (async function* () {
		for (const output of outputs) {
			yield output;
		}
	})();
}

/** Create a stream that throws after yielding some outputs */
function makeErrorStream(outputs: HookOutputLike[], error: Error) {
	return (async function* () {
		for (const output of outputs) {
			yield output;
		}
		throw error;
	})();
}

interface HookOutputLike {
	hookId: string;
	pluginName: string;
	hookName: string;
	payload:
		| { case: "stdoutLine"; value: string }
		| { case: "stderrLine"; value: string }
		| {
				case: "complete";
				value: {
					exitCode: number;
					cached: boolean;
					durationMs: bigint;
					error?: string;
				};
		  };
}

const mockExecuteHooks = mock();

// Mock the gRPC client module BEFORE importing hook-executor
mock.module("../lib/grpc/client.ts", () => ({
	getCoordinatorClients: () => ({
		hooks: { executeHooks: mockExecuteHooks },
		coordinator: {},
		sessions: {},
		indexer: {},
		slots: {},
		memory: {},
	}),
	createCoordinatorClients: () => ({}),
	setCoordinatorPort: () => {},
	isCoordinatorHealthy: () => Promise.resolve(false),
}));

// Now import the functions under test
const { executeHooksViaGrpc, executeHooksAndExit } = await import(
	"../lib/grpc/hook-executor.ts"
);

// ============================================================================
// stdout/stderr capture
// ============================================================================

let stdoutWrites: string[];
let stderrWrites: string[];
let originalStdoutWrite: typeof process.stdout.write;
let originalStderrWrite: typeof process.stderr.write;

beforeEach(() => {
	stdoutWrites = [];
	stderrWrites = [];
	mockExecuteHooks.mockReset();
	originalStdoutWrite = process.stdout.write;
	originalStderrWrite = process.stderr.write;
	process.stdout.write = ((chunk: unknown) => {
		stdoutWrites.push(String(chunk));
		return true;
	}) as typeof process.stdout.write;
	process.stderr.write = ((chunk: unknown) => {
		stderrWrites.push(String(chunk));
		return true;
	}) as typeof process.stderr.write;
});

afterEach(() => {
	process.stdout.write = originalStdoutWrite;
	process.stderr.write = originalStderrWrite;
});

// ============================================================================
// executeHooksViaGrpc tests
// ============================================================================

describe("executeHooksViaGrpc", () => {
	test("collects results from single-hook stream", async () => {
		mockExecuteHooks.mockReturnValueOnce(
			makeStream([
				{
					hookId: "h1",
					pluginName: "biome",
					hookName: "lint",
					payload: { case: "stdoutLine", value: "checking files..." },
				},
				{
					hookId: "h1",
					pluginName: "biome",
					hookName: "lint",
					payload: {
						case: "complete",
						value: { exitCode: 0, cached: false, durationMs: 500n },
					},
				},
			]),
		);

		const results = await executeHooksViaGrpc({ event: "Stop" });

		expect(results).toHaveLength(1);
		expect(results[0].hookId).toBe("h1");
		expect(results[0].pluginName).toBe("biome");
		expect(results[0].hookName).toBe("lint");
		expect(results[0].exitCode).toBe(0);
		expect(results[0].cached).toBe(false);
		expect(results[0].durationMs).toBe(500);
	});

	test("handles multi-hook interleaved stream", async () => {
		mockExecuteHooks.mockReturnValueOnce(
			makeStream([
				{
					hookId: "h1",
					pluginName: "biome",
					hookName: "lint",
					payload: { case: "stdoutLine", value: "biome output" },
				},
				{
					hookId: "h2",
					pluginName: "eslint",
					hookName: "check",
					payload: { case: "stdoutLine", value: "eslint output" },
				},
				{
					hookId: "h1",
					pluginName: "biome",
					hookName: "lint",
					payload: {
						case: "complete",
						value: { exitCode: 0, cached: false, durationMs: 300n },
					},
				},
				{
					hookId: "h2",
					pluginName: "eslint",
					hookName: "check",
					payload: {
						case: "complete",
						value: { exitCode: 1, cached: false, durationMs: 700n },
					},
				},
			]),
		);

		const results = await executeHooksViaGrpc({ event: "Stop" });

		expect(results).toHaveLength(2);
		expect(results[0].pluginName).toBe("biome");
		expect(results[0].exitCode).toBe(0);
		expect(results[1].pluginName).toBe("eslint");
		expect(results[1].exitCode).toBe(1);
	});

	test("forwards stdout lines to process.stdout", async () => {
		mockExecuteHooks.mockReturnValueOnce(
			makeStream([
				{
					hookId: "h1",
					pluginName: "test",
					hookName: "run",
					payload: { case: "stdoutLine", value: "line 1" },
				},
				{
					hookId: "h1",
					pluginName: "test",
					hookName: "run",
					payload: { case: "stdoutLine", value: "line 2" },
				},
				{
					hookId: "h1",
					pluginName: "test",
					hookName: "run",
					payload: {
						case: "complete",
						value: { exitCode: 0, cached: false, durationMs: 100n },
					},
				},
			]),
		);

		await executeHooksViaGrpc({ event: "Stop" });

		expect(stdoutWrites).toContain("line 1\n");
		expect(stdoutWrites).toContain("line 2\n");
	});

	test("forwards stderr lines to process.stderr", async () => {
		mockExecuteHooks.mockReturnValueOnce(
			makeStream([
				{
					hookId: "h1",
					pluginName: "test",
					hookName: "run",
					payload: { case: "stderrLine", value: "warning: something" },
				},
				{
					hookId: "h1",
					pluginName: "test",
					hookName: "run",
					payload: {
						case: "complete",
						value: { exitCode: 0, cached: false, durationMs: 100n },
					},
				},
			]),
		);

		await executeHooksViaGrpc({ event: "Stop" });

		expect(stderrWrites).toContain("warning: something\n");
	});

	test("captures error string from complete payload", async () => {
		mockExecuteHooks.mockReturnValueOnce(
			makeStream([
				{
					hookId: "h1",
					pluginName: "eslint",
					hookName: "check",
					payload: {
						case: "complete",
						value: {
							exitCode: 2,
							cached: false,
							durationMs: 1200n,
							error: "42 lint errors found",
						},
					},
				},
			]),
		);

		const results = await executeHooksViaGrpc({ event: "Stop" });

		expect(results).toHaveLength(1);
		expect(results[0].exitCode).toBe(2);
		expect(results[0].error).toBe("42 lint errors found");
	});

	test("passes correct request fields to gRPC", async () => {
		mockExecuteHooks.mockReturnValueOnce(makeStream([]));

		await executeHooksViaGrpc({
			event: "PreToolUse",
			sessionId: "sess-123",
			toolName: "Bash",
			toolInput: '{"command":"echo hi"}',
			cwd: "/tmp/test",
		});

		expect(mockExecuteHooks).toHaveBeenCalledTimes(1);
		const callArg = mockExecuteHooks.mock.calls[0][0];
		expect(callArg.event).toBe("PreToolUse");
		expect(callArg.sessionId).toBe("sess-123");
		expect(callArg.toolName).toBe("Bash");
		expect(callArg.toolInput).toBe('{"command":"echo hi"}');
		expect(callArg.cwd).toBe("/tmp/test");
	});

	test("defaults cwd to process.cwd() when not provided", async () => {
		mockExecuteHooks.mockReturnValueOnce(makeStream([]));

		await executeHooksViaGrpc({ event: "Stop" });

		const callArg = mockExecuteHooks.mock.calls[0][0];
		expect(callArg.cwd).toBe(process.cwd());
	});

	test("propagates stream errors as exceptions", async () => {
		mockExecuteHooks.mockReturnValueOnce(
			makeErrorStream([], new Error("connection refused")),
		);

		await expect(
			executeHooksViaGrpc({ event: "Stop" }),
		).rejects.toThrow("connection refused");
	});

	test("returns empty results for empty stream", async () => {
		mockExecuteHooks.mockReturnValueOnce(makeStream([]));

		const results = await executeHooksViaGrpc({ event: "SessionStart" });

		expect(results).toEqual([]);
	});

	test("handles cached hook result", async () => {
		mockExecuteHooks.mockReturnValueOnce(
			makeStream([
				{
					hookId: "h1",
					pluginName: "biome",
					hookName: "lint",
					payload: {
						case: "complete",
						value: { exitCode: 0, cached: true, durationMs: 5n },
					},
				},
			]),
		);

		const results = await executeHooksViaGrpc({ event: "Stop" });

		expect(results[0].cached).toBe(true);
		expect(results[0].durationMs).toBe(5);
	});
});

// ============================================================================
// executeHooksAndExit tests
//
// process.exit mock must NOT throw, otherwise the try/catch in
// executeHooksAndExit catches the throw and calls process.exit(1).
// ============================================================================

describe("executeHooksAndExit", () => {
	let exitCode: number | undefined;
	let originalExit: typeof process.exit;

	beforeEach(() => {
		exitCode = undefined;
		originalExit = process.exit;
		// Non-throwing mock: just record the exit code
		process.exit = ((code?: number) => {
			if (exitCode === undefined) {
				exitCode = code ?? 0;
			}
		}) as never;
	});

	afterEach(() => {
		process.exit = originalExit;
	});

	test("exits with worst exit code when multiple hooks", async () => {
		mockExecuteHooks.mockReturnValueOnce(
			makeStream([
				{
					hookId: "h1",
					pluginName: "biome",
					hookName: "lint",
					payload: {
						case: "complete",
						value: { exitCode: 0, cached: false, durationMs: 100n },
					},
				},
				{
					hookId: "h2",
					pluginName: "eslint",
					hookName: "check",
					payload: {
						case: "complete",
						value: { exitCode: 2, cached: false, durationMs: 200n },
					},
				},
			]),
		);

		await executeHooksAndExit({ event: "Stop" });
		expect(exitCode).toBe(2);
	});

	test("exits 0 when all hooks succeed", async () => {
		mockExecuteHooks.mockReturnValueOnce(
			makeStream([
				{
					hookId: "h1",
					pluginName: "biome",
					hookName: "lint",
					payload: {
						case: "complete",
						value: { exitCode: 0, cached: false, durationMs: 100n },
					},
				},
			]),
		);

		await executeHooksAndExit({ event: "Stop" });
		expect(exitCode).toBe(0);
	});

	test("exits 1 on stream error", async () => {
		mockExecuteHooks.mockReturnValueOnce(
			makeErrorStream([], new Error("connection refused")),
		);

		await executeHooksAndExit({ event: "Stop" });
		expect(exitCode).toBe(1);
	});

	test("exits 0 for empty stream (no hooks to run)", async () => {
		mockExecuteHooks.mockReturnValueOnce(makeStream([]));

		await executeHooksAndExit({ event: "SessionStart" });
		expect(exitCode).toBe(0);
	});
});
