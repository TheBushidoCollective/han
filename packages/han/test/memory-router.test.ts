/**
 * Tests for the Memory Query Router
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
	describe("classifyQuestion", () => {
		describe("personal_recent", () => {
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
		});

		describe("personal_continue", () => {
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
		});

		describe("personal_search", () => {
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

		describe("team_expertise", () => {
			test("detects 'who knows about'", () => {
				expect(classifyQuestion("who knows about authentication?").type).toBe(
					"team_expertise",
				);
			});

			test("detects 'who worked on'", () => {
				expect(classifyQuestion("who worked on the payment system?").type).toBe(
					"team_expertise",
				);
			});

			test("detects 'who implemented'", () => {
				expect(
					classifyQuestion("who implemented the caching layer?").type,
				).toBe("team_expertise");
			});

			test("detects 'who is expert'", () => {
				expect(classifyQuestion("who is expert in React?").type).toBe(
					"team_expertise",
				);
			});

			test("detects 'who created'", () => {
				expect(classifyQuestion("who created this component?").type).toBe(
					"team_expertise",
				);
			});

			test("detects 'who wrote'", () => {
				expect(classifyQuestion("who wrote the migration script?").type).toBe(
					"team_expertise",
				);
			});
		});

		describe("team_decisions", () => {
			test("detects 'why did we choose'", () => {
				expect(classifyQuestion("why did we choose TypeScript?").type).toBe(
					"team_decisions",
				);
			});

			test("detects 'what decision'", () => {
				expect(
					classifyQuestion("what decision did we make about caching?").type,
				).toBe("team_decisions");
			});

			test("detects 'rationale for'", () => {
				expect(
					classifyQuestion("what's the rationale for using Redux?").type,
				).toBe("team_decisions");
			});

			test("detects 'reason for'", () => {
				expect(
					classifyQuestion("what's the reason for this architecture?").type,
				).toBe("team_decisions");
			});
		});

		describe("team_changes", () => {
			test("detects 'changes to'", () => {
				expect(classifyQuestion("what are the changes to the API?").type).toBe(
					"team_changes",
				);
			});

			test("detects 'history of'", () => {
				expect(
					classifyQuestion("what's the history of the auth module?").type,
				).toBe("team_changes");
			});

			test("detects 'evolution of'", () => {
				expect(
					classifyQuestion("show me the evolution of the data model").type,
				).toBe("team_changes");
			});

			test("detects 'how has X changed'", () => {
				expect(
					classifyQuestion("how has the config changed over time?").type,
				).toBe("team_changes");
			});
		});

		describe("conventions", () => {
			test("detects 'how do we'", () => {
				expect(classifyQuestion("how do we handle errors?").type).toBe(
					"conventions",
				);
			});

			test("detects 'should we'", () => {
				expect(classifyQuestion("should we use async/await here?").type).toBe(
					"conventions",
				);
			});

			test("detects 'best practice'", () => {
				expect(
					classifyQuestion("what's the best practice for testing?").type,
				).toBe("conventions");
			});

			test("detects 'our approach'", () => {
				expect(classifyQuestion("what's our approach to logging?").type).toBe(
					"conventions",
				);
			});

			test("detects 'standard way'", () => {
				expect(
					classifyQuestion("what's the standard way to handle auth?").type,
				).toBe("conventions");
			});

			test("detects 'convention'", () => {
				expect(classifyQuestion("what's the naming convention?").type).toBe(
					"conventions",
				);
			});
		});

		describe("team_temporal", () => {
			test("detects 'what happened last week'", () => {
				const result = classifyQuestion("what happened last week?");
				expect(result.type).toBe("team_temporal");
				expect(result.timeframe?.description).toBe("last week");
			});

			test("detects 'activity this month'", () => {
				const result = classifyQuestion("show me the activity this month");
				expect(result.type).toBe("team_temporal");
				expect(result.timeframe?.description).toBe("this month");
			});

			test("detects 'what was done recently'", () => {
				const result = classifyQuestion("what was done recently?");
				expect(result.type).toBe("team_temporal");
				expect(result.timeframe?.description).toBe("recently");
			});
		});

		describe("general fallback", () => {
			test("falls back to general for ambiguous questions", () => {
				expect(classifyQuestion("tell me about the system").type).toBe(
					"general",
				);
			});

			test("falls back to general for simple questions", () => {
				expect(classifyQuestion("what is the architecture?").type).toBe(
					"general",
				);
			});

			test("falls back to team_temporal for temporal without action words", () => {
				const result = classifyQuestion("what happened last month?");
				expect(result.type).toBe("team_temporal");
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

		describe("routing logic", () => {
			test("routes personal_recent questions to personal memory", async () => {
				const result = await queryMemory({
					question: "what was I working on recently?",
				});
				// Should route to personal memory
				expect(result.source).toBe("personal");
			});

			test("routes personal_continue questions to personal memory", async () => {
				const result = await queryMemory({
					question: "continue where I left off",
				});
				expect(result.source).toBe("personal");
			});

			test("routes personal_search questions to personal memory", async () => {
				const result = await queryMemory({
					question: "did I ever work on authentication?",
				});
				expect(result.source).toBe("personal");
			});

			test("routes transcript_conversation questions correctly", async () => {
				const result = await queryMemory({
					question: "what did we discuss about the API?",
				});
				expect(result.source).toBe("transcripts");
			});

			test("routes transcript_reasoning questions with includeThinking flag", async () => {
				const result = await queryMemory({
					question: "why did you decide to use React?",
				});
				expect(result.source).toBe("transcripts");
			});

			test("routes team_expertise questions to team memory", async () => {
				const result = await queryMemory({
					question: "who knows about the payment system?",
				});
				expect(result.source).toBe("team");
			});

			test("routes team_decisions questions to team memory", async () => {
				const result = await queryMemory({
					question: "why did we choose TypeScript?",
				});
				expect(result.source).toBe("team");
			});

			test("routes team_changes questions to team memory", async () => {
				const result = await queryMemory({
					question: "what are the changes to the auth module?",
				});
				expect(result.source).toBe("team");
			});

			test("routes team_temporal questions with timeframe", async () => {
				const result = await queryMemory({
					question: "what happened last week?",
				});
				expect(result.source).toBe("team");
			});

			test("routes general questions to team memory", async () => {
				const result = await queryMemory({
					question: "tell me about the architecture",
				});
				expect(result.source).toBe("team");
			});
		});

		describe("conventions routing", () => {
			test("checks rules for convention questions", async () => {
				const result = await queryMemory({
					question: "what's our coding convention?",
				});
				// Should check rules first, then potentially fall back to team
				expect(["rules", "team"]).toContain(result.source);
			});

			test("falls back to team when no rules found", async () => {
				const result = await queryMemory({
					question: "how should we handle errors?",
				});
				// Will likely be team since we don't have specific rules in test env
				expect(["rules", "team"]).toContain(result.source);
			});
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

		test("formats transcripts result", () => {
			const result: MemoryResult = {
				success: true,
				answer: "We discussed API versioning strategies.",
				source: "transcripts",
				confidence: "high",
				citations: [
					{
						source: "transcript:xyz789",
						excerpt: "API v2 will use semantic versioning",
						timestamp: Date.now(),
						layer: "transcripts",
					},
				],
				caveats: ["Some results are from peer worktrees."],
			};

			const formatted = formatMemoryResult(result);
			expect(formatted).toContain("Conversation History");
			expect(formatted).toContain("API versioning");
			expect(formatted).toContain("transcript:xyz789");
			expect(formatted).toContain("peer worktrees");
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
			// Should only show first 5 citations
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
			// Should not crash without timestamp
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
		describe("classification edge cases", () => {
			test("handles mixed question types - prioritizes personal_recent", () => {
				const result = classifyQuestion(
					"what was I working on and who else worked on it?",
				);
				// personal_recent should take priority
				expect(result.type).toBe("personal_recent");
			});

			test("handles questions with multiple temporal indicators", () => {
				const result = classifyQuestion(
					"what changed last week and last month?",
				);
				expect(result.type).toBe("team_temporal");
				expect(result.timeframe).toBeDefined();
			});

			test("handles case insensitive matching", () => {
				expect(classifyQuestion("WHAT WAS I WORKING ON?").type).toBe(
					"personal_recent",
				);
				expect(classifyQuestion("Who Knows About React?").type).toBe(
					"team_expertise",
				);
			});

			test("handles questions with special characters", () => {
				const result = classifyQuestion(
					"what was I working on? (last session)",
				);
				expect(result.type).toBe("personal_recent");
			});

			test("classifies question with only temporal phrase as team_temporal", () => {
				const result = classifyQuestion("last 3 weeks");
				expect(result.type).toBe("team_temporal");
				expect(result.timeframe?.description).toBe("last 3 weeks");
			});
		});

		describe("transcript_conversation classification", () => {
			test("detects 'you said'", () => {
				expect(classifyQuestion("you said something about testing").type).toBe(
					"transcript_conversation",
				);
			});

			test("detects 'I asked'", () => {
				expect(classifyQuestion("I asked about error handling").type).toBe(
					"transcript_conversation",
				);
			});

			test("detects 'earlier session'", () => {
				expect(
					classifyQuestion("in an earlier session we covered this").type,
				).toBe("transcript_conversation");
			});

			test("detects 'previous conversation'", () => {
				expect(
					classifyQuestion("in a previous conversation we discussed APIs").type,
				).toBe("transcript_conversation");
			});

			test("detects 'chat history'", () => {
				expect(classifyQuestion("search my chat history for API").type).toBe(
					"transcript_conversation",
				);
			});
		});

		describe("transcript_reasoning classification", () => {
			test("detects 'why did you'", () => {
				expect(classifyQuestion("why did you choose that approach?").type).toBe(
					"transcript_reasoning",
				);
			});

			test("detects 'your reasoning'", () => {
				expect(classifyQuestion("what was your reasoning?").type).toBe(
					"transcript_reasoning",
				);
			});

			test("detects 'how did you decide'", () => {
				expect(classifyQuestion("how did you decide on React?").type).toBe(
					"transcript_reasoning",
				);
			});

			test("detects 'your thinking'", () => {
				expect(classifyQuestion("explain your thinking process").type).toBe(
					"transcript_reasoning",
				);
			});

			test("detects 'what was your approach'", () => {
				expect(
					classifyQuestion("what was your approach to solving this?").type,
				).toBe("transcript_reasoning");
			});
		});

		describe("team_expertise classification", () => {
			test("detects 'who understands'", () => {
				expect(classifyQuestion("who understands the payment flow?").type).toBe(
					"team_expertise",
				);
			});
		});

		describe("team_decisions classification variations", () => {
			test("detects 'why was'", () => {
				expect(classifyQuestion("why was this approach chosen?").type).toBe(
					"team_decisions",
				);
			});

			test("detects 'chose'", () => {
				expect(classifyQuestion("we chose Redux, why?").type).toBe(
					"team_decisions",
				);
			});
		});

		describe("team_changes classification variations", () => {
			test("detects 'what changes'", () => {
				expect(classifyQuestion("what changes were made to auth?").type).toBe(
					"team_changes",
				);
			});
		});

		describe("conventions classification variations", () => {
			test("detects 'how should'", () => {
				expect(classifyQuestion("how should we format code?").type).toBe(
					"conventions",
				);
			});
		});
	});
});
