import { describe, expect, it } from "bun:test";
import {
	FileEventType,
	type Session,
	coordinator,
	fts,
	getDbPath,
	indexer,
	sessionFileValidations,
	sessions,
	vectors,
	watcher,
} from "../lib/grpc/data-access.ts";

import * as mod from "../lib/grpc/data-access.ts";

describe("gRPC Data Access Layer", () => {
	it("exports all expected namespaces", () => {
		// Core entity namespaces
		expect(mod.repos).toBeDefined();
		expect(mod.projects).toBeDefined();
		expect(mod.sessions).toBeDefined();
		expect(mod.messages).toBeDefined();
		expect(mod.tasks).toBeDefined();

		// Tracking namespaces
		expect(mod.hookExecutions).toBeDefined();
		expect(mod.hookAttempts).toBeDefined();
		expect(mod.deferredHooks).toBeDefined();
		expect(mod.frustrations).toBeDefined();
		expect(mod.sessionFileChanges).toBeDefined();
		expect(mod.sessionFileValidations).toBeDefined();
		expect(mod.sessionTodos).toBeDefined();
		expect(mod.nativeTasks).toBeDefined();

		// Search namespaces
		expect(mod.fts).toBeDefined();
		expect(mod.vectors).toBeDefined();

		// Coordinator/infra namespaces
		expect(mod.coordinator).toBeDefined();
		expect(mod.watcher).toBeDefined();
		expect(mod.indexer).toBeDefined();
	});

	it("exports FileEventType enum", () => {
		expect(FileEventType.Created).toBe("Created");
		expect(FileEventType.Modified).toBe("Modified");
		expect(FileEventType.Removed).toBe("Removed");
	});

	it("getDbPath returns a valid path", () => {
		const path = getDbPath();
		expect(path).toContain("han.db");
	});

	it("coordinator.isCoordinator returns false for CLI", () => {
		expect(coordinator.isCoordinator()).toBe(false);
	});

	it("watcher returns safe defaults", () => {
		expect(watcher.isRunning()).toBe(false);
		expect(watcher.getDefaultPath()).toContain("projects");
	});

	it("sessionFileValidations.needsValidation returns true", async () => {
		const result = await sessionFileValidations.needsValidation(
			"test-session",
			"/test/file.ts",
			"lint",
			"abc123",
			"def456",
		);
		expect(result).toBe(true);
	});
});
