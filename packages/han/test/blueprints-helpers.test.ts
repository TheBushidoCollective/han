/**
 * Tests for exported helper functions in blueprints.ts
 * These are pure functions that can be tested without side effects
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	FRONTMATTER_REGEX,
	formatWithFrontmatter,
	getBlueprintsDir,
	parseFrontmatter,
} from "../lib/commands/mcp/blueprints.ts";

describe("blueprints.ts helper functions", () => {
	describe("FRONTMATTER_REGEX", () => {
		test("matches valid frontmatter", () => {
			const content = `---
name: test-blueprint
summary: A test blueprint
---

# Content here`;

			const match = content.match(FRONTMATTER_REGEX);
			expect(match).not.toBeNull();
			expect(match?.[1]).toContain("name: test-blueprint");
			expect(match?.[2]).toContain("# Content here");
		});

		test("does not match content without frontmatter", () => {
			const content = "# Just a markdown file\n\nNo frontmatter here.";
			expect(content.match(FRONTMATTER_REGEX)).toBeNull();
		});

		test("does not match incomplete frontmatter", () => {
			const content = `---
name: test
# Missing closing ---

Content`;
			expect(content.match(FRONTMATTER_REGEX)).toBeNull();
		});

		test("extracts multiline frontmatter", () => {
			const content = `---
name: my-blueprint
summary: A detailed summary
author: Test Author
date: 2024-01-01
---

Body content`;

			const match = content.match(FRONTMATTER_REGEX);
			expect(match).not.toBeNull();
			expect(match?.[1]).toContain("author: Test Author");
		});
	});

	describe("parseFrontmatter", () => {
		test("parses valid frontmatter with name and summary", () => {
			const content = `---
name: api-architecture
summary: Documents the API layer architecture
---

# API Architecture

Details here...`;

			const result = parseFrontmatter(content);
			expect(result.metadata).not.toBeNull();
			expect(result.metadata?.name).toBe("api-architecture");
			expect(result.metadata?.summary).toBe(
				"Documents the API layer architecture",
			);
			expect(result.content).toContain("# API Architecture");
		});

		test("returns null metadata when frontmatter is missing", () => {
			const content = "# Just content\n\nNo frontmatter";
			const result = parseFrontmatter(content);
			expect(result.metadata).toBeNull();
			expect(result.content).toBe(content);
		});

		test("returns null metadata when name is missing", () => {
			const content = `---
summary: A summary without name
---

Content`;

			const result = parseFrontmatter(content);
			expect(result.metadata).toBeNull();
		});

		test("returns null metadata when summary is missing", () => {
			const content = `---
name: name-without-summary
---

Content`;

			const result = parseFrontmatter(content);
			expect(result.metadata).toBeNull();
		});

		test("handles empty content after frontmatter", () => {
			const content = `---
name: empty-blueprint
summary: Has no content
---

`;

			const result = parseFrontmatter(content);
			expect(result.metadata).not.toBeNull();
			expect(result.content.trim()).toBe("");
		});

		test("preserves content whitespace", () => {
			const content = `---
name: test
summary: test summary
---

   Indented content

   More indented`;

			const result = parseFrontmatter(content);
			expect(result.content).toContain("   Indented content");
		});

		test("handles colons in values", () => {
			const content = `---
name: cli-architecture
summary: CLI: The main entry point
---

Content`;

			const result = parseFrontmatter(content);
			expect(result.metadata?.summary).toBe("CLI: The main entry point");
		});

		test("ignores unknown frontmatter keys", () => {
			const content = `---
name: test-blueprint
summary: A test
author: Someone
version: 1.0.0
---

Content`;

			const result = parseFrontmatter(content);
			expect(result.metadata).not.toBeNull();
			expect(result.metadata?.name).toBe("test-blueprint");
			expect(
				(result.metadata as Record<string, unknown>).author,
			).toBeUndefined();
		});
	});

	describe("formatWithFrontmatter", () => {
		test("formats blueprint with frontmatter", () => {
			const blueprint = {
				name: "test-blueprint",
				summary: "A test blueprint",
				content: "# Test\n\nContent here",
			};

			const result = formatWithFrontmatter(blueprint);

			expect(result).toContain("---");
			expect(result).toContain("name: test-blueprint");
			expect(result).toContain("summary: A test blueprint");
			expect(result).toContain("# Test");
			expect(result).toContain("Content here");
		});

		test("produces parseable frontmatter", () => {
			const blueprint = {
				name: "roundtrip",
				summary: "Testing roundtrip",
				content: "# Roundtrip Test",
			};

			const formatted = formatWithFrontmatter(blueprint);
			const parsed = parseFrontmatter(formatted);

			expect(parsed.metadata?.name).toBe("roundtrip");
			expect(parsed.metadata?.summary).toBe("Testing roundtrip");
			expect(parsed.content.trim()).toBe("# Roundtrip Test");
		});

		test("handles empty content", () => {
			const blueprint = {
				name: "empty",
				summary: "Empty blueprint",
				content: "",
			};

			const result = formatWithFrontmatter(blueprint);
			expect(result).toContain("name: empty");
			expect(result).toContain("summary: Empty blueprint");
		});

		test("handles multiline content", () => {
			const blueprint = {
				name: "multiline",
				summary: "Has multiple sections",
				content: "# Section 1\n\nContent 1\n\n# Section 2\n\nContent 2",
			};

			const result = formatWithFrontmatter(blueprint);
			expect(result).toContain("# Section 1");
			expect(result).toContain("# Section 2");
		});

		test("handles special characters in content", () => {
			const blueprint = {
				name: "special",
				summary: "Special chars",
				content:
					"Code: `const x = 1;`\n\n```typescript\nfunction foo() {}\n```",
			};

			const result = formatWithFrontmatter(blueprint);
			expect(result).toContain("`const x = 1;`");
			expect(result).toContain("```typescript");
		});
	});

	describe("getBlueprintsDir", () => {
		let testDir: string;
		let originalCwd: string;

		beforeEach(() => {
			originalCwd = process.cwd();
			const random = Math.random().toString(36).substring(2, 9);
			testDir = join(tmpdir(), `han-blueprints-test-${Date.now()}-${random}`);
			mkdirSync(testDir, { recursive: true });
		});

		afterEach(() => {
			process.chdir(originalCwd);
			if (testDir) {
				rmSync(testDir, { recursive: true, force: true });
			}
		});

		test("returns blueprints path when directory exists", () => {
			const blueprintsPath = join(testDir, "blueprints");
			mkdirSync(blueprintsPath);
			process.chdir(testDir);

			const result = getBlueprintsDir();
			// Use realpathSync to handle macOS /var -> /private/var symlink
			expect(result).not.toBeNull();
			expect(realpathSync(result as string)).toBe(realpathSync(blueprintsPath));
		});

		test("returns null when blueprints directory does not exist", () => {
			process.chdir(testDir);
			const result = getBlueprintsDir();
			expect(result).toBeNull();
		});
	});

	describe("integration tests", () => {
		test("roundtrip: format then parse maintains data integrity", () => {
			const original = {
				name: "integration-test",
				summary: "Tests the full roundtrip",
				content: "# Integration Test\n\nThis content should survive roundtrip.",
			};

			const formatted = formatWithFrontmatter(original);
			const parsed = parseFrontmatter(formatted);

			expect(parsed.metadata?.name).toBe(original.name);
			expect(parsed.metadata?.summary).toBe(original.summary);
			expect(parsed.content.trim()).toBe(original.content);
		});

		test("handles complex markdown content", () => {
			const content = `# Complex Blueprint

## Lists
- Item 1
- Item 2
  - Nested item

## Code

\`\`\`typescript
interface Config {
  name: string;
  enabled: boolean;
}
\`\`\`

## Tables

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |`;

			const blueprint = {
				name: "complex",
				summary: "Complex markdown test",
				content,
			};

			const formatted = formatWithFrontmatter(blueprint);
			const parsed = parseFrontmatter(formatted);

			expect(parsed.content).toContain("## Lists");
			expect(parsed.content).toContain("## Code");
			expect(parsed.content).toContain("## Tables");
			expect(parsed.content).toContain("```typescript");
		});
	});
});
