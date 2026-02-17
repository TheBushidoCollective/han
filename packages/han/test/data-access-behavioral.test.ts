/**
 * Behavioral tests for lib/grpc/data-access.ts
 *
 * Tests actual gRPC delegation, field mapping, stub behavior,
 * and safe-default return values — NOT just exports.
 */
import { describe, expect, mock, test, beforeEach } from "bun:test";

// ============================================================================
// Mock infrastructure
// ============================================================================

const mockSessionsGet = mock();
const mockSessionsList = mock();
const mockMemorySearch = mock();
const mockMemoryIndexDocument = mock();
const mockIndexerIndexFile = mock();
const mockIndexerTriggerScan = mock();
const mockCoordinatorHealth = mock();

mock.module("../lib/grpc/client.ts", () => ({
	getCoordinatorClients: () => ({
		coordinator: { health: mockCoordinatorHealth },
		sessions: { get: mockSessionsGet, list: mockSessionsList },
		indexer: {
			indexFile: mockIndexerIndexFile,
			triggerScan: mockIndexerTriggerScan,
		},
		hooks: {},
		slots: {},
		memory: {
			search: mockMemorySearch,
			indexDocument: mockMemoryIndexDocument,
		},
	}),
	createCoordinatorClients: () => ({}),
	setCoordinatorPort: () => {},
	isCoordinatorHealthy: mockCoordinatorHealth,
}));

// Now import the module under test
const da = await import("../lib/grpc/data-access.ts");

beforeEach(() => {
	mockSessionsGet.mockReset();
	mockSessionsList.mockReset();
	mockMemorySearch.mockReset();
	mockMemoryIndexDocument.mockReset();
	mockIndexerIndexFile.mockReset();
	mockIndexerTriggerScan.mockReset();
	mockCoordinatorHealth.mockReset();
});

// ============================================================================
// Active gRPC methods — sessions
// ============================================================================

describe("sessions.get", () => {
	test("maps SessionData to Session correctly", async () => {
		mockSessionsGet.mockResolvedValueOnce({
			session: {
				id: "row-1",
				sessionId: "sess-abc",
				projectId: "proj-1",
				status: "active",
				sessionFilePath: "/tmp/sess.jsonl",
				sessionSlug: "cozy-fox",
				startedAt: "2026-01-01T00:00:00Z",
				endedAt: null,
				lastIndexedLine: 42,
			},
		});

		const result = await da.sessions.get("sess-abc");

		expect(result).not.toBeNull();
		expect(result!.id).toBe("row-1");
		expect(result!.session_id).toBe("sess-abc");
		expect(result!.project_id).toBe("proj-1");
		expect(result!.status).toBe("active");
		expect(result!.session_file_path).toBe("/tmp/sess.jsonl");
		expect(result!.session_slug).toBe("cozy-fox");
		expect(result!.started_at).toBe("2026-01-01T00:00:00Z");
		expect(result!.ended_at).toBeNull();
		expect(result!.last_indexed_line).toBe(42);
	});

	test("returns null when session not found", async () => {
		mockSessionsGet.mockResolvedValueOnce({ session: undefined });

		const result = await da.sessions.get("nonexistent");
		expect(result).toBeNull();
	});

	test("passes sessionId to gRPC", async () => {
		mockSessionsGet.mockResolvedValueOnce({ session: undefined });
		await da.sessions.get("sess-xyz");

		expect(mockSessionsGet).toHaveBeenCalledTimes(1);
		expect(mockSessionsGet.mock.calls[0][0]).toEqual({
			sessionId: "sess-xyz",
		});
	});
});

