/**
 * Unit tests for Han Events file path resolution
 * Verifies han events are stored alongside session files with -han suffix
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	getHanEventsFilePath,
	getSessionFilePath,
	getSessionsPath,
	setMemoryRoot,
} from "../lib/memory/paths.ts";

let testDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-events-path-test-${Date.now()}-${random}`);
	mkdirSync(testDir, { recursive: true });

	// Override memory root to use test directory
	setMemoryRoot(testDir);
}

function teardown(): void {
	// Reset memory root
	setMemoryRoot(null);

	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

describe("Han Events Path Resolution", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("han events path is in sessions directory", () => {
		const sessionId = "test-session-123";
		const hanEventsPath = getHanEventsFilePath(sessionId);
		const sessionsPath = getSessionsPath();

		// Han events file should be in the sessions directory
		expect(hanEventsPath.startsWith(sessionsPath)).toBe(true);
	});

	test("han events path follows session file naming with -han suffix", () => {
		const sessionId = "test-session-123";
		const sessionPath = getSessionFilePath(sessionId);
		const hanEventsPath = getHanEventsFilePath(sessionId);

		// Session file: {date}-{sessionId}.jsonl
		// Han events:   {date}-{sessionId}-han.jsonl
		const expectedHanPath = sessionPath.replace(".jsonl", "-han.jsonl");
		expect(hanEventsPath).toBe(expectedHanPath);
	});

	test("han events path ends with -han.jsonl", () => {
		const sessionId = "test-session-456";
		const hanEventsPath = getHanEventsFilePath(sessionId);

		expect(hanEventsPath.endsWith("-han.jsonl")).toBe(true);
	});

	test("han events path includes session id", () => {
		const sessionId = "unique-session-id-xyz";
		const hanEventsPath = getHanEventsFilePath(sessionId);

		expect(hanEventsPath).toContain(sessionId);
	});

	test("han events path includes date prefix", () => {
		const sessionId = "dated-session-123";
		const hanEventsPath = getHanEventsFilePath(sessionId);
		const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

		expect(hanEventsPath).toContain(date);
	});
});
