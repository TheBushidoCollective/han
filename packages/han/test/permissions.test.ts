/**
 * Unit tests for permission system
 *
 * Tests repo ownership parsing, cache operations, and permission service
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	buildRepoUrl,
	createLocalPermissionService,
	createPermissionService,
	getProviderFromUrl,
	isLikelyPersonalRepo,
	normalizeRepoId,
	parseRemoteUrl,
	PermissionCache,
	type AuthenticatedUser,
} from "../lib/permissions/index.ts";

// ============================================================================
// Repo Ownership Parsing Tests
// ============================================================================

describe("parseRemoteUrl", () => {
	describe("GitHub URLs", () => {
		test("parses SSH format", () => {
			const result = parseRemoteUrl("git@github.com:owner/repo.git");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
			expect(result?.repo).toBe("repo");
			expect(result?.provider).toBe("github");
		});

		test("parses SSH format without .git extension", () => {
			const result = parseRemoteUrl("git@github.com:owner/repo");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
			expect(result?.repo).toBe("repo");
		});

		test("parses HTTPS format", () => {
			const result = parseRemoteUrl("https://github.com/owner/repo.git");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
			expect(result?.repo).toBe("repo");
			expect(result?.provider).toBe("github");
		});

		test("parses HTTPS format without .git extension", () => {
			const result = parseRemoteUrl("https://github.com/owner/repo");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
			expect(result?.repo).toBe("repo");
		});

		test("parses SSH protocol format", () => {
			const result = parseRemoteUrl("ssh://git@github.com/owner/repo.git");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
			expect(result?.repo).toBe("repo");
			expect(result?.provider).toBe("github");
		});

		test("parses git protocol format", () => {
			const result = parseRemoteUrl("git://github.com/owner/repo.git");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
			expect(result?.repo).toBe("repo");
			expect(result?.provider).toBe("github");
		});
	});

	describe("GitLab URLs", () => {
		test("parses SSH format", () => {
			const result = parseRemoteUrl("git@gitlab.com:owner/repo.git");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
			expect(result?.repo).toBe("repo");
			expect(result?.provider).toBe("gitlab");
		});

		test("parses HTTPS format", () => {
			const result = parseRemoteUrl("https://gitlab.com/owner/repo.git");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
			expect(result?.repo).toBe("repo");
			expect(result?.provider).toBe("gitlab");
		});

		test("parses nested group format", () => {
			const result = parseRemoteUrl("git@gitlab.com:group/subgroup/repo.git");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("group/subgroup");
			expect(result?.repo).toBe("repo");
			expect(result?.provider).toBe("gitlab");
		});
	});

	describe("Bitbucket URLs", () => {
		test("parses SSH format", () => {
			const result = parseRemoteUrl("git@bitbucket.org:owner/repo.git");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
			expect(result?.repo).toBe("repo");
			expect(result?.provider).toBe("bitbucket");
		});

		test("parses HTTPS format", () => {
			const result = parseRemoteUrl("https://bitbucket.org/owner/repo.git");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
			expect(result?.repo).toBe("repo");
			expect(result?.provider).toBe("bitbucket");
		});
	});

	describe("Edge cases", () => {
		test("returns null for invalid URL", () => {
			const result = parseRemoteUrl("not-a-url");
			expect(result).toBeNull();
		});

		test("returns null for unknown provider", () => {
			const result = parseRemoteUrl("git@example.com:owner/repo.git");
			expect(result).toBeNull();
		});

		test("trims whitespace", () => {
			const result = parseRemoteUrl("  git@github.com:owner/repo.git  ");
			expect(result).not.toBeNull();
			expect(result?.owner).toBe("owner");
		});
	});
});

describe("normalizeRepoId", () => {
	test("lowercases owner and repo", () => {
		expect(normalizeRepoId("Owner", "Repo")).toBe("owner/repo");
	});

	test("handles already lowercase", () => {
		expect(normalizeRepoId("owner", "repo")).toBe("owner/repo");
	});
});

describe("isLikelyPersonalRepo", () => {
	test("returns true when owner matches current user", () => {
		expect(isLikelyPersonalRepo("jsmith", "jsmith")).toBe(true);
		expect(isLikelyPersonalRepo("JSmith", "jsmith")).toBe(true);
	});

	test("returns false for org-like names", () => {
		expect(isLikelyPersonalRepo("acme-inc")).toBe(false);
		expect(isLikelyPersonalRepo("company-corp")).toBe(false);
		expect(isLikelyPersonalRepo("mycompany-labs")).toBe(false);
	});

	test("returns true for generic names", () => {
		expect(isLikelyPersonalRepo("johnsmith")).toBe(true);
		expect(isLikelyPersonalRepo("developer123")).toBe(true);
	});
});

describe("getProviderFromUrl", () => {
	test("detects GitHub", () => {
		expect(getProviderFromUrl("https://github.com/owner/repo")).toBe("github");
		expect(getProviderFromUrl("git@github.com:owner/repo.git")).toBe("github");
	});

	test("detects GitLab", () => {
		expect(getProviderFromUrl("https://gitlab.com/owner/repo")).toBe("gitlab");
	});

	test("detects Bitbucket", () => {
		expect(getProviderFromUrl("https://bitbucket.org/owner/repo")).toBe("bitbucket");
	});

	test("returns unknown for other URLs", () => {
		expect(getProviderFromUrl("https://example.com/owner/repo")).toBe("unknown");
	});
});

describe("buildRepoUrl", () => {
	test("builds GitHub HTTPS URL", () => {
		const ownership = {
			owner: "octocat",
			repo: "hello-world",
			isOrg: false,
			provider: "github" as const,
			remoteUrl: "",
		};
		expect(buildRepoUrl(ownership, "https")).toBe("https://github.com/octocat/hello-world");
	});

	test("builds GitHub SSH URL", () => {
		const ownership = {
			owner: "octocat",
			repo: "hello-world",
			isOrg: false,
			provider: "github" as const,
			remoteUrl: "",
		};
		expect(buildRepoUrl(ownership, "ssh")).toBe("git@github.com:octocat/hello-world.git");
	});

	test("builds GitLab HTTPS URL", () => {
		const ownership = {
			owner: "group/subgroup",
			repo: "project",
			isOrg: true,
			provider: "gitlab" as const,
			remoteUrl: "",
		};
		expect(buildRepoUrl(ownership, "https")).toBe("https://gitlab.com/group/subgroup/project");
	});
});

// ============================================================================
// Permission Cache Tests
// ============================================================================

describe("PermissionCache", () => {
	let cache: PermissionCache;

	beforeEach(() => {
		cache = new PermissionCache(5000, 100); // 5 second TTL, 100 max entries
	});

	afterEach(() => {
		cache.clear();
	});

	test("stores and retrieves permissions", () => {
		cache.set("user1", "owner/repo1", "read");

		const result = cache.get("user1", "owner/repo1");
		expect(result).not.toBeUndefined();
		expect(result?.accessLevel).toBe("read");
	});

	test("is case-insensitive", () => {
		cache.set("User1", "Owner/Repo1", "write");

		const result = cache.get("user1", "owner/repo1");
		expect(result).not.toBeUndefined();
		expect(result?.accessLevel).toBe("write");
	});

	test("returns undefined for missing entries", () => {
		const result = cache.get("user1", "owner/repo1");
		expect(result).toBeUndefined();
	});

	test("returns undefined for expired entries", async () => {
		const shortCache = new PermissionCache(100, 100); // 100ms TTL
		shortCache.set("user1", "owner/repo1", "read");

		// Wait for expiry
		await new Promise((resolve) => setTimeout(resolve, 150));

		const result = shortCache.get("user1", "owner/repo1");
		expect(result).toBeUndefined();
	});

	test("invalidates user entries", () => {
		cache.set("user1", "owner/repo1", "read");
		cache.set("user1", "owner/repo2", "write");
		cache.set("user2", "owner/repo1", "admin");

		const count = cache.invalidateUser("user1");
		expect(count).toBe(2);

		expect(cache.get("user1", "owner/repo1")).toBeUndefined();
		expect(cache.get("user1", "owner/repo2")).toBeUndefined();
		expect(cache.get("user2", "owner/repo1")).not.toBeUndefined();
	});

	test("invalidates repo entries", () => {
		cache.set("user1", "owner/repo1", "read");
		cache.set("user2", "owner/repo1", "write");
		cache.set("user1", "owner/repo2", "admin");

		const count = cache.invalidateRepo("owner/repo1");
		expect(count).toBe(2);

		expect(cache.get("user1", "owner/repo1")).toBeUndefined();
		expect(cache.get("user2", "owner/repo1")).toBeUndefined();
		expect(cache.get("user1", "owner/repo2")).not.toBeUndefined();
	});

	test("evicts LRU entries when at capacity", () => {
		const smallCache = new PermissionCache(60000, 3);

		smallCache.set("user1", "repo1", "read");
		smallCache.set("user1", "repo2", "read");
		smallCache.set("user1", "repo3", "read");

		// Access repo1 to make it recently used
		smallCache.get("user1", "repo1");

		// Add new entry, should evict repo2 (LRU)
		smallCache.set("user1", "repo4", "read");

		expect(smallCache.get("user1", "repo1")).not.toBeUndefined();
		expect(smallCache.get("user1", "repo2")).toBeUndefined(); // Evicted
		expect(smallCache.get("user1", "repo3")).not.toBeUndefined();
		expect(smallCache.get("user1", "repo4")).not.toBeUndefined();
	});

	test("reports accurate stats", () => {
		cache.set("user1", "repo1", "read");
		cache.set("user1", "repo2", "write");

		const stats = cache.stats();
		expect(stats.size).toBe(2);
		expect(stats.validEntries).toBe(2);
		expect(stats.expiredEntries).toBe(0);
	});

	test("cleanup removes expired entries", async () => {
		const shortCache = new PermissionCache(100, 100);
		shortCache.set("user1", "repo1", "read");
		shortCache.set("user1", "repo2", "write");

		await new Promise((resolve) => setTimeout(resolve, 150));

		const cleaned = shortCache.cleanup();
		expect(cleaned).toBe(2);
		expect(shortCache.stats().size).toBe(0);
	});
});

// ============================================================================
// Permission Service Tests
// ============================================================================

describe("PermissionService", () => {
	const mockUser: AuthenticatedUser = {
		id: "12345",
		username: "testuser",
		email: "test@example.com",
		provider: "github",
		accessToken: "mock-token",
	};

	describe("createLocalPermissionService", () => {
		test("always allows session access", async () => {
			const service = createLocalPermissionService();

			const result = await service.canViewSession({
				sessionId: "session-123",
				repoRemote: "git@github.com:someorg/private-repo.git",
			});

			expect(result.allowed).toBe(true);
			expect(result.source).toBe("override");
		});

		test("always allows aggregated metrics", async () => {
			const service = createLocalPermissionService();

			const result = await service.canViewAggregatedMetrics("some-org");

			expect(result.allowed).toBe(true);
		});
	});

	describe("createPermissionService", () => {
		test("allows access to sessions without repo remote", async () => {
			const service = createPermissionService(mockUser);

			const result = await service.canViewSession({
				sessionId: "session-123",
				// No repoRemote - local session
			});

			expect(result.allowed).toBe(true);
			expect(result.reason).toContain("Local session");
		});

		test("allows access to user's own repos", async () => {
			const service = createPermissionService(mockUser);

			const result = await service.canViewSession({
				sessionId: "session-123",
				repoRemote: "git@github.com:testuser/my-repo.git",
			});

			expect(result.allowed).toBe(true);
			expect(result.reason).toContain("owner");
		});

		test("denies access when repo URL cannot be parsed", async () => {
			const service = createPermissionService(mockUser);

			const result = await service.canViewSession({
				sessionId: "session-123",
				repoRemote: "invalid-url",
			});

			expect(result.allowed).toBe(false);
			expect(result.reason).toContain("Could not parse");
		});

		test("returns current user", () => {
			const service = createPermissionService(mockUser);
			expect(service.getUser()).toEqual(mockUser);
		});

		test("invalidates cache", () => {
			const service = createPermissionService(mockUser);
			// Should not throw
			const count = service.invalidateCache();
			expect(typeof count).toBe("number");
		});
	});
});
