/**
 * Project Memory MCP Tool
 *
 * Provides an MCP tool for Claude to capture learnings into project memory.
 * Writes to .claude/rules/<domain>.md files following Claude Code conventions.
 *
 * Supports two scopes:
 * - project (default): Writes to <project>/.claude/rules/ for project-specific rules
 * - user: Writes to ~/.claude/rules/ for personal preferences across all projects
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getClaudeConfigDir } from "../../config/claude-settings.ts";

export type MemoryScope = "project" | "user";

export interface LearnParams {
	/** The learning content to capture (markdown format) */
	content: string;
	/** Domain name for the rule file (e.g., "api", "testing", "api/validation"). Can include subdirectories. */
	domain: string;
	/** Optional path patterns for path-specific rules */
	paths?: string[];
	/** Whether to append to existing file or replace (default: append) */
	append?: boolean;
	/** Scope: 'project' (default) for project rules, 'user' for personal preferences */
	scope?: MemoryScope;
}

export interface LearnResult {
	success: boolean;
	path: string;
	message: string;
	created: boolean;
}

/**
 * Get the project root directory
 */
function getProjectRoot(): string {
	return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/**
 * Get the rules directory based on scope
 */
function getRulesDir(scope: MemoryScope): string {
	if (scope === "user") {
		return join(getClaudeConfigDir(), "rules");
	}
	return join(getProjectRoot(), ".claude", "rules");
}

/**
 * Generate frontmatter for a rule file
 */
function generateFrontmatter(paths?: string[]): string {
	if (!paths || paths.length === 0) {
		return "";
	}

	const pathsJson = JSON.stringify(paths);
	return `---
paths: ${pathsJson}
---

`;
}

/**
 * Capture a learning into project or user memory
 */
export function captureMemory(params: LearnParams): LearnResult {
	const { content, domain, paths, append = true, scope = "project" } = params;

	// Validate inputs
	if (!content || content.trim().length === 0) {
		return {
			success: false,
			path: "",
			message: "Content cannot be empty",
			created: false,
		};
	}

	if (!domain || domain.trim().length === 0) {
		return {
			success: false,
			path: "",
			message: "Domain name is required",
			created: false,
		};
	}

	// Sanitize domain name for filename (preserving directory structure)
	const sanitizedDomain = domain
		.split("/")
		.map((segment) =>
			segment
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, ""),
		)
		.filter((s) => s.length > 0)
		.join("/");

	if (sanitizedDomain.length === 0) {
		return {
			success: false,
			path: "",
			message: "Invalid domain name after sanitization",
			created: false,
		};
	}

	const rulesDir = getRulesDir(scope);
	const rulePath = join(rulesDir, `${sanitizedDomain}.md`);
	const ruleDir = dirname(rulePath);

	try {
		// Ensure rules directory (and any subdirectories) exist
		if (!existsSync(ruleDir)) {
			mkdirSync(ruleDir, { recursive: true });
		}

		const fileExists = existsSync(rulePath);
		let finalContent: string;

		if (fileExists && append) {
			// Append to existing file
			const existing = readFileSync(rulePath, "utf-8");

			// Check if content already exists (avoid duplicates)
			if (existing.includes(content.trim())) {
				return {
					success: true,
					path: rulePath,
					message: "Content already exists in memory file",
					created: false,
				};
			}

			// Append with separator
			finalContent = `${existing.trimEnd()}\n\n${content.trim()}\n`;
		} else {
			// Create new file or replace
			const frontmatter = generateFrontmatter(paths);
			finalContent = `${frontmatter}${content.trim()}\n`;
		}

		writeFileSync(rulePath, finalContent);

		return {
			success: true,
			path: rulePath,
			message:
				fileExists && append
					? `Appended learning to ${rulePath}`
					: `Created memory file at ${rulePath}`,
			created: !fileExists,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			path: rulePath,
			message: `Failed to write memory: ${message}`,
			created: false,
		};
	}
}

/**
 * Recursively list memory files in a directory
 */
function listFilesRecursive(dir: string, basePath = ""): string[] {
	if (!existsSync(dir)) {
		return [];
	}

	try {
		const { readdirSync, statSync } = require("node:fs");
		const entries = readdirSync(dir) as string[];
		const results: string[] = [];

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const relativePath = basePath ? `${basePath}/${entry}` : entry;

			try {
				const stat = statSync(fullPath);
				if (stat.isDirectory()) {
					results.push(...listFilesRecursive(fullPath, relativePath));
				} else if (entry.endsWith(".md")) {
					results.push(relativePath.replace(/\.md$/, ""));
				}
			} catch {
				// Skip files we can't stat
			}
		}

		return results;
	} catch {
		return [];
	}
}

/**
 * List existing memory files
 */
export function listMemoryFiles(scope: MemoryScope = "project"): string[] {
	const rulesDir = getRulesDir(scope);
	return listFilesRecursive(rulesDir);
}

/**
 * Read a memory file
 */
export function readMemoryFile(
	domain: string,
	scope: MemoryScope = "project",
): string | null {
	const rulesDir = getRulesDir(scope);
	const rulePath = join(rulesDir, `${domain}.md`);

	if (!existsSync(rulePath)) {
		return null;
	}

	try {
		return readFileSync(rulePath, "utf-8");
	} catch {
		return null;
	}
}
