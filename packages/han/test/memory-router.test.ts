/**
 * Tests for the Memory Query Router
 */
import { describe, expect, test } from "bun:test";
import {
	classifyQuestion,
	extractTimeframe,
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
	});
});
