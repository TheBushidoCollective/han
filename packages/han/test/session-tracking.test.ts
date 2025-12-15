/**
 * Tests for commands/metrics/session-tracking.ts
 *
 * Tests the session tracking functions by using the JsonlMetricsStorage directly
 * to avoid the module-level singleton caching issues.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	endSession,
	getCurrentSession,
	startSession,
} from "../lib/commands/metrics/session-tracking.ts";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

describe.serial("session-tracking.ts", () => {
	const testDir = `/tmp/test-session-tracking-${Date.now()}`;
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let processExitSpy: ReturnType<typeof spyOn>;
	let logs: string[] = [];
	let errors: string[] = [];
	let originalConfigDir: string | undefined;

	beforeEach(() => {
		// Save original environment
		originalConfigDir = process.env.CLAUDE_CONFIG_DIR;

		// Set up test config directory (where metrics are stored)
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		mkdirSync(join(testDir, "config", "han", "metrics", "jsonldb"), {
			recursive: true,
		});

		// Capture console output
		logs = [];
		errors = [];
		consoleLogSpy = spyOn(console, "log").mockImplementation((...args) => {
			logs.push(args.join(" "));
		});
		consoleErrorSpy = spyOn(console, "error").mockImplementation((...args) => {
			errors.push(args.join(" "));
		});
		processExitSpy = spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`process.exit(${code})`);
		});
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		processExitSpy.mockRestore();

		// Restore environment
		if (originalConfigDir) {
			process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
		} else {
			delete process.env.CLAUDE_CONFIG_DIR;
		}

		rmSync(testDir, { recursive: true, force: true });
	});

	describe("startSession behavior", () => {
		test("creates new session with unique ID", () => {
			const storage = new JsonlMetricsStorage();
			const result = storage.startSession();

			expect(result.session_id).toBeDefined();
			expect(result.session_id.startsWith("session-")).toBe(true);
			expect(result.resumed).toBe(false);
		});

		test("creates session with custom ID", () => {
			const storage = new JsonlMetricsStorage();
			const customId = `test-session-${Date.now()}`;
			const result = storage.startSession(customId);

			expect(result.session_id).toBe(customId);
			expect(result.resumed).toBe(false);
		});

		test("resumes existing session when ID provided", () => {
			const storage = new JsonlMetricsStorage();

			// Start a session first
			const firstResult = storage.startSession();

			// Resume the same session
			const resumedResult = storage.startSession(firstResult.session_id);

			expect(resumedResult.session_id).toBe(firstResult.session_id);
			expect(resumedResult.resumed).toBe(true);
		});
	});

	describe("endSession behavior", () => {
		test("ends session with provided ID", () => {
			const storage = new JsonlMetricsStorage();

			// Start a session first
			const { session_id } = storage.startSession();

			// End the session
			const result = storage.endSession(session_id);

			expect(result.success).toBe(true);
		});

		test("clears currentSessionId after ending", () => {
			const storage = new JsonlMetricsStorage();

			// Start a session
			const { session_id } = storage.startSession();

			// Verify it's current
			expect(storage.getCurrentSession()?.session_id).toBe(session_id);

			// End the session
			storage.endSession(session_id);

			// Should no longer be current
			expect(storage.getCurrentSession()).toBeNull();
		});
	});

	describe("getCurrentSession behavior", () => {
		test("returns current session info", () => {
			const storage = new JsonlMetricsStorage();

			// Start a session first
			const { session_id } = storage.startSession();

			// Get current session
			const current = storage.getCurrentSession();

			expect(current).not.toBeNull();
			expect(current?.session_id).toBe(session_id);
		});

		test("returns null when no active session", () => {
			const storage = new JsonlMetricsStorage();

			// No session started
			const current = storage.getCurrentSession();

			expect(current).toBeNull();
		});

		test("returns null after session ends", () => {
			const storage = new JsonlMetricsStorage();

			// Start and end a session
			const { session_id } = storage.startSession();
			storage.endSession(session_id);

			// Get current session
			const current = storage.getCurrentSession();

			expect(current).toBeNull();
		});

		test("finds active session from JSONL file", () => {
			// Start a session with one storage instance
			const storage1 = new JsonlMetricsStorage();
			const { session_id } = storage1.startSession();

			// Create a new storage instance (simulating a new process)
			const storage2 = new JsonlMetricsStorage();

			// Should find the active session from the file
			const current = storage2.getCurrentSession();

			expect(current).not.toBeNull();
			expect(current?.session_id).toBe(session_id);
		});
	});

	describe("session-tracking module wrapper functions", () => {
		// These tests use the actual module functions but with isolated storage
		// via CLAUDE_CONFIG_DIR pointing to a unique temp directory per test

		test("startSession outputs JSON to console", async () => {
			const sessionId = await startSession();

			expect(sessionId).toBeDefined();
			expect(logs.length).toBeGreaterThan(0);

			const parsed = JSON.parse(logs[0]);
			expect(parsed.session_id).toBe(sessionId);
			expect(typeof parsed.resumed).toBe("boolean");
		});

		test("endSession outputs success JSON", async () => {
			const sessionId = await startSession();
			logs = []; // Clear logs

			await endSession(sessionId);

			expect(logs.length).toBeGreaterThan(0);
			const parsed = JSON.parse(logs[0]);
			expect(parsed.success).toBe(true);
			expect(parsed.session_id).toBe(sessionId);
		});

		test("getCurrentSession outputs JSON", async () => {
			const sessionId = await startSession();
			logs = []; // Clear logs

			await getCurrentSession();

			expect(logs.length).toBeGreaterThan(0);
			const parsed = JSON.parse(logs[0]);
			expect(parsed.session_id).toBe(sessionId);
		});
	});
});
