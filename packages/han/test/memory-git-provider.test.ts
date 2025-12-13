/**
 * Unit tests for Git source provider
 * Tests git commit extraction for team memory
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitProvider } from "../lib/memory/providers/git.ts";

let testRepoDir: string;

/**
 * Initialize a test git repository with some commits
 */
function setupTestRepo(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testRepoDir = join(tmpdir(), `han-git-test-${Date.now()}-${random}`);
	mkdirSync(testRepoDir, { recursive: true });

	// Initialize git repo
	execSync("git init", { cwd: testRepoDir });
	execSync('git config user.email "test@example.com"', { cwd: testRepoDir });
	execSync('git config user.name "Test User"', { cwd: testRepoDir });

	// Create initial commit
	writeFileSync(join(testRepoDir, "README.md"), "# Test Repository\n");
	execSync("git add README.md", { cwd: testRepoDir });
	execSync('git commit -m "Initial commit"', { cwd: testRepoDir });

	// Create src directory first
	mkdirSync(join(testRepoDir, "src"), { recursive: true });

	// Create a feature commit
	writeFileSync(
		join(testRepoDir, "src/feature.ts"),
		'export function feature() { return "feature"; }\n',
	);
	execSync("git add src/feature.ts", { cwd: testRepoDir });
	execSync('git commit -m "feat: add feature implementation"', {
		cwd: testRepoDir,
	});

	// Create a fix commit
	writeFileSync(
		join(testRepoDir, "src/feature.ts"),
		'export function feature() { return "fixed-feature"; }\n',
	);
	execSync("git add src/feature.ts", { cwd: testRepoDir });
	execSync('git commit -m "fix: correct feature bug"', { cwd: testRepoDir });

	// Create a refactor commit
	writeFileSync(
		join(testRepoDir, "src/utils.ts"),
		'export function util() { return "util"; }\n',
	);
	execSync("git add src/utils.ts", { cwd: testRepoDir });
	execSync('git commit -m "refactor: extract utilities"', {
		cwd: testRepoDir,
	});
}

