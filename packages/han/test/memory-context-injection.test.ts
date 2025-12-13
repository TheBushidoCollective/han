/**
 * Unit tests for Han Memory SessionStart context injection hook
 * Tests the hook that injects recent session context when a new session starts
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { injectSessionContext } from "../lib/memory/context-injection.ts";
import {
	createMemoryStore,
	generateId,
	type SessionSummary,
	setMemoryRoot,
} from "../lib/memory/index.ts";

let testDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-memory-context-test-${Date.now()}-${random}`);
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

describe("Memory Context Injection", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("injectSessionContext", () => {
		test("returns empty string when no recent sessions exist", () => {
			const context = injectSessionContext();
			expect(context).toBe("");
		});

		test("formats single recent session", () => {
			const store = createMemoryStore();
			const sessionId = `session-${generateId()}`;

			const summary: SessionSummary = {
				session_id: sessionId,
				project: "test-project",
				started_at: Date.now() - 3600000,
				ended_at: Date.now() - 1800000,
				summary: "Implemented user authentication with JWT tokens",
				work_items: [
					{
						description: "Added login form component",
						files: ["src/components/LoginForm.tsx"],
						outcome: "completed",
					},
				],
				in_progress: ["Add password reset functionality"],
				decisions: [
					{
						description: "Use JWT for authentication",
						rationale: "Standard approach, integrates well with our API",
					},
				],
			};

			store.storeSessionSummary(sessionId, summary);

			const context = injectSessionContext();
			expect(context).toContain("## Recent Work");
			expect(context).toContain(
				"Implemented user authentication with JWT tokens",
			);
			expect(context).toContain("Added login form component");
			expect(context).toContain("## In Progress");
			expect(context).toContain("Add password reset functionality");
		});

		test("formats multiple recent sessions", () => {
			const store = createMemoryStore();

			// Create 3 recent sessions
			for (let i = 0; i < 3; i++) {
				const sessionId = `session-${i}-${generateId()}`;
				const summary: SessionSummary = {
					session_id: sessionId,
					project: "test-project",
					started_at: Date.now() - 3600000 * (i + 1),
					ended_at: Date.now() - 1800000 * (i + 1),
					summary: `Session ${i} work summary`,
					work_items: [
						{
							description: `Task ${i}`,
							files: [`src/file${i}.ts`],
							outcome: "completed",
						},
					],
					in_progress: [`In-progress item ${i}`],
					decisions: [],
				};
				store.storeSessionSummary(sessionId, summary);
			}

			const context = injectSessionContext();
			expect(context).toContain("Session 0 work summary");
			expect(context).toContain("Session 1 work summary");
			expect(context).toContain("Session 2 work summary");
		});

		test("limits to 5 most recent sessions by default", () => {
			const store = createMemoryStore();

			// Create 8 sessions (most recent = highest index due to timestamps)
			for (let i = 0; i < 8; i++) {
				const sessionId = `session-${i}-${generateId()}`;
				const summary: SessionSummary = {
					session_id: sessionId,
					project: "test-project",
					started_at: Date.now() - 3600000 * (8 - i), // Earlier sessions have older timestamps
					ended_at: Date.now() - 1800000 * (8 - i),
					summary: `Session ${i} summary`,
					work_items: [],
					in_progress: [],
					decisions: [],
				};
				store.storeSessionSummary(sessionId, summary);
			}

			const context = injectSessionContext();

			// Should contain sessions 3-7 (most recent 5)
			expect(context).toContain("Session 7");
			expect(context).toContain("Session 6");
			expect(context).toContain("Session 5");
			expect(context).toContain("Session 4");
			expect(context).toContain("Session 3");

			// Should NOT contain sessions 0-2 (older)
			expect(context).not.toContain("Session 0");
			expect(context).not.toContain("Session 1");
			expect(context).not.toContain("Session 2");
		});

		test("respects custom limit parameter", () => {
			const store = createMemoryStore();

			// Create 5 sessions (most recent = highest index)
			for (let i = 0; i < 5; i++) {
				const sessionId = `session-${i}-${generateId()}`;
				const summary: SessionSummary = {
					session_id: sessionId,
					project: "test-project",
					started_at: Date.now() - 3600000 * (5 - i),
					ended_at: Date.now() - 1800000 * (5 - i),
					summary: `Session ${i} summary`,
					work_items: [],
					in_progress: [],
					decisions: [],
				};
				store.storeSessionSummary(sessionId, summary);
			}

			const context = injectSessionContext(2);

			// Should only contain 2 most recent sessions (4 and 3)
			expect(context).toContain("Session 4");
			expect(context).toContain("Session 3");
			expect(context).not.toContain("Session 2");
		});

		test("includes decisions in context", () => {
			const store = createMemoryStore();
			const sessionId = `session-${generateId()}`;

			const summary: SessionSummary = {
				session_id: sessionId,
				project: "test-project",
				started_at: Date.now() - 3600000,
				ended_at: Date.now() - 1800000,
				summary: "Made architectural decisions",
				work_items: [],
				in_progress: [],
				decisions: [
					{
						description: "Use PostgreSQL for the database",
						rationale: "Better support for complex queries and transactions",
						alternatives_considered: ["MongoDB", "SQLite"],
					},
					{
						description: "Adopt TypeScript for new modules",
						rationale: "Type safety reduces bugs",
					},
				],
			};

			store.storeSessionSummary(sessionId, summary);

			const context = injectSessionContext();
			expect(context).toContain("## Recent Work");
			expect(context).toContain("Use PostgreSQL for the database");
			expect(context).toContain(
				"Better support for complex queries and transactions",
			);
			expect(context).toContain("Adopt TypeScript for new modules");
		});

		test("aggregates in-progress items from multiple sessions", () => {
			const store = createMemoryStore();

			// Session 1 with in-progress items
			store.storeSessionSummary(`session-1-${generateId()}`, {
				session_id: "session-1",
				project: "test-project",
				started_at: Date.now() - 7200000,
				ended_at: Date.now() - 3600000,
				summary: "Session 1",
				work_items: [],
				in_progress: ["Task A", "Task B"],
				decisions: [],
			});

			// Session 2 with different in-progress items
			store.storeSessionSummary(`session-2-${generateId()}`, {
				session_id: "session-2",
				project: "test-project",
				started_at: Date.now() - 3600000,
				ended_at: Date.now() - 1800000,
				summary: "Session 2",
				work_items: [],
				in_progress: ["Task C"],
				decisions: [],
			});

			const context = injectSessionContext();
			expect(context).toContain("## In Progress");
			expect(context).toContain("Task A");
			expect(context).toContain("Task B");
			expect(context).toContain("Task C");
		});

		test("handles sessions with no work items gracefully", () => {
			const store = createMemoryStore();
			const sessionId = `session-${generateId()}`;

			const summary: SessionSummary = {
				session_id: sessionId,
				project: "test-project",
				started_at: Date.now() - 3600000,
				ended_at: Date.now() - 1800000,
				summary: "Exploratory session - reviewed codebase",
				work_items: [],
				in_progress: [],
				decisions: [],
			};

			store.storeSessionSummary(sessionId, summary);

			const context = injectSessionContext();
			expect(context).toContain("Exploratory session - reviewed codebase");
			expect(context).not.toContain("## In Progress");
		});

		test("formats markdown correctly", () => {
			const store = createMemoryStore();
			const sessionId = `session-${generateId()}`;

			const summary: SessionSummary = {
				session_id: sessionId,
				project: "test-project",
				started_at: Date.now() - 3600000,
				ended_at: Date.now() - 1800000,
				summary: "Test session",
				work_items: [
					{
						description: "Completed task",
						files: ["file1.ts", "file2.ts"],
						outcome: "completed",
					},
				],
				in_progress: ["Pending task"],
				decisions: [],
			};

			store.storeSessionSummary(sessionId, summary);

			const context = injectSessionContext();

			// Check for proper markdown structure
			expect(context).toMatch(/^#/m); // Has headings
			expect(context).toMatch(/^-/m); // Has bullet points
			expect(context.trim()).not.toBe(""); // Not empty
		});

		test("includes file information for work items", () => {
			const store = createMemoryStore();
			const sessionId = `session-${generateId()}`;

			const summary: SessionSummary = {
				session_id: sessionId,
				project: "test-project",
				started_at: Date.now() - 3600000,
				ended_at: Date.now() - 1800000,
				summary: "File modifications",
				work_items: [
					{
						description: "Refactored authentication module",
						files: [
							"src/auth/login.ts",
							"src/auth/session.ts",
							"src/auth/types.ts",
						],
						outcome: "completed",
					},
				],
				in_progress: [],
				decisions: [],
			};

			store.storeSessionSummary(sessionId, summary);

			const context = injectSessionContext();
			expect(context).toContain("Refactored authentication module");
			expect(context).toContain("src/auth/login.ts");
			expect(context).toContain("src/auth/session.ts");
			expect(context).toContain("src/auth/types.ts");
		});

		test("shows outcome status for work items", () => {
			const store = createMemoryStore();
			const sessionId = `session-${generateId()}`;

			const summary: SessionSummary = {
				session_id: sessionId,
				project: "test-project",
				started_at: Date.now() - 3600000,
				ended_at: Date.now() - 1800000,
				summary: "Mixed outcomes",
				work_items: [
					{
						description: "Completed feature",
						files: ["feature.ts"],
						outcome: "completed",
					},
					{
						description: "Partial implementation",
						files: ["partial.ts"],
						outcome: "partial",
					},
					{
						description: "Blocked on dependency",
						files: ["blocked.ts"],
						outcome: "blocked",
					},
				],
				in_progress: [],
				decisions: [],
			};

			store.storeSessionSummary(sessionId, summary);

			const context = injectSessionContext();
			expect(context).toContain("Completed feature");
			expect(context).toContain("Partial implementation");
			expect(context).toContain("Blocked on dependency");
		});
	});
});
