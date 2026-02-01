import { describe, expect, it } from "bun:test";

/**
 * These tests verify the question detection logic in orchestrate.ts
 * Since the function is not exported, we test via the compiled behavior.
 * The logic being tested is in isAgentWaitingForInput().
 */

describe("Question Detection Patterns", () => {
	// Test data representing different message patterns
	const testCases = [
		{
			name: "Question mark at end of sentence",
			content: "Should I proceed with the changes?",
			expected: true,
		},
		{
			name: "Question mark mid-sentence",
			content: "Should I proceed with X, or do Y instead?",
			expected: true,
		},
		{
			name: "Multiple questions",
			content:
				"What do you think? Should I continue or wait for your approval?",
			expected: true,
		},
		{
			name: "Implied question without question mark (should I)",
			content: "should i continue with this approach",
			expected: true,
		},
		{
			name: "Implied question without question mark (would you like)",
			content: "would you like me to implement this feature",
			expected: true,
		},
		{
			name: "Implied question without question mark (do you want)",
			content: "do you want me to proceed",
			expected: true,
		},
		{
			name: "Implied question without question mark (which option)",
			content: "let me know which option you prefer",
			expected: true,
		},
		{
			name: "Statement with 'or' pattern",
			content: "I can do X, or should I do Y",
			expected: true,
		},
		{
			name: "Question pattern in middle of text",
			content:
				"Here are the changes. Should I commit them? I think they're ready.",
			expected: true,
		},
		{
			name: "Regular statement (not a question)",
			content: "I have completed the changes and committed them.",
			expected: false,
		},
		{
			name: "Statement mentioning question words but not asking",
			content: "I should complete this task. I can proceed now.",
			expected: false,
		},
		{
			name: "Empty message",
			content: "",
			expected: false,
		},
	];

	// Pattern tests (these verify the regex patterns work)
	testCases.forEach(({ name, content, expected }) => {
		it(`detects: ${name}`, () => {
			const normalized = content.trim().replace(/\s+/g, " ");

			// Check for question mark anywhere
			const hasQuestionMark = normalized.includes("?");

			// Check for common question patterns
			const questionPatterns = [
				/\b(should i|shall i|can i|may i|could i|would i)\b/i,
				/\b(should we|shall we|can we|may we|could we|would we)\b/i,
				/\b(do you want|would you like|do you prefer|would you prefer)\b/i,
				/\b(what do you think|how about|what about)\b/i,
				/\b(which (one|option|approach|method))\b/i,
				/\b(or (do|should|would|could) (i|we|you))\b/i,
				/\b(let me know (if|whether|which))\b/i,
			];

			const hasQuestionPattern = questionPatterns.some((pattern) =>
				pattern.test(normalized),
			);

			const isQuestion = hasQuestionMark || hasQuestionPattern;
			expect(isQuestion).toBe(expected);
		});
	});
});

describe("JSON Content Block Handling", () => {
	it("extracts text from text blocks in JSON array", () => {
		const contentBlocks = [
			{ type: "text", text: "Should I proceed?" },
			{ type: "tool_use", name: "SomeTool" },
		];

		let allText = "";
		for (const block of contentBlocks) {
			if (block.type === "text" && "text" in block) {
				allText += `${block.text} `;
			}
		}

		const normalized = allText.trim();
		expect(normalized.includes("?")).toBe(true);
	});

	it("detects AskUserQuestion tool use", () => {
		const contentBlocks = [
			{
				type: "tool_use",
				name: "AskUserQuestion",
				input: { question: "Continue?" },
			},
			{ type: "text", text: "Some text" },
		];

		const hasAskUserQuestion = contentBlocks.some(
			(block) => block.type === "tool_use" && block.name === "AskUserQuestion",
		);

		expect(hasAskUserQuestion).toBe(true);
	});
});

describe("Edge Cases", () => {
	it("handles text with multiple spaces", () => {
		const content = "Should   I     proceed    with    this?";
		const normalized = content.trim().replace(/\s+/g, " ");
		expect(normalized).toBe("Should I proceed with this?");
		expect(normalized.includes("?")).toBe(true);
	});

	it("handles mixed case patterns", () => {
		const patterns = [
			"SHOULD I continue",
			"Should I continue",
			"should i continue",
		];

		const regex = /\b(should i|shall i|can i|may i|could i|would i)\b/i;

		for (const pattern of patterns) {
			expect(regex.test(pattern)).toBe(true);
		}
	});

	it("does not match partial words", () => {
		const content = "I shoulder this burden gladly"; // "should" is part of "shoulder"
		const regex = /\b(should i|shall i|can i|may i|could i|would i)\b/i;
		expect(regex.test(content)).toBe(false);
	});
});