describe("sessions.list", () => {
	test("maps multiple SessionData results", async () => {
		mockSessionsList.mockResolvedValueOnce({
			sessions: [
				{
					id: "1",
					sessionId: "s1",
					projectId: "p1",
					status: "active",
					sessionFilePath: null,
					sessionSlug: null,
					startedAt: null,
					endedAt: null,
					lastIndexedLine: null,
				},
				{
					id: "2",
					sessionId: "s2",
					projectId: null,
					status: "ended",
					sessionFilePath: null,
					sessionSlug: null,
					startedAt: null,
					endedAt: "2026-01-02T00:00:00Z",
					lastIndexedLine: null,
				},
			],
		});

		const results = await da.sessions.list({ projectId: "p1" });

		expect(results).toHaveLength(2);
		expect(results[0].session_id).toBe("s1");
		expect(results[1].session_id).toBe("s2");
		expect(results[1].ended_at).toBe("2026-01-02T00:00:00Z");
	});

	test("passes options with defaults to gRPC", async () => {
		mockSessionsList.mockResolvedValueOnce({ sessions: [] });
		await da.sessions.list({ projectId: "p1", status: "active" });

		const args = mockSessionsList.mock.calls[0][0];
		expect(args.projectId).toBe("p1");
		expect(args.status).toBe("active");
		expect(args.limit).toBe(100);
		expect(args.offset).toBe(0);
	});

	test("respects explicit limit and offset", async () => {
		mockSessionsList.mockResolvedValueOnce({ sessions: [] });
		await da.sessions.list({ limit: 10, offset: 20 });

		const args = mockSessionsList.mock.calls[0][0];
		expect(args.limit).toBe(10);
		expect(args.offset).toBe(20);
	});

	test("returns empty array for no sessions", async () => {
		mockSessionsList.mockResolvedValueOnce({ sessions: [] });
		const results = await da.sessions.list();
		expect(results).toEqual([]);
	});
});

// ============================================================================
// Active gRPC methods — messages.search
// ============================================================================

describe("messages.search", () => {
	test("maps MemoryResult to FtsSearchResult", async () => {
		mockMemorySearch.mockResolvedValueOnce({
			results: [
				{
					id: "r1",
					content: "some matched text",
					score: 0.95,
					sessionId: "sess-1",
					source: "message",
				},
			],
		});

		const results = await da.messages.search({ query: "matched" });

		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("r1");
		expect(results[0].content).toBe("some matched text");
		expect(results[0].score).toBe(0.95);
		expect(results[0].session_id).toBe("sess-1");
		expect(results[0].source).toBe("message");
	});

	test("passes query, sessionId, and limit to gRPC", async () => {
		mockMemorySearch.mockResolvedValueOnce({ results: [] });
		await da.messages.search({
			query: "test",
			sessionId: "s1",
			limit: 5,
		});

		const args = mockMemorySearch.mock.calls[0][0];
		expect(args.query).toBe("test");
		expect(args.sessionId).toBe("s1");
		expect(args.limit).toBe(5);
	});

	test("defaults limit to 20", async () => {
		mockMemorySearch.mockResolvedValueOnce({ results: [] });
		await da.messages.search({ query: "test" });

		const args = mockMemorySearch.mock.calls[0][0];
		expect(args.limit).toBe(20);
	});
});

// ============================================================================
// Active gRPC methods — fts namespace
// ============================================================================

describe("fts.search", () => {
	test("maps MemoryResult to FtsSearchResult", async () => {
		mockMemorySearch.mockResolvedValueOnce({
			results: [
				{
					id: "fts-1",
					content: "fts result",
					score: 0.8,
					sessionId: "s1",
					source: "fts",
				},
			],
		});

		const results = await da.fts.search("query");
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("fts-1");
		expect(results[0].content).toBe("fts result");
		expect(results[0].session_id).toBe("s1");
	});

	test("passes options through to gRPC", async () => {
		mockMemorySearch.mockResolvedValueOnce({ results: [] });
		await da.fts.search("hello", { sessionId: "s2", limit: 10 });

		const args = mockMemorySearch.mock.calls[0][0];
		expect(args.query).toBe("hello");
		expect(args.sessionId).toBe("s2");
		expect(args.limit).toBe(10);
	});

	test("defaults limit to 20", async () => {
		mockMemorySearch.mockResolvedValueOnce({ results: [] });
		await da.fts.search("hello");

		expect(mockMemorySearch.mock.calls[0][0].limit).toBe(20);
	});
});

describe("fts.index", () => {
	test("calls memory.indexDocument with correct fields", async () => {
		mockMemoryIndexDocument.mockResolvedValueOnce({});
		await da.fts.index("doc-1", "content here", "sess-1", "transcript");

		expect(mockMemoryIndexDocument).toHaveBeenCalledTimes(1);
		const args = mockMemoryIndexDocument.mock.calls[0][0];
		expect(args.content).toBe("content here");
		expect(args.sessionId).toBe("sess-1");
		expect(args.source).toBe("transcript");
	});
});

