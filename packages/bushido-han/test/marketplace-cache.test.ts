import { strictEqual } from "node:assert";
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
} from "../lib/marketplace-cache.js";

let testsPassed = 0;
let testsFailed = 0;

async function test(
	name: string,
	fn: () => void | Promise<void>,
): Promise<void> {
	try {
		await fn();
		console.log(`✓ ${name}`);
		testsPassed++;
	} catch (error) {
		console.error(`✗ ${name}`);
		console.error(`  ${(error as Error).message}`);
		testsFailed++;
	}
}

async function runTests(): Promise<void> {
	const originalEnv = { ...process.env };

	// ============================================
	// Setup - use temporary cache directory
	// ============================================
	const tempDir = join(tmpdir(), `han-test-cache-${Date.now()}`);
	mkdirSync(tempDir, { recursive: true });
	process.env.CLAUDE_CONFIG_DIR = tempDir;

	// ============================================
	// Tests
	// ============================================

	await test("hasCachedMarketplace returns false when no cache exists", () => {
		const hasCached = hasCachedMarketplace();
		strictEqual(hasCached, false);
	});

	await test("getCacheAge returns null when no cache exists", () => {
		const age = getCacheAge();
		strictEqual(age, null);
	});

	// Mock successful fetch for testing
	let mockFetchSuccess = true;
	const mockPlugins = [
		{ name: "bushido", description: "Core plugin", category: "Foundation" },
		{
			name: "jutsu-typescript",
			description: "TypeScript skills",
			category: "Technique",
		},
	];

	// Save original fetch
	const originalFetch = globalThis.fetch;

	// Mock fetch
	globalThis.fetch = async (_input: string | URL | Request) => {
		if (!mockFetchSuccess) {
			throw new Error("Network error");
		}

		return {
			ok: true,
			status: 200,
			statusText: "OK",
			json: async () => ({ plugins: mockPlugins }),
		} as Response;
	};

	await test("getMarketplacePlugins fetches from GitHub when no cache", async () => {
		const { plugins, fromCache } = await getMarketplacePlugins();
		strictEqual(fromCache, false);
		strictEqual(plugins.length, 2);
		strictEqual(plugins[0].name, "bushido");
	});

	await test("hasCachedMarketplace returns true after fetching", () => {
		const hasCached = hasCachedMarketplace();
		strictEqual(hasCached, true);
	});

	await test("getCacheAge returns age in hours", () => {
		const age = getCacheAge();
		strictEqual(age !== null, true);
		if (age !== null) {
			strictEqual(age < 0.1, true); // Should be very recent (< 6 minutes)
		}
	});

	await test("getMarketplacePlugins uses cache on second call", async () => {
		const { plugins, fromCache } = await getMarketplacePlugins();
		strictEqual(fromCache, true);
		strictEqual(plugins.length, 2);
	});

	await test("getMarketplacePlugins bypasses cache when forceRefresh is true", async () => {
		const { plugins, fromCache } = await getMarketplacePlugins(true);
		strictEqual(fromCache, false);
		strictEqual(plugins.length, 2);
	});

	await test("getMarketplacePlugins uses stale cache as fallback on network error", async () => {
		// Disable mock fetch to simulate network error
		mockFetchSuccess = false;

		const { plugins, fromCache } = await getMarketplacePlugins(true);
		strictEqual(fromCache, true);
		strictEqual(plugins.length, 2);

		// Re-enable for remaining tests
		mockFetchSuccess = true;
	});

	await test("updateMarketplaceCache forces refresh and returns plugins", async () => {
		const plugins = await updateMarketplaceCache();
		strictEqual(plugins.length, 2);
		strictEqual(plugins[0].name, "bushido");
	});

	await test("cache is considered stale after 24+ hours", () => {
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
		strictEqual(age !== null, true);
		if (age !== null) {
			strictEqual(age > 24, true);
			strictEqual(age < 26, true);
		}
	});

	await test("getMarketplacePlugins fetches fresh data when cache is stale", async () => {
		// Cache is stale from previous test
		const { plugins, fromCache } = await getMarketplacePlugins();

		// Should fetch fresh data
		strictEqual(fromCache, false);
		strictEqual(plugins.length, 2);
	});

	// ============================================
	// Cleanup
	// ============================================

	// Restore original fetch
	globalThis.fetch = originalFetch;

	// Restore environment
	process.env = originalEnv;

	// Clean up temp directory
	if (existsSync(tempDir)) {
		rmSync(tempDir, { recursive: true, force: true });
	}

	// ============================================
	// Summary
	// ============================================

	console.log("\n============================================");
	console.log(`Tests passed: ${testsPassed}`);
	console.log(`Tests failed: ${testsFailed}`);
	console.log("============================================");

	if (testsFailed > 0) {
		process.exit(1);
	}
}

runTests().catch((error) => {
	console.error("Test runner error:", error);
	process.exit(1);
});
