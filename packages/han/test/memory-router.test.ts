/**
 * Tests for the Memory Query Router
 *
 * The router has been simplified:
 * - Personal questions → personal memory
 * - Everything else → search all layers (rules, transcripts, team)
 *
 * The hook (memory-confidence.md) guides Claude on WHEN to use memory.
 * The router just needs to search effectively when called.
 */
import { describe, expect, test } from "bun:test";
import {
	classifyQuestion,
	extractTimeframe,
	formatMemoryResult,
	type MemoryResult,
	queryMemory,
} from "../lib/commands/mcp/memory-router.ts";

describe("Memory Router", () => {
	describe("classifyQuestion (simplified)", () => {
		describe("personal questions", () => {
			test("detects 'what was I working on'", () => {
				expect(classifyQuestion("what was I working on?").type).toBe(
					"personal_recent",
				);
			});

			test("detects 'my recent work'", () => {
				expect(classifyQuestion("show me my recent work").type).toBe(
					"personal_recent",
				);
			});

			test("detects 'what did I do'", () => {
				expect(classifyQuestion("what did I do yesterday?").type).toBe(
					"personal_recent",
				);
			});

			test("detects 'my last session'", () => {
				expect(classifyQuestion("what happened in my last session?").type).toBe(
					"personal_recent",
				);
			});

			test("detects 'continue where I left off'", () => {
				expect(classifyQuestion("continue where I left off").type).toBe(
					"personal_continue",
				);
			});

			test("detects 'pick up from'", () => {
				expect(classifyQuestion("pick up from where I stopped").type).toBe(
					"personal_continue",
				);
			});

			test("detects 'resume'", () => {
				expect(classifyQuestion("resume my work").type).toBe(
					"personal_continue",
				);
			});

			test("detects 'where was I'", () => {
				expect(
					classifyQuestion("where was I in the implementation?").type,
				).toBe("personal_continue");
			});

			test("detects 'my work on'", () => {
				expect(classifyQuestion("my work on the auth system").type).toBe(
					"personal_search",
				);
			});

			test("detects 'did I ever'", () => {
				expect(
					classifyQuestion("did I ever work on payment processing?").type,
				).toBe("personal_search");
			});

			test("detects 'have I worked on'", () => {
				expect(
					classifyQuestion("have I worked on the user API before?").type,
				).toBe("personal_search");
			});
		});

		describe("general questions (all non-personal)", () => {
			// All non-personal questions should be classified as "general"
			// and search all layers (rules, transcripts, team)

			test("who questions → general", () => {
				expect(classifyQuestion("who knows about authentication?").type).toBe(
					"general",
				);
				expect(classifyQuestion("who worked on the payment system?").type).toBe(
					"general",
				);
				expect(
					classifyQuestion("who implemented the caching layer?").type,
				).toBe("general");
			});

			test("when/temporal questions → general", () => {
				expect(classifyQuestion("what happened last week?").type).toBe(
					"general",
				);
				expect(classifyQuestion("when did we implement this?").type).toBe(
					"general",
				);
			});

			test("why/decision questions → general", () => {
				expect(classifyQuestion("why did we choose TypeScript?").type).toBe(
					"general",
				);
				expect(classifyQuestion("what was the rationale?").type).toBe(
					"general",
				);
			});

			test("how/convention questions → general", () => {
				expect(classifyQuestion("how do we handle errors?").type).toBe(
					"general",
				);
				expect(
					classifyQuestion("what's the best practice for testing?").type,
				).toBe("general");
			});

			test("what/where questions → general", () => {
				expect(classifyQuestion("what does this function do?").type).toBe(
					"general",
				);
				expect(classifyQuestion("where is authentication defined?").type).toBe(
					"general",
				);
			});

			test("ambiguous questions → general", () => {
				expect(classifyQuestion("tell me about the system").type).toBe(
					"general",
				);
				expect(classifyQuestion("what is the architecture?").type).toBe(
					"general",
				);
			});
		});
	});

	describe("extractTimeframe", () => {
		test("extracts 'last week'", () => {
			const result = extractTimeframe("what happened last week");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("last week");
			expect(result?.start).toBeDefined();
		});

		test("extracts 'last month'", () => {
			const result = extractTimeframe("show me last month's work");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("last month");
		});

		test("extracts 'this week'", () => {
			const result = extractTimeframe("activity this week");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("this week");
		});

		test("extracts 'this month'", () => {
			const result = extractTimeframe("what happened this month");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("this month");
		});

		test("extracts 'yesterday'", () => {
			const result = extractTimeframe("what did we do yesterday");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("yesterday");
		});

		test("extracts 'today'", () => {
			const result = extractTimeframe("what happened today");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("today");
		});

		test("extracts 'recently'", () => {
			const result = extractTimeframe("what changed recently");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("recently");
		});

		test("extracts 'last N days'", () => {
			const result = extractTimeframe("what happened in the last 5 days");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("last 5 days");
		});

		test("extracts 'last N weeks'", () => {
			const result = extractTimeframe("show me the last 2 weeks");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("last 2 weeks");
		});

		test("extracts 'last N months'", () => {
			const result = extractTimeframe("what changed in the last 3 months");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("last 3 months");
		});

		test("returns null for no timeframe", () => {
			const result = extractTimeframe("who knows about authentication");
			expect(result).toBeNull();
		});

		test("handles singular 'last 1 day'", () => {
			const result = extractTimeframe("what happened in the last 1 day");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("last 1 day");
		});

		test("handles 'past week'", () => {
			const result = extractTimeframe("show me the past week");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("last week");
		});

		test("handles 'past month'", () => {
			const result = extractTimeframe("activity from the past month");
			expect(result).not.toBeNull();
			expect(result?.description).toBe("last month");
		});
	});

	describe("queryMemory", () => {
		describe("input validation", () => {
			test("rejects empty question", async () => {
				const result = await queryMemory({ question: "" });
				expect(result.success).toBe(false);
				expect(result.answer).toContain("cannot be empty");
				expect(result.confidence).toBe("low");
			});

			test("rejects whitespace-only question", async () => {
				const result = await queryMemory({ question: "   " });
				expect(result.success).toBe(false);
				expect(result.answer).toContain("cannot be empty");
			});
		});

		describe("routing (all questions search all layers)", () => {
			test(
				"all questions search all layers",
				async () => {
					const result = await queryMemory({
						question: "what was I working on recently?",
					});
					// All questions now go through searchAllLayers
					expect(result.layersSearched).toBeDefined();
					expect(result.layersSearched?.length).toBeGreaterThan(0);
				},
				{ timeout: 15000 },
			);

			test(
				"who questions search all layers",
				async () => {
					const result = await queryMemory({
						question: "who knows about the payment system?",
					});
					expect(result.layersSearched).toBeDefined();
					expect(result.layersSearched?.length).toBeGreaterThan(0);
				},
				{ timeout: 15000 },
			);

			test(
				"why questions search all layers",
				async () => {
					const result = await queryMemory({
						question: "why did we choose TypeScript?",
					});
					expect(result.layersSearched).toBeDefined();
				},
				{ timeout: 15000 },
			);

			test(
				"how questions search all layers",
				async () => {
					const result = await queryMemory({
						question: "how do we handle errors?",
					});
					expect(result.layersSearched).toBeDefined();
				},
				{ timeout: 15000 },
			);
		});

		describe("multi-layer search", () => {
			test(
				"searches rules layer",
				async () => {
					const result = await queryMemory({
						question: "How do engagements move through the system?",
					});
					expect(result.layersSearched).toContain("rules");
				},
				{ timeout: 15000 },
			);

			test(
				"searches multiple layers",
				async () => {
					const result = await queryMemory({
						question: "What production issues have we been dealing with?",
					});
					expect(result.layersSearched).toBeDefined();
					expect(result.layersSearched?.length).toBeGreaterThan(1);
				},
				{ timeout: 15000 },
			);

			test(
				"searches team layer",
				async () => {
					const result = await queryMemory({
						question: "who implemented the caching system?",
					});
					expect(result.layersSearched).toContain("team");
				},
				{ timeout: 15000 },
			);
		});
	});

	describe("formatMemoryResult", () => {
		test("formats personal memory result", () => {
			const result: MemoryResult = {
				success: true,
				answer: "You were working on authentication.",
				source: "personal",
				confidence: "high",
				citations: [
					{
						source: "session:abc123",
						excerpt: "Implemented OAuth flow",
						timestamp: Date.now(),
					},
				],
				caveats: [],
			};

			const formatted = formatMemoryResult(result);
			expect(formatted).toContain("Personal Memory");
			expect(formatted).toContain("high");
			expect(formatted).toContain("authentication");
			expect(formatted).toContain("session:abc123");
		});

		test("formats team memory result", () => {
			const result: MemoryResult = {
				success: true,
				answer: "TypeScript was chosen for type safety.",
				source: "team",
				confidence: "medium",
				citations: [
					{
						source: "commit:def456",
						excerpt: "Add TypeScript config",
						author: "john@example.com",
						timestamp: Date.now(),
					},
				],
				caveats: ["Based on git history"],
			};

			const formatted = formatMemoryResult(result);
			expect(formatted).toContain("Team Memory");
			expect(formatted).toContain("medium");
			expect(formatted).toContain("TypeScript");
			expect(formatted).toContain("john@example.com");
			expect(formatted).toContain("Based on git history");
		});

		test("formats rules result", () => {
			const result: MemoryResult = {
				success: true,
				answer: "Always use async/await for promises.",
				source: "rules",
				confidence: "high",
				citations: [],
				caveats: ["Answer based on project conventions in .claude/rules/"],
			};

			const formatted = formatMemoryResult(result);
			expect(formatted).toContain("Project Conventions");
			expect(formatted).toContain("high");
			expect(formatted).toContain("async/await");
			expect(formatted).not.toContain("**Sources:**"); // Rules don't show citations
		});

		test("formats combined result", () => {
			const result: MemoryResult = {
				success: true,
				answer: "Information from multiple sources.",
				source: "combined",
				confidence: "medium",
				citations: [],
				caveats: [],
			};

			const formatted = formatMemoryResult(result);
			expect(formatted).toContain("Combined Sources");
			expect(formatted).toContain("medium");
		});

		test("formats low confidence result", () => {
			const result: MemoryResult = {
				success: true,
				answer: "No clear answer found.",
				source: "personal",
				confidence: "low",
				citations: [],
				caveats: ["Limited information available"],
			};

			const formatted = formatMemoryResult(result);
			expect(formatted).toContain("low");
			expect(formatted).toContain("Limited information available");
		});

		test("limits citations to top 5", () => {
			const citations = Array.from({ length: 10 }, (_, i) => ({
				source: `source:${i}`,
				excerpt: `excerpt ${i}`,
			}));

			const result: MemoryResult = {
				success: true,
				answer: "Answer with many citations",
				source: "team",
				confidence: "high",
				citations,
				caveats: [],
			};

			const formatted = formatMemoryResult(result);
			expect(formatted).toContain("source:0");
			expect(formatted).toContain("source:4");
			expect(formatted).not.toContain("source:5");
		});

		test("handles result without timestamp in citations", () => {
			const result: MemoryResult = {
				success: true,
				answer: "Result without dates",
				source: "team",
				confidence: "high",
				citations: [
					{
						source: "commit:abc",
						excerpt: "Some change",
					},
				],
				caveats: [],
			};

			const formatted = formatMemoryResult(result);
			expect(formatted).toContain("commit:abc");
		});

		test("handles empty citations array", () => {
			const result: MemoryResult = {
				success: true,
				answer: "No sources available",
				source: "personal",
				confidence: "low",
				citations: [],
				caveats: [],
			};

			const formatted = formatMemoryResult(result);
			expect(formatted).not.toContain("**Sources:**");
			expect(formatted).toContain("No sources available");
		});

		test("handles empty caveats array", () => {
			const result: MemoryResult = {
				success: true,
				answer: "Clean result",
				source: "team",
				confidence: "high",
				citations: [],
				caveats: [],
			};

			const formatted = formatMemoryResult(result);
			expect(formatted).not.toContain("_Notes:_");
		});
	});

	describe("edge cases", () => {
		test("handles case insensitive matching", () => {
			expect(classifyQuestion("WHAT WAS I WORKING ON?").type).toBe(
				"personal_recent",
			);
		});

		test("handles questions with special characters", () => {
			const result = classifyQuestion("what was I working on? (last session)");
			expect(result.type).toBe("personal_recent");
		});

		test("mixed question types prioritize personal", () => {
			const result = classifyQuestion(
				"what was I working on and who else worked on it?",
			);
			expect(result.type).toBe("personal_recent");
		});
	});
});