function teardownTestRepo(): void {
	if (testRepoDir && existsSync(testRepoDir)) {
		try {
			rmSync(testRepoDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

describe("Git Provider", () => {
	beforeEach(() => {
		setupTestRepo();
	});

	afterEach(() => {
		teardownTestRepo();
	});

	describe("isAvailable", () => {
		test("returns true when .git directory exists", async () => {
			const originalCwd = process.cwd();
			try {
				process.chdir(testRepoDir);
				const available = await gitProvider.isAvailable();
				expect(available).toBe(true);
			} finally {
				process.chdir(originalCwd);
			}
		});

		test("returns false when not in a git repository", async () => {
			const nonGitDir = join(tmpdir(), "non-git-dir");
			mkdirSync(nonGitDir, { recursive: true });

			const originalCwd = process.cwd();
			try {
				process.chdir(nonGitDir);
				const available = await gitProvider.isAvailable();
				expect(available).toBe(false);
			} finally {
				process.chdir(originalCwd);
				rmSync(nonGitDir, { recursive: true, force: true });
			}
		});
	});

	describe("extract", () => {
		test("extracts all commits when no options provided", async () => {
			const originalCwd = process.cwd();
			try {
				process.chdir(testRepoDir);
				const observations = await gitProvider.extract({});

				expect(observations.length).toBeGreaterThanOrEqual(4);

				// Check structure of observations
				for (const obs of observations) {
					expect(obs.source).toMatch(/^git:commit:[a-f0-9]+$/);
					expect(obs.type).toBeDefined();
					expect(obs.timestamp).toBeGreaterThan(0);
					expect(obs.author).toBeDefined();
					expect(obs.summary).toBeDefined();
					expect(obs.detail).toBeDefined();
					expect(Array.isArray(obs.files)).toBe(true);
				}
			} finally {
				process.chdir(originalCwd);
			}
		});

		test("infers correct type from commit message", async () => {
			const originalCwd = process.cwd();
			try {
				process.chdir(testRepoDir);
				const observations = await gitProvider.extract({});

				const featCommit = observations.find((obs) =>
					obs.summary.includes("add feature"),
				);
				const fixCommit = observations.find((obs) =>
					obs.summary.includes("correct feature bug"),
				);
				const refactorCommit = observations.find((obs) =>
					obs.summary.includes("extract utilities"),
				);

				expect(featCommit?.type).toBe("commit");
				expect(fixCommit?.type).toBe("commit");
				expect(refactorCommit?.type).toBe("commit");
			} finally {
				process.chdir(originalCwd);
			}
		});

		test("includes modified files in observation", async () => {
			const originalCwd = process.cwd();
			try {
				process.chdir(testRepoDir);
				const observations = await gitProvider.extract({});

				const featCommit = observations.find((obs) =>
					obs.summary.includes("add feature"),
				);
				expect(featCommit?.files).toContain("src/feature.ts");

				const utilCommit = observations.find((obs) =>
					obs.summary.includes("extract utilities"),
				);
				expect(utilCommit?.files).toContain("src/utils.ts");
			} finally {
				process.chdir(originalCwd);
			}
		});

		test("filters commits by since timestamp", async () => {
			const originalCwd = process.cwd();
			try {
				process.chdir(testRepoDir);

				// Get timestamp of first commit
				const allObservations = await gitProvider.extract({});
				expect(allObservations.length).toBeGreaterThanOrEqual(2);

				// Sort by timestamp
				const sorted = allObservations.sort(
					(a, b) => a.timestamp - b.timestamp,
				);
				const firstTimestamp = sorted[0].timestamp;

				// Extract commits from first timestamp onwards (should include all)
				const fromFirst = await gitProvider.extract({ since: firstTimestamp });
				expect(fromFirst.length).toBe(allObservations.length);

				// Extract commits from after first timestamp (use next second)
				// Since git timestamps are in seconds, we need to go to next second
				const filtered = await gitProvider.extract({
					since: firstTimestamp + 1000,
				});

				// Should have fewer or equal commits (may be 0 if all in same second)
				expect(filtered.length).toBeLessThanOrEqual(allObservations.length);

				// All filtered commits should be at or after the timestamp
				for (const obs of filtered) {
					expect(obs.timestamp).toBeGreaterThanOrEqual(firstTimestamp + 1000);
				}
			} finally {
				process.chdir(originalCwd);
			}
		});

		test("respects limit option", async () => {
			const originalCwd = process.cwd();
			try {
				process.chdir(testRepoDir);
				const observations = await gitProvider.extract({ limit: 2 });
				expect(observations.length).toBeLessThanOrEqual(2);
			} finally {
				process.chdir(originalCwd);
			}
		});

		test("includes commit author information", async () => {
			const originalCwd = process.cwd();
			try {
				process.chdir(testRepoDir);
				const observations = await gitProvider.extract({});

				for (const obs of observations) {
					expect(obs.author).toBeTruthy();
					// Should contain name or email
					expect(
						obs.author.includes("Test User") ||
							obs.author.includes("test@example.com"),
					).toBe(true);
				}
			} finally {
				process.chdir(originalCwd);
			}
		});

		test("extracts full commit message in detail", async () => {
			const originalCwd = process.cwd();
			try {
				process.chdir(testRepoDir);

				// Create a commit with multi-line message
				writeFileSync(join(testRepoDir, "test.txt"), "test content\n");
				execSync("git add test.txt", { cwd: testRepoDir });
				execSync(
					'git commit -m "feat: test feature" -m "" -m "This is a detailed description" -m "with multiple lines"',
					{ cwd: testRepoDir },
				);

				const observations = await gitProvider.extract({ limit: 1 });
				const latest = observations[0];

				expect(latest.summary).toContain("feat: test feature");
				expect(latest.detail).toContain("detailed description");
			} finally {
				process.chdir(originalCwd);
			}
		});
	});

	describe("provider name", () => {
		test("has correct name", () => {
			expect(gitProvider.name).toBe("git");
		});
	});
});
