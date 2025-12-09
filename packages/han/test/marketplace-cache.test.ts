/**
 * Unit tests for marketplace-cache.ts
 * Tests marketplace cache operations using bun:test
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Import the module under test
import {
	getCacheAge,
	getMarketplacePlugins,
	hasCachedMarketplace,
	type MarketplaceCache,
	updateMarketplaceCache,
} from "../lib/marketplace-cache.ts";

// Store original environment and fetch
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

let tempDir: string;
let mockFetchSuccess = true;
const mockPlugins = [
	{ name: "bushido", description: "Core plugin", category: "Foundation" },
	{
		name: "jutsu-typescript",
		description: "TypeScript skills",
		category: "Technique",
	},
];

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	tempDir = join(tmpdir(), `han-test-cache-${Date.now()}-${random}`);
	mkdirSync(tempDir, { recursive: true });
	process.env.CLAUDE_CONFIG_DIR = tempDir;
	mockFetchSuccess = true;

	// Mock fetch
	globalThis.fetch = (async (_input: string | URL | Request) => {
		if (!mockFetchSuccess) {
			throw new Error("Network error");
		}

		return {
			ok: true,
			status: 200,
			statusText: "OK",
			json: async () => ({ plugins: mockPlugins }),
		} as Response;
	}) as typeof fetch;
}

function teardown(): void {
	// Restore original fetch
	globalThis.fetch = originalFetch;

	// Restore environment
	process.env = { ...originalEnv };

	// Clean up temp directory
	if (tempDir && existsSync(tempDir)) {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

describe("marketplace-cache.ts", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("hasCachedMarketplace returns false when no cache exists", () => {
		const hasCached = hasCachedMarketplace();
		expect(hasCached).toBe(false);
	});

	test("getCacheAge returns null when no cache exists", () => {
		const age = getCacheAge();
		expect(age).toBeNull();
	});

	test("getMarketplacePlugins fetches from GitHub when no cache", async () => {
		const { plugins, fromCache } = await getMarketplacePlugins();
		expect(fromCache).toBe(false);
		expect(plugins.length).toBe(2);
		expect(plugins[0].name).toBe("bushido");
	});

	test("hasCachedMarketplace returns true after fetching", async () => {
		// First fetch to populate cache
		await getMarketplacePlugins();

		const hasCached = hasCachedMarketplace();
		expect(hasCached).toBe(true);
	});

	test("getCacheAge returns age in hours", async () => {
		// First fetch to populate cache
		await getMarketplacePlugins();

		const age = getCacheAge();
		expect(age).not.toBeNull();
		if (age !== null) {
			expect(age).toBeLessThan(0.1); // Should be very recent (< 6 minutes)
		}
	});

	test("getMarketplacePlugins uses cache on second call", async () => {
		// First fetch to populate cache
		await getMarketplacePlugins();

		// Second call should use cache
		const { plugins, fromCache } = await getMarketplacePlugins();
		expect(fromCache).toBe(true);
		expect(plugins.length).toBe(2);
	});

	test("getMarketplacePlugins bypasses cache when forceRefresh is true", async () => {
		// First fetch to populate cache
		await getMarketplacePlugins();

		// Force refresh should bypass cache
		const { plugins, fromCache } = await getMarketplacePlugins(true);
		expect(fromCache).toBe(false);
		expect(plugins.length).toBe(2);
	});

	test("getMarketplacePlugins uses stale cache as fallback on network error", async () => {
		// First fetch to populate cache
		await getMarketplacePlugins();

		// Disable mock fetch to simulate network error
		mockFetchSuccess = false;

		const { plugins, fromCache } = await getMarketplacePlugins(true);
		expect(fromCache).toBe(true);
		expect(plugins.length).toBe(2);
	});

	test("updateMarketplaceCache forces refresh and returns plugins", async () => {
		const plugins = await updateMarketplaceCache();
		expect(plugins.length).toBe(2);
		expect(plugins[0].name).toBe("bushido");
	});

	test("cache is considered stale after 24+ hours", async () => {
		// First fetch to populate cache
		await getMarketplacePlugins();

		const cacheDir = join(tempDir, "cache");
		const cachePath = join(cacheDir, "han-marketplace.json");

		// Read current cache
		const cacheData = readFileSync(cachePath, "utf-8");
		const cache = JSON.parse(cacheData) as MarketplaceCache;

		// Modify timestamp to be 25 hours old
		const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
		cache.timestamp = twentyFiveHoursAgo;

		// Write back
		writeFileSync(cachePath, JSON.stringify(cache));

		// getCacheAge should now report ~25 hours
		const age = getCacheAge();
		expect(age).not.toBeNull();
		if (age !== null) {
			expect(age).toBeGreaterThan(24);
			expect(age).toBeLessThan(26);
		}
	});

	test("getMarketplacePlugins fetches fresh data when cache is stale", async () => {
		// First fetch to populate cache
		await getMarketplacePlugins();

		const cacheDir = join(tempDir, "cache");
		const cachePath = join(cacheDir, "han-marketplace.json");

		// Read current cache and make it stale
		const cacheData = readFileSync(cachePath, "utf-8");
		const cache = JSON.parse(cacheData) as MarketplaceCache;
		cache.timestamp = Date.now() - 25 * 60 * 60 * 1000;
		writeFileSync(cachePath, JSON.stringify(cache));

		// Should fetch fresh data since cache is stale
		const { plugins, fromCache } = await getMarketplacePlugins();
		expect(fromCache).toBe(false);
		expect(plugins.length).toBe(2);
	});

	test("handles corrupt cache JSON gracefully", async () => {
		// Create cache directory and write invalid JSON
		const cacheDir = join(tempDir, "cache");
		mkdirSync(cacheDir, { recursive: true });
		const cachePath = join(cacheDir, "han-marketplace.json");
		writeFileSync(cachePath, "{ not valid json at all");

		// hasCachedMarketplace returns true (file exists) but data is corrupt
		const hasCached = hasCachedMarketplace();
		expect(hasCached).toBe(true);

		// getCacheAge should return null for corrupt cache (can't parse timestamp)
		const age = getCacheAge();
		expect(age).toBeNull();

		// getMarketplacePlugins should fetch fresh data (corrupt cache treated as cache miss)
		const { plugins, fromCache } = await getMarketplacePlugins();
		expect(fromCache).toBe(false);
		expect(plugins.length).toBe(2);
	});

	test("handles non-ok response from GitHub", async () => {
		// Mock fetch to return error response
		globalThis.fetch = (async (_input: string | URL | Request) => {
			return {
				ok: false,
				status: 404,
				statusText: "Not Found",
				json: async () => ({}),
			} as Response;
		}) as typeof fetch;

		// Should throw an error when fetch fails and no cache exists
		try {
			await getMarketplacePlugins();
			expect(true).toBe(false); // Should not reach here
		} catch (error) {
			expect(error instanceof Error).toBe(true);
			expect((error as Error).message).toContain("Failed to fetch marketplace");
		}
	});
});