describe("fts.delete", () => {
	test("returns true (no-op)", async () => {
		const result = await da.fts.delete("any-id");
		expect(result).toBe(true);
	});
});

// ============================================================================
// Active gRPC methods — vectors namespace
// ============================================================================

describe("vectors.search", () => {
	test("maps MemoryResult to VectorSearchResult", async () => {
		mockMemorySearch.mockResolvedValueOnce({
			results: [
				{
					id: "v1",
					content: "vector result",
					score: 0.92,
					sessionId: "s1",
					source: "vector",
				},
			],
		});

		const results = await da.vectors.search("query");
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("v1");
		expect(results[0].score).toBe(0.92);
	});
});

describe("vectors.index", () => {
	test("calls memory.indexDocument", async () => {
		mockMemoryIndexDocument.mockResolvedValueOnce({});
		await da.vectors.index("v-1", "vector content", "sess-1", "embedding");

		expect(mockMemoryIndexDocument).toHaveBeenCalledTimes(1);
		const args = mockMemoryIndexDocument.mock.calls[0][0];
		expect(args.content).toBe("vector content");
		expect(args.sessionId).toBe("sess-1");
		expect(args.source).toBe("embedding");
	});
});

// ============================================================================
// Active gRPC methods — indexer namespace
// ============================================================================

describe("indexer.indexSessionFile", () => {
	test("maps IndexFileResponse to IndexResult", async () => {
		mockIndexerIndexFile.mockResolvedValueOnce({
			sessionId: "sess-1",
			messagesIndexed: 42,
			totalMessages: 100,
			isNewSession: true,
			error: "",
		});

		const result = await da.indexer.indexSessionFile(
			"/path/to/file.jsonl",
			"/config",
		);

		expect(result.sessionId).toBe("sess-1");
		expect(result.messagesIndexed).toBe(42);
		expect(result.totalMessages).toBe(100);
		expect(result.isNewSession).toBe(true);
		expect(result.error).toBe("");
	});

	test("passes filePath and configDir to gRPC", async () => {
		mockIndexerIndexFile.mockResolvedValueOnce({
			sessionId: "",
			messagesIndexed: 0,
			totalMessages: 0,
			isNewSession: false,
			error: "",
		});

		await da.indexer.indexSessionFile("/a/b.jsonl", "/cfg");

		const args = mockIndexerIndexFile.mock.calls[0][0];
		expect(args.filePath).toBe("/a/b.jsonl");
		expect(args.configDir).toBe("/cfg");
	});
});

describe("indexer.fullScanAndIndex", () => {
	test("calls triggerScan and returns empty array", async () => {
		mockIndexerTriggerScan.mockResolvedValueOnce({});
		const results = await da.indexer.fullScanAndIndex("/config");

		expect(mockIndexerTriggerScan).toHaveBeenCalledTimes(1);
		expect(mockIndexerTriggerScan.mock.calls[0][0]).toEqual({
			configDir: "/config",
		});
		expect(results).toEqual([]);
	});
});

// ============================================================================
// Coordinator lifecycle helpers
// ============================================================================

describe("isCoordinatorRunning", () => {
	test("delegates to isCoordinatorHealthy", async () => {
		mockCoordinatorHealth.mockResolvedValueOnce(true);
		const result = await da.isCoordinatorRunning();
		expect(result).toBe(true);
	});

	test("returns false when unhealthy", async () => {
		mockCoordinatorHealth.mockResolvedValueOnce(false);
		const result = await da.isCoordinatorRunning();
		expect(result).toBe(false);
	});
});

describe("startCoordinatorIfNeeded", () => {
	test("delegates to isCoordinatorHealthy", async () => {
		mockCoordinatorHealth.mockResolvedValueOnce(true);
		const result = await da.startCoordinatorIfNeeded();
		expect(result).toBe(true);
	});
});

describe("withFreshData", () => {
	test("passes through function result", async () => {
		const result = await da.withFreshData(async () => "hello");
		expect(result).toBe("hello");
	});
});

