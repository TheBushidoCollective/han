/**
 * Backend Pool Tests
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	type BackendConfig,
	BackendPool,
	createBackendPool,
	getPoolConfig,
} from "../lib/commands/mcp/backend-pool.ts";

describe("BackendPool", () => {
	let pool: BackendPool;

	beforeEach(() => {
		pool = new BackendPool({ idle_timeout: 60, max_connections: 5 });
	});

	afterEach(async () => {
		await pool.disconnectAll();
	});

	describe("configuration", () => {
		test("uses default config when not specified", () => {
			const defaultPool = new BackendPool();
			const stats = defaultPool.getStats();
			expect(stats.activeConnections).toBe(0);
			expect(stats.cachedToolSets).toBe(0);
		});

		test("accepts custom config", () => {
			const customPool = new BackendPool({
				idle_timeout: 120,
				max_connections: 20,
			});
			const stats = customPool.getStats();
			expect(stats.activeConnections).toBe(0);
		});
	});

	describe("backend registration", () => {
		test("registers stdio backend", () => {
			const config: BackendConfig = {
				id: "test-backend",
				type: "stdio",
				command: "echo",
				args: ["hello"],
			};
			pool.registerBackend(config);
			expect(pool.getStats().registeredBackends).toBe(1);
		});

		test("registers http backend", () => {
			const config: BackendConfig = {
				id: "http-backend",
				type: "http",
				url: "http://localhost:3000",
			};
			pool.registerBackend(config);
			expect(pool.getStats().registeredBackends).toBe(1);
		});

		test("registers docker backend", () => {
			const config: BackendConfig = {
				id: "docker-backend",
				type: "docker",
				image: "mcp-server:latest",
			};
			pool.registerBackend(config);
			expect(pool.getStats().registeredBackends).toBe(1);
		});

		test("registers multiple backends", () => {
			pool.registerBackend({
				id: "backend-1",
				type: "http",
				url: "http://localhost:3001",
			});
			pool.registerBackend({
				id: "backend-2",
				type: "http",
				url: "http://localhost:3002",
			});
			pool.registerBackend({
				id: "backend-3",
				type: "http",
				url: "http://localhost:3003",
			});
			expect(pool.getStats().registeredBackends).toBe(3);
		});
	});

	describe("connection state", () => {
		test("isConnected returns false for unregistered backend", () => {
			expect(pool.isConnected("nonexistent")).toBe(false);
		});

		test("isConnected returns false for registered but not connected backend", () => {
			pool.registerBackend({
				id: "test",
				type: "http",
				url: "http://localhost:3000",
			});
			expect(pool.isConnected("test")).toBe(false);
		});

		test("getConnectedBackends returns empty array initially", () => {
			expect(pool.getConnectedBackends()).toEqual([]);
		});
	});

	describe("tool cache", () => {
		test("clearToolCache removes cached tools for specific backend", () => {
			// Manually set cache (internal state testing)
			(pool as unknown as { toolCache: Map<string, unknown[]> }).toolCache.set(
				"test-backend",
				[{ name: "tool1" }],
			);

			pool.clearToolCache("test-backend");

			// Cache should be empty
			const cache = (pool as unknown as { toolCache: Map<string, unknown[]> })
				.toolCache;
			expect(cache.has("test-backend")).toBe(false);
		});

		test("clearAllToolCaches removes all cached tools", () => {
			// Manually set cache
			const cache = (pool as unknown as { toolCache: Map<string, unknown[]> })
				.toolCache;
			cache.set("backend-1", [{ name: "tool1" }]);
			cache.set("backend-2", [{ name: "tool2" }]);

			pool.clearAllToolCaches();

			expect(cache.size).toBe(0);
		});
	});

	describe("error handling", () => {
		test("connect throws for unknown backend", async () => {
			await expect(pool.connect("unknown-backend")).rejects.toThrow(
				"Unknown backend",
			);
		});

		test("getTools throws for unknown backend", async () => {
			await expect(pool.getTools("unknown-backend")).rejects.toThrow(
				"Unknown backend",
			);
		});

		test("callTool throws for unknown backend", async () => {
			await expect(
				pool.callTool("unknown-backend", "tool", {}),
			).rejects.toThrow("Unknown backend");
		});
	});

	describe("disconnect", () => {
		test("disconnect is idempotent for non-existent backend", async () => {
			// Should not throw
			await pool.disconnect("nonexistent");
		});

		test("disconnectAll handles empty pool", async () => {
			// Should not throw
			await pool.disconnectAll();
		});
	});

	describe("stats", () => {
		test("getStats returns correct initial values", () => {
			const stats = pool.getStats();
			expect(stats).toEqual({
				activeConnections: 0,
				cachedToolSets: 0,
				registeredBackends: 0,
			});
		});

		test("getStats reflects registered backends", () => {
			pool.registerBackend({
				id: "b1",
				type: "http",
				url: "http://localhost:1",
			});
			pool.registerBackend({
				id: "b2",
				type: "http",
				url: "http://localhost:2",
			});

			const stats = pool.getStats();
			expect(stats.registeredBackends).toBe(2);
			expect(stats.activeConnections).toBe(0);
		});
	});
});

describe("createBackendPool", () => {
	test("creates pool with default config", () => {
		const pool = createBackendPool();
		expect(pool).toBeInstanceOf(BackendPool);
	});

	test("creates pool with custom config", () => {
		const pool = createBackendPool({
			idle_timeout: 600,
			max_connections: 15,
		});
		expect(pool).toBeInstanceOf(BackendPool);
	});
});

describe("getPoolConfig", () => {
	test("returns default config when no han.yml", () => {
		const config = getPoolConfig();
		// Should return defaults
		expect(config.idle_timeout).toBe(300);
		expect(config.max_connections).toBe(10);
	});
});
