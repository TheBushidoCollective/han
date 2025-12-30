/**
 * Unit tests for checkpoint CLI commands
 * Tests command handlers for capture, clean, list, and registration
 */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import * as legacyCheckpointModule from "../lib/checkpoint.ts";
import * as captureModule from "../lib/commands/checkpoint/capture.ts";
import * as cleanModule from "../lib/commands/checkpoint/clean.ts";
import { registerCheckpointCommands } from "../lib/commands/checkpoint/index.ts";
import * as listModule from "../lib/commands/checkpoint/list.ts";
import * as hooksCheckpointModule from "../lib/hooks/checkpoint.ts";

// Store original environment and methods
const originalEnv = { ...process.env };
const originalExit = process.exit;
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalStdin = process.stdin;

let testDir: string;
let configDir: string;
let projectDir: string;
let consoleOutput: string[] = [];
let consoleErrors: string[] = [];
let exitCode: number | null = null;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-checkpoint-cli-test-${Date.now()}-${random}`);
	configDir = join(testDir, ".claude");
	projectDir = join(testDir, "project");
	mkdirSync(configDir, { recursive: true });
	mkdirSync(projectDir, { recursive: true });

	process.env.CLAUDE_CONFIG_DIR = configDir;
	process.env.CLAUDE_PROJECT_DIR = projectDir;

	// Mock console methods
	consoleOutput = [];
	consoleErrors = [];
	console.log = (...args: unknown[]) => {
		consoleOutput.push(args.join(" "));
	};
	console.error = (...args: unknown[]) => {
		consoleErrors.push(args.join(" "));
	};

	// Mock process.exit
	exitCode = null;
	process.exit = ((code?: number) => {
		exitCode = code ?? 0;
		throw new Error(`process.exit(${exitCode})`);
	}) as typeof process.exit;
}

function teardown(): void {
	// Restore environment variables properly
	for (const key in process.env) {
		if (!(key in originalEnv)) {
			delete process.env[key];
		}
	}
	for (const key in originalEnv) {
		process.env[key] = originalEnv[key];
	}

	console.log = originalConsoleLog;
	console.error = originalConsoleError;
	process.exit = originalExit;
	Object.defineProperty(process, "stdin", {
		value: originalStdin,
		writable: true,
		configurable: true,
	});

	// Restore all mocks/spies
	mock.restore();

	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

describe("checkpoint CLI commands", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("captureCheckpointCommand", () => {
		test("calls captureCheckpointAsync with correct parameters", async () => {
			const spy1 = spyOn(
				hooksCheckpointModule,
				"captureCheckpointAsync",
			).mockResolvedValue([]);
			const spy2 = spyOn(
				hooksCheckpointModule,
				"collectIfChangedPatterns",
			).mockReturnValue(["**/*.ts"]);

			await captureModule.captureCheckpointCommand({
				type: "session",
				id: "test-session-123",
			});

			expect(spy2).toHaveBeenCalledTimes(1);
			// Session checkpoints use the ID directly
			expect(spy1).toHaveBeenCalledWith("test-session-123", ["**/*.ts"]);
		});

		test("handles agent type checkpoint with agent- prefix", async () => {
			const spy1 = spyOn(
				hooksCheckpointModule,
				"captureCheckpointAsync",
			).mockResolvedValue([]);
			const _spy2 = spyOn(
				hooksCheckpointModule,
				"collectIfChangedPatterns",
			).mockReturnValue(["**/*.js"]);

			await captureModule.captureCheckpointCommand({
				type: "agent",
				id: "agent-456",
			});

			// Agent checkpoints are prefixed with "agent-"
			expect(spy1).toHaveBeenCalledWith("agent-agent-456", ["**/*.js"]);
		});

		test("warns when no files captured but patterns exist", async () => {
			const originalWarn = console.warn;
			const warnings: string[] = [];
			console.warn = (...args: unknown[]) => {
				warnings.push(args.join(" "));
			};

			spyOn(hooksCheckpointModule, "captureCheckpointAsync").mockResolvedValue(
				[],
			);
			spyOn(hooksCheckpointModule, "collectIfChangedPatterns").mockReturnValue([
				"**/*.ts",
			]);

			await captureModule.captureCheckpointCommand({
				type: "session",
				id: "empty-session",
			});

			expect(warnings.join("\n")).toContain("No files captured");

			console.warn = originalWarn;
		});

		test("includes collected patterns in checkpoint", async () => {
			const patterns = ["**/*.ts", "**/*.tsx", "**/*.js"];
			const spy = spyOn(
				hooksCheckpointModule,
				"captureCheckpointAsync",
			).mockResolvedValue([]);
			spyOn(hooksCheckpointModule, "collectIfChangedPatterns").mockReturnValue(
				patterns,
			);

			await captureModule.captureCheckpointCommand({
				type: "session",
				id: "multi-pattern",
			});

			expect(spy).toHaveBeenCalledWith("multi-pattern", patterns);
		});
	});

	describe("cleanCheckpoints", () => {
		test("calls cleanupOldCheckpoints with correct maxAge in milliseconds", async () => {
			const spy = spyOn(
				legacyCheckpointModule,
				"cleanupOldCheckpoints",
			).mockReturnValue(5);

			await cleanModule.cleanCheckpoints({ maxAge: "24" });

			// 24 hours * 60 min * 60 sec * 1000 ms = 86400000
			expect(spy).toHaveBeenCalledWith(86400000);
		});

		test("converts fractional hours correctly", async () => {
			const spy = spyOn(
				legacyCheckpointModule,
				"cleanupOldCheckpoints",
			).mockReturnValue(2);

			await cleanModule.cleanCheckpoints({ maxAge: "0.5" });

			// 0.5 hours = 30 minutes = 1800000 ms
			expect(spy).toHaveBeenCalledWith(1800000);
		});

		test("logs correct message for singular checkpoint", async () => {
			spyOn(legacyCheckpointModule, "cleanupOldCheckpoints").mockReturnValue(1);

			await cleanModule.cleanCheckpoints({ maxAge: "48" });

			expect(consoleOutput).toContain(
				"Cleaned 1 checkpoint older than 48 hours",
			);
		});

		test("logs correct message for multiple checkpoints", async () => {
			spyOn(legacyCheckpointModule, "cleanupOldCheckpoints").mockReturnValue(7);

			await cleanModule.cleanCheckpoints({ maxAge: "12" });

			expect(consoleOutput).toContain(
				"Cleaned 7 checkpoints older than 12 hours",
			);
		});

		test("throws error for invalid maxAge value", async () => {
			await expect(
				cleanModule.cleanCheckpoints({ maxAge: "invalid" }),
			).rejects.toThrow(
				'Invalid max-age value: "invalid". Must be a positive number.',
			);
		});

		test("throws error for negative maxAge", async () => {
			await expect(
				cleanModule.cleanCheckpoints({ maxAge: "-5" }),
			).rejects.toThrow(
				'Invalid max-age value: "-5". Must be a positive number.',
			);
		});

		test("throws error for zero maxAge", async () => {
			await expect(
				cleanModule.cleanCheckpoints({ maxAge: "0" }),
			).rejects.toThrow(
				'Invalid max-age value: "0". Must be a positive number.',
			);
		});

		test("handles cleanup returning zero checkpoints", async () => {
			spyOn(legacyCheckpointModule, "cleanupOldCheckpoints").mockReturnValue(0);

			await cleanModule.cleanCheckpoints({ maxAge: "24" });

			expect(consoleOutput).toContain(
				"Cleaned 0 checkpoints older than 24 hours",
			);
		});
	});

	describe("listCheckpoints", () => {
		test("displays message when checkpoint directory does not exist", async () => {
			// Don't create any checkpoints - directory won't exist
			await listModule.listCheckpoints();

			expect(consoleOutput).toContain("No checkpoints found.");
		});

		test("displays message when no checkpoint files exist", async () => {
			// Create directory but no files
			const checkpointDir = legacyCheckpointModule.getCheckpointDir();
			mkdirSync(checkpointDir, { recursive: true });

			await listModule.listCheckpoints();

			expect(consoleOutput).toContain("No checkpoints found.");
		});

		test("displays session checkpoints with correct formatting", async () => {
			// Create test checkpoint files
			const checkpointDir = legacyCheckpointModule.getCheckpointDir();
			mkdirSync(checkpointDir, { recursive: true });

			const checkpoint = {
				type: "session",
				created_at: "2025-01-15T10:30:00.000Z",
				patterns: ["**/*.ts"],
				files: { "file1.ts": "hash1", "file2.ts": "hash2" },
			};

			writeFileSync(
				join(checkpointDir, "session_test-session.json"),
				JSON.stringify(checkpoint),
			);

			await listModule.listCheckpoints();

			expect(consoleOutput.join("\n")).toContain("Session Checkpoints:");
			expect(consoleOutput.join("\n")).toContain("test-session");
			expect(consoleOutput.join("\n")).toContain("2025-01-15T10:30:00.000Z");
			expect(consoleOutput.join("\n")).toContain("2 files");
			expect(consoleOutput.join("\n")).toContain("Total: 1 checkpoint");
		});

		test("displays agent checkpoints with correct formatting", async () => {
			const checkpointDir = legacyCheckpointModule.getCheckpointDir();
			mkdirSync(checkpointDir, { recursive: true });

			const checkpoint = {
				type: "agent",
				created_at: "2025-01-15T11:45:00.000Z",
				patterns: ["**/*.js"],
				files: { "app.js": "hash1" },
			};

			writeFileSync(
				join(checkpointDir, "agent_dev-agent.json"),
				JSON.stringify(checkpoint),
			);

			await listModule.listCheckpoints();

			expect(consoleOutput.join("\n")).toContain("Agent Checkpoints:");
			expect(consoleOutput.join("\n")).toContain("dev-agent");
			expect(consoleOutput.join("\n")).toContain("2025-01-15T11:45:00.000Z");
			expect(consoleOutput.join("\n")).toContain("1 file");
			expect(consoleOutput.join("\n")).toContain("Total: 1 checkpoint");
		});

		test("displays both session and agent checkpoints", async () => {
			const checkpointDir = legacyCheckpointModule.getCheckpointDir();
			mkdirSync(checkpointDir, { recursive: true });

			const sessionCheckpoint = {
				type: "session",
				created_at: "2025-01-15T10:00:00.000Z",
				patterns: ["**/*.ts"],
				files: { "file1.ts": "hash1" },
			};

			const agentCheckpoint = {
				type: "agent",
				created_at: "2025-01-15T11:00:00.000Z",
				patterns: ["**/*.js"],
				files: { "app.js": "hash1" },
			};

			writeFileSync(
				join(checkpointDir, "session_main.json"),
				JSON.stringify(sessionCheckpoint),
			);
			writeFileSync(
				join(checkpointDir, "agent_worker.json"),
				JSON.stringify(agentCheckpoint),
			);

			await listModule.listCheckpoints();

			const output = consoleOutput.join("\n");
			expect(output).toContain("Session Checkpoints:");
			expect(output).toContain("Agent Checkpoints:");
			expect(output).toContain("Total: 2 checkpoints");
		});

		test("sorts checkpoints by created_at (newest first)", async () => {
			const checkpointDir = legacyCheckpointModule.getCheckpointDir();
			mkdirSync(checkpointDir, { recursive: true });

			const older = {
				type: "session",
				created_at: "2025-01-15T09:00:00.000Z",
				patterns: ["**/*.ts"],
				files: { "file.ts": "hash1" },
			};

			const newer = {
				type: "session",
				created_at: "2025-01-15T12:00:00.000Z",
				patterns: ["**/*.ts"],
				files: { "file.ts": "hash2" },
			};

			writeFileSync(
				join(checkpointDir, "session_older.json"),
				JSON.stringify(older),
			);
			writeFileSync(
				join(checkpointDir, "session_newer.json"),
				JSON.stringify(newer),
			);

			await listModule.listCheckpoints();

			const output = consoleOutput.join("\n");
			const newerIndex = output.indexOf("newer");
			const olderIndex = output.indexOf("older");

			// Newer should appear before older
			expect(newerIndex).toBeLessThan(olderIndex);
		});

		test("handles corrupted checkpoint files gracefully", async () => {
			const checkpointDir = legacyCheckpointModule.getCheckpointDir();
			mkdirSync(checkpointDir, { recursive: true });

			// Create corrupted file
			writeFileSync(
				join(checkpointDir, "session_corrupted.json"),
				"not valid json",
			);

			// Create valid file
			const validCheckpoint = {
				type: "session",
				created_at: "2025-01-15T10:00:00.000Z",
				patterns: ["**/*.ts"],
				files: { "file.ts": "hash1" },
			};
			writeFileSync(
				join(checkpointDir, "session_valid.json"),
				JSON.stringify(validCheckpoint),
			);

			await listModule.listCheckpoints();

			// Should display valid checkpoint and skip corrupted one
			const output = consoleOutput.join("\n");
			expect(output).toContain("valid");
			expect(output).not.toContain("corrupted");
			expect(output).toContain("Total: 1 checkpoint");
		});

		test("formats large file counts with locale separators", async () => {
			const checkpointDir = legacyCheckpointModule.getCheckpointDir();
			mkdirSync(checkpointDir, { recursive: true });

			const files: Record<string, string> = {};
			for (let i = 0; i < 1500; i++) {
				files[`file${i}.ts`] = `hash${i}`;
			}

			const checkpoint = {
				type: "session",
				created_at: "2025-01-15T10:00:00.000Z",
				patterns: ["**/*.ts"],
				files,
			};

			writeFileSync(
				join(checkpointDir, "session_large.json"),
				JSON.stringify(checkpoint),
			);

			await listModule.listCheckpoints();

			const output = consoleOutput.join("\n");
			// Should contain formatted number with comma separator
			expect(output).toMatch(/1[,.]500 files/);
		});

		test("ignores non-JSON files in checkpoint directory", async () => {
			const checkpointDir = legacyCheckpointModule.getCheckpointDir();
			mkdirSync(checkpointDir, { recursive: true });

			// Create non-JSON file
			writeFileSync(join(checkpointDir, "readme.txt"), "not a checkpoint");

			// Create valid checkpoint
			const checkpoint = {
				type: "session",
				created_at: "2025-01-15T10:00:00.000Z",
				patterns: ["**/*.ts"],
				files: { "file.ts": "hash1" },
			};
			writeFileSync(
				join(checkpointDir, "session_valid.json"),
				JSON.stringify(checkpoint),
			);

			await listModule.listCheckpoints();

			const output = consoleOutput.join("\n");
			expect(output).toContain("Total: 1 checkpoint");
		});
	});

	describe("registerCheckpointCommands", () => {
		test("registers checkpoint command with correct description", () => {
			const program = new Command();
			registerCheckpointCommands(program);

			const checkpointCmd = program.commands.find(
				(cmd) => cmd.name() === "checkpoint",
			);
			expect(checkpointCmd).toBeDefined();
			expect(checkpointCmd?.description()).toBe(
				"Manage session and agent checkpoints",
			);
		});

		test("registers capture subcommand with options", () => {
			const program = new Command();
			registerCheckpointCommands(program);

			const checkpointCmd = program.commands.find(
				(cmd) => cmd.name() === "checkpoint",
			);
			const captureCmd = checkpointCmd?.commands.find(
				(cmd) => cmd.name() === "capture",
			);

			expect(captureCmd).toBeDefined();
			expect(captureCmd?.description()).toContain("Capture a checkpoint");

			// Check options exist
			const typeOption = captureCmd?.options.find((opt) =>
				opt.flags.includes("--type"),
			);
			const idOption = captureCmd?.options.find((opt) =>
				opt.flags.includes("--id"),
			);

			expect(typeOption).toBeDefined();
			expect(idOption).toBeDefined();
		});

		test("registers list subcommand", () => {
			const program = new Command();
			registerCheckpointCommands(program);

			const checkpointCmd = program.commands.find(
				(cmd) => cmd.name() === "checkpoint",
			);
			const listCmd = checkpointCmd?.commands.find(
				(cmd) => cmd.name() === "list",
			);

			expect(listCmd).toBeDefined();
			expect(listCmd?.description()).toBe("List active checkpoints");
		});

		test("registers clean subcommand with max-age option", () => {
			const program = new Command();
			registerCheckpointCommands(program);

			const checkpointCmd = program.commands.find(
				(cmd) => cmd.name() === "checkpoint",
			);
			const cleanCmd = checkpointCmd?.commands.find(
				(cmd) => cmd.name() === "clean",
			);

			expect(cleanCmd).toBeDefined();
			expect(cleanCmd?.description()).toBe("Remove stale checkpoints");

			const maxAgeOption = cleanCmd?.options.find((opt) =>
				opt.flags.includes("--max-age"),
			);
			expect(maxAgeOption).toBeDefined();
			expect(maxAgeOption?.defaultValue).toBe("24");
		});

		test("capture command wiring with type and id options", () => {
			// Test that the command is wired up correctly with options
			const program = new Command();
			registerCheckpointCommands(program);

			const checkpointCmd = program.commands.find(
				(cmd) => cmd.name() === "checkpoint",
			);
			const captureCmd = checkpointCmd?.commands.find(
				(cmd) => cmd.name() === "capture",
			);

			// Verify command has an action handler
			// biome-ignore lint/suspicious/noExplicitAny: accessing private Commander.js property for testing
			expect((captureCmd as any)?._actionHandler).toBeDefined();

			// Verify options are present
			const typeOpt = captureCmd?.options.find((opt) =>
				opt.flags.includes("--type"),
			);
			const idOpt = captureCmd?.options.find((opt) =>
				opt.flags.includes("--id"),
			);
			expect(typeOpt).toBeDefined();
			expect(idOpt).toBeDefined();
		});

		test("capture command rejects invalid type", async () => {
			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync([
					"node",
					"test",
					"checkpoint",
					"capture",
					"--type",
					"invalid",
					"--id",
					"test-123",
				]);
			} catch (error) {
				// Expected due to process.exit mock
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain(
				"--type must be 'session' or 'agent'",
			);
		});

		test("capture command exits with error when checkpoint fails", async () => {
			spyOn(hooksCheckpointModule, "captureCheckpointAsync").mockRejectedValue(
				new Error("Database error"),
			);
			spyOn(hooksCheckpointModule, "collectIfChangedPatterns").mockReturnValue([
				"**/*.ts",
			]);

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync([
					"node",
					"test",
					"checkpoint",
					"capture",
					"--type",
					"session",
					"--id",
					"failing",
				]);
			} catch (error) {
				// Expected due to process.exit mock
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
		});

		test("capture command fails silently in non-verbose mode", async () => {
			delete process.env.HAN_VERBOSE;

			spyOn(hooksCheckpointModule, "captureCheckpointAsync").mockRejectedValue(
				new Error("Database error"),
			);
			spyOn(hooksCheckpointModule, "collectIfChangedPatterns").mockReturnValue([
				"**/*.ts",
			]);

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync([
					"node",
					"test",
					"checkpoint",
					"capture",
					"--type",
					"session",
					"--id",
					"failing",
				]);
			} catch (error) {
				// Expected due to process.exit mock
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			// Should not log error in non-verbose mode
			expect(consoleErrors).toHaveLength(0);
		});

		test("capture command logs errors in verbose mode", async () => {
			process.env.HAN_VERBOSE = "1";

			spyOn(hooksCheckpointModule, "captureCheckpointAsync").mockRejectedValue(
				new Error("Database error"),
			);
			spyOn(hooksCheckpointModule, "collectIfChangedPatterns").mockReturnValue([
				"**/*.ts",
			]);

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync([
					"node",
					"test",
					"checkpoint",
					"capture",
					"--type",
					"session",
					"--id",
					"failing",
				]);
			} catch (error) {
				// Expected due to process.exit mock
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("Error capturing checkpoint:");
		});

		test("list command wiring", () => {
			// Test that the command is wired up correctly
			const program = new Command();
			registerCheckpointCommands(program);

			const checkpointCmd = program.commands.find(
				(cmd) => cmd.name() === "checkpoint",
			);
			const listCmd = checkpointCmd?.commands.find(
				(cmd) => cmd.name() === "list",
			);

			// Verify command has an action handler
			// biome-ignore lint/suspicious/noExplicitAny: accessing private Commander.js property for testing
			expect((listCmd as any)?._actionHandler).toBeDefined();
		});

		test("clean command wiring with default max-age", () => {
			// Test that the command is wired up correctly with options
			const program = new Command();
			registerCheckpointCommands(program);

			const checkpointCmd = program.commands.find(
				(cmd) => cmd.name() === "checkpoint",
			);
			const cleanCmd = checkpointCmd?.commands.find(
				(cmd) => cmd.name() === "clean",
			);

			// Verify command has an action handler
			// biome-ignore lint/suspicious/noExplicitAny: accessing private Commander.js property for testing
			expect((cleanCmd as any)?._actionHandler).toBeDefined();

			// Verify max-age option has correct default
			const maxAgeOpt = cleanCmd?.options.find((opt) =>
				opt.flags.includes("--max-age"),
			);
			expect(maxAgeOpt?.defaultValue).toBe("24");
		});

		test("clean command wiring with custom max-age option", () => {
			// Test that custom max-age option is supported
			const program = new Command();
			registerCheckpointCommands(program);

			const checkpointCmd = program.commands.find(
				(cmd) => cmd.name() === "checkpoint",
			);
			const cleanCmd = checkpointCmd?.commands.find(
				(cmd) => cmd.name() === "clean",
			);

			// Verify max-age option exists
			const maxAgeOpt = cleanCmd?.options.find((opt) =>
				opt.flags.includes("--max-age"),
			);
			expect(maxAgeOpt).toBeDefined();
			expect(maxAgeOpt?.flags).toContain("--max-age");
		});

		test("clean command handles errors", async () => {
			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync([
					"node",
					"test",
					"checkpoint",
					"clean",
					"--max-age",
					"invalid",
				]);
			} catch (error) {
				// Expected due to process.exit mock
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("Error cleaning checkpoints:");
		});

		test("list command handles errors", async () => {
			// Mock listCheckpoints to throw error
			spyOn(listModule, "listCheckpoints").mockImplementation(async () => {
				throw new Error("Test error");
			});

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync(["node", "test", "checkpoint", "list"]);
			} catch (error) {
				// Expected due to process.exit mock
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("Error listing checkpoints:");
		});

		test("capture command handles unsupported hook event", async () => {
			Object.defineProperty(process, "stdin", {
				value: { isTTY: false },
				writable: true,
				configurable: true,
			});

			const fs = await import("node:fs");
			const originalReadFileSync = fs.readFileSync;
			const readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(((
				file: number | import("node:fs").PathLike,
				options?:
					| { encoding?: BufferEncoding; flag?: string }
					| BufferEncoding
					| null,
			) => {
				if (file === 0) {
					return JSON.stringify({
						hook_event_name: "UnsupportedEvent",
					});
				}
				return originalReadFileSync(file, options as BufferEncoding);
			}) as typeof fs.readFileSync);

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync(["node", "test", "checkpoint", "capture"]);
			} catch (error) {
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain(
				"Unsupported hook event 'UnsupportedEvent'",
			);

			readFileSyncSpy.mockRestore();
		});

		test("capture command handles missing session_id in payload", async () => {
			Object.defineProperty(process, "stdin", {
				value: { isTTY: false },
				writable: true,
				configurable: true,
			});

			const fs = await import("node:fs");
			const originalReadFileSync = fs.readFileSync;
			const readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(((
				file: number | import("node:fs").PathLike,
				options?:
					| { encoding?: BufferEncoding; flag?: string }
					| BufferEncoding
					| null,
			) => {
				if (file === 0) {
					return JSON.stringify({
						hook_event_name: "SessionStart",
						// No session_id
					});
				}
				return originalReadFileSync(file, options as BufferEncoding);
			}) as typeof fs.readFileSync);

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync(["node", "test", "checkpoint", "capture"]);
			} catch (error) {
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain(
				"Missing session_id in payload",
			);

			readFileSyncSpy.mockRestore();
		});

		test("capture command handles missing agent_id in payload", async () => {
			Object.defineProperty(process, "stdin", {
				value: { isTTY: false },
				writable: true,
				configurable: true,
			});

			const fs = await import("node:fs");
			const originalReadFileSync = fs.readFileSync;
			const readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(((
				file: number | import("node:fs").PathLike,
				options?:
					| { encoding?: BufferEncoding; flag?: string }
					| BufferEncoding
					| null,
			) => {
				if (file === 0) {
					return JSON.stringify({
						hook_event_name: "SubagentStart",
						// No agent_id
					});
				}
				return originalReadFileSync(file, options as BufferEncoding);
			}) as typeof fs.readFileSync);

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync(["node", "test", "checkpoint", "capture"]);
			} catch (error) {
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain("Missing agent_id in payload");

			readFileSyncSpy.mockRestore();
		});

		test("capture command handles no stdin and no options", async () => {
			// Mock stdin as TTY (interactive, won't read)
			Object.defineProperty(process, "stdin", {
				value: { isTTY: true },
				writable: true,
				configurable: true,
			});

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync(["node", "test", "checkpoint", "capture"]);
			} catch (error) {
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain(
				"No stdin payload and --type/--id not provided",
			);
		});

		test("capture command handles invalid JSON in stdin", async () => {
			Object.defineProperty(process, "stdin", {
				value: { isTTY: false },
				writable: true,
				configurable: true,
			});

			const fs = await import("node:fs");
			const originalReadFileSync = fs.readFileSync;
			const readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(((
				file: number | import("node:fs").PathLike,
				options?:
					| { encoding?: BufferEncoding; flag?: string }
					| BufferEncoding
					| null,
			) => {
				if (file === 0) {
					return "not valid json";
				}
				return originalReadFileSync(file, options as BufferEncoding);
			}) as typeof fs.readFileSync);

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync(["node", "test", "checkpoint", "capture"]);
			} catch (error) {
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain(
				"No stdin payload and --type/--id not provided",
			);

			readFileSyncSpy.mockRestore();
		});

		test("capture command handles empty stdin", async () => {
			Object.defineProperty(process, "stdin", {
				value: { isTTY: false },
				writable: true,
				configurable: true,
			});

			const fs = await import("node:fs");
			const originalReadFileSync = fs.readFileSync;
			const readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(((
				file: number | import("node:fs").PathLike,
				options?:
					| { encoding?: BufferEncoding; flag?: string }
					| BufferEncoding
					| null,
			) => {
				if (file === 0) {
					return "   "; // Whitespace only
				}
				return originalReadFileSync(file, options as BufferEncoding);
			}) as typeof fs.readFileSync);

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync(["node", "test", "checkpoint", "capture"]);
			} catch (error) {
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain(
				"No stdin payload and --type/--id not provided",
			);

			readFileSyncSpy.mockRestore();
		});

		test("capture command handles readFileSync error", async () => {
			Object.defineProperty(process, "stdin", {
				value: { isTTY: false },
				writable: true,
				configurable: true,
			});

			const fs = await import("node:fs");
			const originalReadFileSync = fs.readFileSync;
			const readFileSyncSpy = spyOn(fs, "readFileSync").mockImplementation(((
				file: number | import("node:fs").PathLike,
				options?:
					| { encoding?: BufferEncoding; flag?: string }
					| BufferEncoding
					| null,
			) => {
				if (file === 0) {
					throw new Error("Read error");
				}
				return originalReadFileSync(file, options as BufferEncoding);
			}) as typeof fs.readFileSync);

			const program = new Command();
			registerCheckpointCommands(program);

			try {
				await program.parseAsync(["node", "test", "checkpoint", "capture"]);
			} catch (error) {
				if (error instanceof Error && !error.message.includes("process.exit")) {
					throw error;
				}
			}

			expect(exitCode).toBe(1);
			expect(consoleErrors.join("\n")).toContain(
				"No stdin payload and --type/--id not provided",
			);

			readFileSyncSpy.mockRestore();
		});
	});
});