describe("withCoordinator", () => {
	test("passes through function result", async () => {
		const result = await da.withCoordinator(async () => 42);
		expect(result).toBe(42);
	});
});

describe("initDb", () => {
	test("is a no-op", async () => {
		await expect(da.initDb()).resolves.toBeUndefined();
	});
});

// ============================================================================
// Stub methods — verify they throw with correct messages
// ============================================================================

describe("stub methods throw coordinator-internal", () => {
	test("repos.upsert", async () => {
		await expect(
			da.repos.upsert({ remote_url: "x" }),
		).rejects.toThrow("coordinator-internal");
	});

	test("repos.getByRemote", async () => {
		await expect(da.repos.getByRemote("x")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("repos.list", async () => {
		await expect(da.repos.list()).rejects.toThrow("coordinator-internal");
	});

	test("projects.upsert", async () => {
		await expect(
			da.projects.upsert({ path: "/p", slug: "s" }),
		).rejects.toThrow("coordinator-internal");
	});

	test("projects.getBySlug", async () => {
		await expect(da.projects.getBySlug("x")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("projects.getByPath", async () => {
		await expect(da.projects.getByPath("/x")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("projects.list", async () => {
		await expect(da.projects.list()).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("sessions.upsert", async () => {
		await expect(
			da.sessions.upsert({ session_id: "s" }),
		).rejects.toThrow("coordinator-internal");
	});

	test("sessions.end", async () => {
		await expect(da.sessions.end("s")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("sessions.resetForReindex", async () => {
		await expect(da.sessions.resetForReindex("s")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("messages.insertBatch", async () => {
		await expect(
			da.messages.insertBatch({ session_id: "s", messages: [] }),
		).rejects.toThrow("coordinator-internal");
	});

	test("tasks.create", async () => {
		await expect(
			da.tasks.create({ session_id: "s", name: "t" }),
		).rejects.toThrow("coordinator-internal");
	});

	test("tasks.complete", async () => {
		await expect(
			da.tasks.complete({
				session_id: "s",
				task_name: "t",
				duration_ms: 100,
			}),
		).rejects.toThrow("coordinator-internal");
	});

	test("tasks.fail", async () => {
		await expect(
			da.tasks.fail({
				session_id: "s",
				task_name: "t",
				error: "e",
				duration_ms: 100,
			}),
		).rejects.toThrow("coordinator-internal");
	});

	test("tasks.get", async () => {
		await expect(da.tasks.get("s", "t")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("tasks.queryMetrics", async () => {
		await expect(da.tasks.queryMetrics()).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("hookExecutions.record", async () => {
		await expect(
			da.hookExecutions.record({
				session_id: "s",
				hook_name: "h",
				event_type: "Stop",
			}),
		).rejects.toThrow("coordinator-internal");
	});

	test("hookAttempts.getOrCreate", async () => {
		await expect(da.hookAttempts.getOrCreate("s", "h")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("hookAttempts.increment", async () => {
		await expect(da.hookAttempts.increment("s", "h")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("hookAttempts.reset", async () => {
		await expect(da.hookAttempts.reset("s", "h")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("hookAttempts.increaseMaxAttempts", async () => {
		await expect(
			da.hookAttempts.increaseMaxAttempts("s", "h", 5),
		).rejects.toThrow("coordinator-internal");
	});

	test("deferredHooks.queue", async () => {
		await expect(
			da.deferredHooks.queue({
				session_id: "s",
				hook_name: "h",
				plugin_name: "p",
				event_type: "Stop",
			}),
		).rejects.toThrow("coordinator-internal");
	});

	test("frustrations.record", async () => {
		await expect(
			da.frustrations.record({
				session_id: "s",
				event_type: "error",
			}),
		).rejects.toThrow("coordinator-internal");
	});

	test("sessionFileChanges.record", async () => {
		await expect(
			da.sessionFileChanges.record({
				session_id: "s",
				file_path: "/f",
				change_type: "Modified",
			}),
		).rejects.toThrow("coordinator-internal");
	});

	test("sessionFileValidations.record", async () => {
		await expect(
			da.sessionFileValidations.record({
				session_id: "s",
				file_path: "/f",
				hook_command: "lint",
				file_hash: "abc",
				command_hash: "def",
			}),
		).rejects.toThrow("coordinator-internal");
	});

	test("sessionTodos.upsert", async () => {
		await expect(
			da.sessionTodos.upsert({ session_id: "s", todos_json: "[]" }),
		).rejects.toThrow("coordinator-internal");
	});

	test("coordinator.tryAcquire", () => {
		expect(() => da.coordinator.tryAcquire()).toThrow("Rust coordinator");
	});

	test("coordinator.release", () => {
		expect(() => da.coordinator.release()).toThrow("Rust coordinator");
	});

	test("coordinator.updateHeartbeat", () => {
		expect(() => da.coordinator.updateHeartbeat()).toThrow(
			"Rust coordinator",
		);
	});

	test("coordinator.getStatus", () => {
		expect(() => da.coordinator.getStatus()).toThrow(
			"gRPC CoordinatorService",
		);
	});

	test("watcher.start", async () => {
		await expect(da.watcher.start()).rejects.toThrow("Rust coordinator");
	});

	test("watcher.stop", () => {
		expect(() => da.watcher.stop()).toThrow("Rust coordinator");
	});

	test("indexer.indexProjectDirectory", async () => {
		await expect(
			da.indexer.indexProjectDirectory("/dir"),
		).rejects.toThrow("coordinator-internal");
	});

	test("indexer.handleFileEvent", async () => {
		await expect(
			da.indexer.handleFileEvent("Modified", "/f"),
		).rejects.toThrow("coordinator-internal");
	});

	test("truncateDerivedTables", () => {
		expect(() => da.truncateDerivedTables()).toThrow(
			"coordinator-internal",
		);
	});

	test("registerConfigDir", async () => {
		await expect(
			da.registerConfigDir({ path: "/p" }),
		).rejects.toThrow("coordinator-internal");
	});
});

// ============================================================================
// Safe defaults — verify correct fallback return values
// ============================================================================

describe("safe defaults", () => {
	test("hookExecutions.queryStats returns zeros", async () => {
		const stats = await da.hookExecutions.queryStats();
		expect(stats.total_executions).toBe(0);
		expect(stats.cached_executions).toBe(0);
		expect(stats.avg_duration_ms).toBeNull();
		expect(stats.failure_count).toBe(0);
	});

	test("frustrations.queryMetrics returns empty", async () => {
		const metrics = await da.frustrations.queryMetrics();
		expect(metrics.total_events).toBe(0);
		expect(metrics.by_type).toEqual({});
	});

	test("sessionFileChanges.list returns empty array", async () => {
		expect(await da.sessionFileChanges.list("s")).toEqual([]);
	});

	test("sessionFileChanges.hasChanges returns false", async () => {
		expect(await da.sessionFileChanges.hasChanges("s")).toBe(false);
	});

	test("sessionFileValidations.get returns null", async () => {
		expect(
			await da.sessionFileValidations.get("s", "/f", "lint"),
		).toBeNull();
	});

	test("sessionFileValidations.list returns empty array", async () => {
		expect(await da.sessionFileValidations.list("s")).toEqual([]);
	});

	test("sessionFileValidations.listAll returns empty array", async () => {
		expect(await da.sessionFileValidations.listAll()).toEqual([]);
	});

	test("sessionFileValidations.needsValidation returns true", async () => {
		expect(
			await da.sessionFileValidations.needsValidation(
				"s",
				"/f",
				"lint",
				"h1",
				"h2",
			),
		).toBe(true);
	});

	test("sessionFileValidations.getFilesForValidation returns all files", async () => {
		const files = ["/a.ts", "/b.ts"];
		expect(
			await da.sessionFileValidations.getFilesForValidation(
				"s",
				"lint",
				files,
			),
		).toEqual(files);
	});

	test("sessionFileValidations.checkFilesNeedValidation returns all paths", async () => {
		const files = [
			{ path: "/a.ts", hash: "h1", commandHash: "c1" },
			{ path: "/b.ts", hash: "h2", commandHash: "c2" },
		];
		expect(
			await da.sessionFileValidations.checkFilesNeedValidation(
				"s",
				"lint",
				files,
			),
		).toEqual(["/a.ts", "/b.ts"]);
	});

	test("sessionFileValidations.deleteStale returns 0", async () => {
		expect(await da.sessionFileValidations.deleteStale("s")).toBe(0);
	});

	test("sessionTodos.get returns null", async () => {
		expect(await da.sessionTodos.get("s")).toBeNull();
	});

	test("nativeTasks.getForSession returns empty array", async () => {
		expect(await da.nativeTasks.getForSession("s")).toEqual([]);
	});

	test("nativeTasks.get returns null", async () => {
		expect(await da.nativeTasks.get("s", "t")).toBeNull();
	});

	test("deferredHooks.getAll returns empty array", async () => {
		expect(await da.deferredHooks.getAll()).toEqual([]);
	});

	test("deferredHooks.getForSession returns empty array", async () => {
		expect(await da.deferredHooks.getForSession("s")).toEqual([]);
	});

	test("deferredHooks.updateStatus returns true", async () => {
		expect(await da.deferredHooks.updateStatus("id", "done")).toBe(true);
	});

	test("deferredHooks.complete returns true", async () => {
		expect(await da.deferredHooks.complete("id")).toBe(true);
	});

	test("deferredHooks.fail returns true", async () => {
		expect(await da.deferredHooks.fail("id", "err")).toBe(true);
	});

	test("getHookCache returns null", async () => {
		expect(await da.getHookCache("s", "k")).toBeNull();
	});

	test("setHookCache returns true", async () => {
		expect(
			await da.setHookCache({
				session_id: "s",
				hook_key: "k",
				file_hashes: "h",
				result: "r",
			}),
		).toBe(true);
	});

	test("coordinator.isCoordinator returns false", () => {
		expect(da.coordinator.isCoordinator()).toBe(false);
	});

	test("coordinator.getHeartbeatInterval returns 5000", () => {
		expect(da.coordinator.getHeartbeatInterval()).toBe(5000);
	});

	test("coordinator.getStaleLockTimeout returns 30000", () => {
		expect(da.coordinator.getStaleLockTimeout()).toBe(30000);
	});

	test("watcher.isRunning returns false", () => {
		expect(da.watcher.isRunning()).toBe(false);
	});

	test("watcher.getDefaultPath ends with .claude/projects", () => {
		const path = da.watcher.getDefaultPath();
		expect(path).toContain(".claude");
		expect(path).toEndWith("projects");
	});

	test("watcher.setCallback is a no-op", () => {
		// Should not throw
		da.watcher.setCallback((_event: string, _path: string) => {});
	});

	test("watcher.clearCallback is a no-op", () => {
		da.watcher.clearCallback();
	});

	test("watcher.addWatchPath returns false", () => {
		expect(da.watcher.addWatchPath("/x")).toBe(false);
	});

	test("watcher.removeWatchPath returns false", () => {
		expect(da.watcher.removeWatchPath("/x")).toBe(false);
	});

	test("watcher.getWatchedPaths returns empty array", () => {
		expect(da.watcher.getWatchedPaths()).toEqual([]);
	});

	test("getActiveSessionForProject returns null", () => {
		expect(da.getActiveSessionForProject("/p")).toBeNull();
	});

	test("getConfigDirByPath returns null", async () => {
		expect(await da.getConfigDirByPath("/p")).toBeNull();
	});

	test("listConfigDirs returns empty array", async () => {
		expect(await da.listConfigDirs()).toEqual([]);
	});

	test("updateConfigDirLastIndexed returns true", async () => {
		expect(await da.updateConfigDirLastIndexed("/p")).toBe(true);
	});

	test("unregisterConfigDir returns true", async () => {
		expect(await da.unregisterConfigDir("/p")).toBe(true);
	});

	test("getDefaultConfigDir returns null", async () => {
		expect(await da.getDefaultConfigDir()).toBeNull();
	});

	test("getSessionModifiedFiles returns empty", async () => {
		const result = await da.getSessionModifiedFiles("s", "/p");
		expect(result.modifiedFiles).toEqual([]);
		expect(result.modifiedSinceLastHook).toEqual([]);
	});

	test("ensureSessionIndexed is a no-op", async () => {
		await expect(da.ensureSessionIndexed("s")).resolves.toBeUndefined();
	});

	test("indexer.needsReindex returns false", async () => {
		expect(await da.indexer.needsReindex("s")).toBe(false);
	});

	test("indexer.clearReindexFlag is a no-op", async () => {
		await expect(
			da.indexer.clearReindexFlag("s"),
		).resolves.toBeUndefined();
	});

	test("queryDashboardAggregates returns zeros", async () => {
		const agg = await da.queryDashboardAggregates();
		expect(agg.total_sessions).toBe(0);
		expect(agg.total_messages).toBe(0);
		expect(agg.total_tasks).toBe(0);
		expect(agg.total_hook_executions).toBe(0);
		expect(agg.session_stats).toEqual([]);
		expect(agg.tool_usage).toEqual([]);
	});

	test("queryActivityAggregates returns empty arrays", async () => {
		const agg = await da.queryActivityAggregates();
		expect(agg.daily_activity).toEqual([]);
		expect(agg.hourly_activity).toEqual([]);
		expect(agg.daily_costs).toEqual([]);
	});
});

// ============================================================================
// getDbPath
// ============================================================================

describe("getDbPath", () => {
	test("returns a path ending with han.db", () => {
		// Reset cached path so it recalculates
		da._resetDbState();
		const path = da.getDbPath();
		expect(path).toEndWith("han.db");
	});
});

// ============================================================================
// Legacy convenience functions delegate correctly
// ============================================================================

describe("legacy convenience functions", () => {
	test("getSession delegates to sessions.get", async () => {
		mockSessionsGet.mockResolvedValueOnce({ session: undefined });
		const result = await da.getSession("sess-1");
		expect(result).toBeNull();
		expect(mockSessionsGet).toHaveBeenCalledTimes(1);
	});

	test("listSessions delegates to sessions.list", async () => {
		mockSessionsList.mockResolvedValueOnce({ sessions: [] });
		const result = await da.listSessions({ limit: 5 });
		expect(result).toEqual([]);
		expect(mockSessionsList).toHaveBeenCalledTimes(1);
	});

	test("searchMessages delegates to messages.search", async () => {
		mockMemorySearch.mockResolvedValueOnce({ results: [] });
		const result = await da.searchMessages({ query: "test" });
		expect(result).toEqual([]);
		expect(mockMemorySearch).toHaveBeenCalledTimes(1);
	});

	test("upsertRepo throws coordinator-internal", async () => {
		await expect(
			da.upsertRepo({ remote_url: "x" }),
		).rejects.toThrow("coordinator-internal");
	});

	test("upsertProject throws coordinator-internal", async () => {
		await expect(
			da.upsertProject({ path: "/p", slug: "s" }),
		).rejects.toThrow("coordinator-internal");
	});

	test("upsertSession throws coordinator-internal", async () => {
		await expect(
			da.upsertSession({ session_id: "s" }),
		).rejects.toThrow("coordinator-internal");
	});

	test("insertMessagesBatch throws coordinator-internal", async () => {
		await expect(
			da.insertMessagesBatch({ session_id: "s", messages: [] }),
		).rejects.toThrow("coordinator-internal");
	});

	test("tryAcquireCoordinatorLock throws Rust coordinator", () => {
		expect(() => da.tryAcquireCoordinatorLock()).toThrow(
			"Rust coordinator",
		);
	});

	test("releaseCoordinatorLock throws Rust coordinator", () => {
		expect(() => da.releaseCoordinatorLock()).toThrow("Rust coordinator");
	});

	test("isCoordinator returns false", () => {
		expect(da.isCoordinator()).toBe(false);
	});

	test("getHeartbeatInterval returns 5000", () => {
		expect(da.getHeartbeatInterval()).toBe(5000);
	});

	test("getStaleLockTimeout returns 30000", () => {
		expect(da.getStaleLockTimeout()).toBe(30000);
	});
});

// ============================================================================
// Additional legacy convenience functions
// ============================================================================

describe("legacy convenience functions (additional)", () => {
	test("getRepoByRemote throws coordinator-internal", async () => {
		await expect(da.getRepoByRemote("x")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("listRepos throws coordinator-internal", async () => {
		await expect(da.listRepos()).rejects.toThrow("coordinator-internal");
	});

	test("getProjectBySlug throws coordinator-internal", async () => {
		await expect(da.getProjectBySlug("s")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("getProjectByPath throws coordinator-internal", async () => {
		await expect(da.getProjectByPath("/p")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("listProjects throws coordinator-internal", async () => {
		await expect(da.listProjects()).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("endSession throws coordinator-internal", async () => {
		await expect(da.endSession("s")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("getMessage throws GraphQL hint", async () => {
		await expect(da.getMessage("id")).rejects.toThrow(
			"use GraphQL query instead",
		);
	});

	test("listSessionMessages throws GraphQL hint", async () => {
		await expect(
			da.listSessionMessages({ sessionId: "s" }),
		).rejects.toThrow("use GraphQL query instead");
	});

	test("getMessageCount throws GraphQL hint", async () => {
		await expect(da.getMessageCount("s")).rejects.toThrow(
			"use GraphQL query instead",
		);
	});

	test("getLastIndexedLine throws coordinator-internal", async () => {
		await expect(da.getLastIndexedLine("s")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("createTask throws coordinator-internal", async () => {
		await expect(
			da.createTask({ session_id: "s", name: "t" }),
		).rejects.toThrow("coordinator-internal");
	});

	test("completeTask throws coordinator-internal", async () => {
		await expect(
			da.completeTask({
				session_id: "s",
				task_name: "t",
				duration_ms: 0,
			}),
		).rejects.toThrow("coordinator-internal");
	});

	test("failTask throws coordinator-internal", async () => {
		await expect(
			da.failTask({
				session_id: "s",
				task_name: "t",
				error: "e",
				duration_ms: 0,
			}),
		).rejects.toThrow("coordinator-internal");
	});

	test("getTask throws coordinator-internal", async () => {
		await expect(da.getTask("s", "t")).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("queryTaskMetrics throws coordinator-internal", async () => {
		await expect(da.queryTaskMetrics()).rejects.toThrow(
			"coordinator-internal",
		);
	});

	test("updateCoordinatorHeartbeat throws Rust coordinator", () => {
		expect(() => da.updateCoordinatorHeartbeat()).toThrow(
			"Rust coordinator",
		);
	});

	test("getCoordinatorStatus throws gRPC hint", () => {
		expect(() => da.getCoordinatorStatus()).toThrow(
			"gRPC CoordinatorService",
		);
	});

	test("startFileWatcher throws Rust coordinator", async () => {
		await expect(da.startFileWatcher()).rejects.toThrow(
			"Rust coordinator",
		);
	});

	test("stopFileWatcher throws Rust coordinator", () => {
		expect(() => da.stopFileWatcher()).toThrow("Rust coordinator");
	});

	test("isWatcherRunning returns false", () => {
		expect(da.isWatcherRunning()).toBe(false);
	});

	test("getDefaultWatchPath returns path", () => {
		expect(da.getDefaultWatchPath()).toEndWith("projects");
	});
});

// ============================================================================
// messages stub methods throw correct messages
// ============================================================================

describe("messages stubs", () => {
	test("messages.get throws GraphQL hint", async () => {
		await expect(da.messages.get("id")).rejects.toThrow(
			"use GraphQL query instead",
		);
	});

	test("messages.list throws GraphQL hint", async () => {
		await expect(
			da.messages.list({ sessionId: "s" }),
		).rejects.toThrow("use GraphQL query instead");
	});

	test("messages.count throws GraphQL hint", async () => {
		await expect(da.messages.count("s")).rejects.toThrow(
			"use GraphQL query instead",
		);
	});

	test("messages.countBatch throws GraphQL hint", async () => {
		await expect(da.messages.countBatch(["s"])).rejects.toThrow(
			"use GraphQL query instead",
		);
	});

	test("messages.getLastIndexedLine throws coordinator-internal", async () => {
		await expect(
			da.messages.getLastIndexedLine("s"),
		).rejects.toThrow("coordinator-internal");
	});

	test("messages.timestampsBatch throws GraphQL hint", async () => {
		await expect(
			da.messages.timestampsBatch(["s"]),
		).rejects.toThrow("use GraphQL query instead");
	});
});
