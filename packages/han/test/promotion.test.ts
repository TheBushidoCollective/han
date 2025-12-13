/**
 * Tests for the Auto-Promotion Engine
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	autoPromotePatterns,
	clearPatternStore,
	type DetectedPattern,
	type Evidence,
	extractPatterns,
	extractPatternsFromEvidence,
	getPatternStats,
	getPromotionCandidates,
	type IndexedObservation,
	inferDomain,
	promotePattern,
	trackPattern,
} from "../lib/memory/index.ts";

describe("Auto-Promotion Engine", () => {
	let testDir: string;

	beforeEach(() => {
		const random = Math.random().toString(36).substring(2, 9);
		testDir = join(tmpdir(), `han-promotion-test-${Date.now()}-${random}`);
		mkdirSync(testDir, { recursive: true });
		clearPatternStore();
	});

	afterEach(() => {
		clearPatternStore();
		if (testDir && existsSync(testDir)) {
			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	describe("inferDomain", () => {
		test("detects testing domain", () => {
			expect(inferDomain("Add unit tests for authentication")).toBe("testing");
		});

		test("detects api domain", () => {
			expect(inferDomain("Update API endpoint for users")).toBe("api");
		});

		test("detects auth domain", () => {
			expect(inferDomain("Implement JWT authentication")).toBe("auth");
		});

		test("detects database domain", () => {
			expect(inferDomain("Add migration for users table")).toBe("database");
		});

		test("detects error domain", () => {
			expect(inferDomain("Handle errors in payment processing")).toBe("error");
		});

		test("detects logging domain", () => {
			expect(inferDomain("Add logger for debugging issues")).toBe("logging");
		});

		test("detects config domain", () => {
			expect(inferDomain("Update environment configuration")).toBe("config");
		});

		test("detects build domain", () => {
			expect(inferDomain("Fix webpack build configuration")).toBe("build");
		});

		test("detects commands domain", () => {
			expect(inferDomain("Add npm script for testing")).toBe("commands");
		});

		test("falls back to general for unknown", () => {
			expect(inferDomain("Refactor component structure")).toBe("general");
		});
	});

	describe("extractPatterns", () => {
		test("extracts patterns from observations", () => {
			const observations: IndexedObservation[] = [
				{
					id: "1",
					source: "git:commit:abc",
					type: "commit",
					timestamp: Date.now(),
					author: "alice",
					summary: "Add unit tests for user service",
					detail: "Added comprehensive test suite",
					files: ["test/user.test.ts"],
					patterns: [],
				},
				{
					id: "2",
					source: "git:commit:def",
					type: "commit",
					timestamp: Date.now(),
					author: "bob",
					summary: "Add unit tests for auth service",
					detail: "Testing auth flows",
					files: ["test/auth.test.ts"],
					patterns: [],
				},
			];

			const patterns = extractPatterns(observations);
			expect(patterns.length).toBeGreaterThan(0);
			expect(patterns[0].domain).toBe("testing");
		});

		test("skips low-quality observations", () => {
			const observations: IndexedObservation[] = [
				{
					id: "1",
					source: "git:commit:abc",
					type: "commit",
					timestamp: Date.now(),
					author: "alice",
					summary: "fix",
					detail: "",
					files: [],
					patterns: [],
				},
			];

			const patterns = extractPatterns(observations);
			expect(patterns).toHaveLength(0);
		});

		test("increases confidence for duplicate patterns", () => {
			const observations: IndexedObservation[] = [
				{
					id: "1",
					source: "git:commit:abc",
					type: "commit",
					timestamp: Date.now(),
					author: "alice",
					summary: "Add unit tests for service A",
					detail: "Testing service A",
					files: [],
					patterns: [],
				},
				{
					id: "2",
					source: "git:commit:def",
					type: "commit",
					timestamp: Date.now(),
					author: "bob",
					summary: "Add unit tests for service A",
					detail: "More tests",
					files: [],
					patterns: [],
				},
			];

			const patterns = extractPatterns(observations);
			expect(patterns.length).toBe(1);
			expect(patterns[0].occurrences).toBe(2);
			expect(patterns[0].confidence).toBeGreaterThan(0.5);
		});
	});

	describe("extractPatternsFromEvidence", () => {
		test("extracts patterns from research evidence", () => {
			const evidence: Evidence[] = [
				{
					claim: "We use vitest for all unit testing",
					confidence: 0.9,
					citation: {
						source: "git:commit:abc",
						excerpt: "Use vitest for testing",
						relevance: 0.9,
						author: "alice",
						timestamp: Date.now(),
					},
				},
			];

			const patterns = extractPatternsFromEvidence(evidence);
			expect(patterns.length).toBe(1);
			expect(patterns[0].domain).toBe("testing");
			expect(patterns[0].confidence).toBe(0.9);
		});

		test("skips short evidence", () => {
			const evidence: Evidence[] = [
				{
					claim: "test",
					confidence: 0.9,
					citation: {
						source: "git:commit:abc",
						excerpt: "test",
						relevance: 0.9,
					},
				},
			];

			const patterns = extractPatternsFromEvidence(evidence);
			expect(patterns).toHaveLength(0);
		});
	});

	describe("trackPattern", () => {
		test("tracks new patterns", () => {
			const pattern: DetectedPattern = {
				id: "testing:add-unit-tests",
				domain: "testing",
				description: "Add unit tests",
				confidence: 0.5,
				occurrences: 1,
				sources: [{ type: "commit", id: "abc" }],
				ruleContent: "- Add unit tests",
			};

			trackPattern(pattern);
			const stats = getPatternStats();
			expect(stats.totalPatterns).toBe(1);
		});

		test("accumulates occurrences for existing patterns", () => {
			const pattern: DetectedPattern = {
				id: "testing:add-unit-tests",
				domain: "testing",
				description: "Add unit tests",
				confidence: 0.5,
				occurrences: 1,
				sources: [{ type: "commit", id: "abc" }],
				ruleContent: "- Add unit tests",
			};

			trackPattern(pattern);
			trackPattern(pattern);
			trackPattern(pattern);

			const candidates = getPromotionCandidates();
			expect(candidates.length).toBe(1);
			expect(candidates[0].occurrences).toBe(3);
			expect(candidates[0].confidence).toBeGreaterThanOrEqual(0.8);
		});
	});

	describe("getPromotionCandidates", () => {
		test("returns patterns meeting criteria", () => {
			const pattern: DetectedPattern = {
				id: "testing:always-test",
				domain: "testing",
				description: "Always write tests",
				confidence: 0.85,
				occurrences: 3,
				sources: [
					{ type: "commit", id: "abc", author: "alice" },
					{ type: "commit", id: "def", author: "bob" },
					{ type: "commit", id: "ghi", author: "charlie" },
				],
				ruleContent: "- Always write tests",
			};

			trackPattern(pattern);
			const candidates = getPromotionCandidates();

			expect(candidates.length).toBe(1);
			expect(candidates[0].id).toBe("testing:always-test");
		});

		test("excludes patterns below threshold", () => {
			const pattern: DetectedPattern = {
				id: "testing:maybe-test",
				domain: "testing",
				description: "Maybe write tests",
				confidence: 0.5,
				occurrences: 1,
				sources: [{ type: "commit", id: "abc" }],
				ruleContent: "- Maybe write tests",
			};

			trackPattern(pattern);
			const candidates = getPromotionCandidates();

			expect(candidates).toHaveLength(0);
		});
	});

	describe("promotePattern", () => {
		test("creates rules file if not exists", () => {
			const pattern: DetectedPattern = {
				id: "testing:always-test",
				domain: "testing",
				description: "Always write tests for new features",
				confidence: 0.9,
				occurrences: 5,
				sources: [],
				ruleContent: "- Always write tests for new features",
			};

			const result = promotePattern(pattern, testDir);

			expect(result.promoted).toBe(true);
			expect(result.domain).toBe("testing");

			const rulesPath = join(testDir, ".claude", "rules", "testing.md");
			expect(existsSync(rulesPath)).toBe(true);

			const content = readFileSync(rulesPath, "utf-8");
			expect(content).toContain("Testing Conventions");
			expect(content).toContain("Always write tests for new features");
		});

		test("appends to existing rules file", () => {
			// Create initial rules file
			const rulesDir = join(testDir, ".claude", "rules");
			mkdirSync(rulesDir, { recursive: true });
			const rulesPath = join(rulesDir, "testing.md");
			const initialContent = "# Testing Conventions\n\n- Existing rule\n";
			require("fs").writeFileSync(rulesPath, initialContent);

			const pattern: DetectedPattern = {
				id: "testing:new-rule",
				domain: "testing",
				description: "New rule for testing",
				confidence: 0.9,
				occurrences: 5,
				sources: [],
				ruleContent: "- New rule for testing",
			};

			const result = promotePattern(pattern, testDir);

			expect(result.promoted).toBe(true);

			const content = readFileSync(rulesPath, "utf-8");
			expect(content).toContain("Existing rule");
			expect(content).toContain("New rule for testing");
		});

		test("skips already documented patterns", () => {
			// Create rules file with pattern
			const rulesDir = join(testDir, ".claude", "rules");
			mkdirSync(rulesDir, { recursive: true });
			const rulesPath = join(rulesDir, "testing.md");
			const content = "# Testing Conventions\n\n- Always write tests\n";
			require("fs").writeFileSync(rulesPath, content);

			const pattern: DetectedPattern = {
				id: "testing:always-tests",
				domain: "testing",
				description: "Always write tests",
				confidence: 0.9,
				occurrences: 5,
				sources: [],
				ruleContent: "- Always write tests",
			};

			const result = promotePattern(pattern, testDir);

			expect(result.promoted).toBe(false);
			expect(result.reason).toContain("already documented");
		});
	});

	describe("autoPromotePatterns", () => {
		test("promotes all ready patterns", () => {
			// Track patterns that meet criteria
			for (let i = 0; i < 3; i++) {
				trackPattern({
					id: "api:validate-inputs",
					domain: "api",
					description: "Always validate API inputs",
					confidence: 0.6,
					occurrences: 1,
					sources: [{ type: "commit", id: `abc${i}`, author: `user${i}` }],
					ruleContent: "- Always validate API inputs",
				});
			}

			const results = autoPromotePatterns(testDir);

			expect(results.length).toBe(1);
			expect(results[0].promoted).toBe(true);
			expect(results[0].domain).toBe("api");
		});

		test("returns empty when no patterns ready", () => {
			const results = autoPromotePatterns(testDir);
			expect(results).toHaveLength(0);
		});
	});

	describe("getPatternStats", () => {
		test("returns correct statistics", () => {
			trackPattern({
				id: "testing:t1",
				domain: "testing",
				description: "Test pattern 1",
				confidence: 0.5,
				occurrences: 1,
				sources: [],
				ruleContent: "",
			});

			trackPattern({
				id: "api:a1",
				domain: "api",
				description: "API pattern 1",
				confidence: 0.5,
				occurrences: 1,
				sources: [],
				ruleContent: "",
			});

			const stats = getPatternStats();

			expect(stats.totalPatterns).toBe(2);
			expect(stats.readyForPromotion).toBe(0);
			expect(stats.topDomains).toHaveLength(2);
		});
	});
});
