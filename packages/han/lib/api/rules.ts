/**
 * Rules API - List and retrieve rule files
 *
 * GET /api/rules - List all rule files from project and user scopes
 * GET /api/rules/:domain - Get rule content by domain name
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/**
 * Rule file metadata
 */
export interface RuleFile {
	/** Domain/name of the rule (filename without extension) */
	domain: string;
	/** Full filename */
	filename: string;
	/** Scope: project (.claude/rules/) or user (~/.claude/rules/) */
	scope: "project" | "user";
	/** Full path to the file */
	path: string;
	/** File size in bytes */
	size: number;
}

/**
 * Rule content response
 */
export interface RuleContent {
	domain: string;
	scope: "project" | "user";
	path: string;
	content: string;
}

/**
 * Get the project rules directory path for a given project root
 */
function getProjectRulesPath(projectPath?: string): string {
	if (projectPath) {
		return join(projectPath, ".claude", "rules");
	}
	return join(process.cwd(), ".claude", "rules");
}

/**
 * Get the user rules directory path
 */
function getUserRulesPath(): string {
	return join(homedir(), ".claude", "rules");
}

/**
 * Extended rule file with project info
 */
export interface RuleFileWithProject extends RuleFile {
	/** Project path if from a project (null for user scope) */
	projectPath: string | null;
	/** Project display name if from a project */
	projectName: string | null;
}

/**
 * Recursively list all markdown files including subdirectories
 */
function listRulesRecursive(
	dirPath: string,
	scope: "project" | "user",
	projectPath?: string,
	projectName?: string,
	prefix = "",
): RuleFileWithProject[] {
	if (!existsSync(dirPath)) {
		return [];
	}

	const results: RuleFileWithProject[] = [];

	try {
		const entries = readdirSync(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name);

			if (entry.isDirectory()) {
				// Recurse into subdirectory with updated prefix
				const subPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
				results.push(
					...listRulesRecursive(
						fullPath,
						scope,
						projectPath,
						projectName,
						subPrefix,
					),
				);
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				const stats = statSync(fullPath);
				const domain = prefix
					? `${prefix}/${basename(entry.name, ".md")}`
					: basename(entry.name, ".md");

				results.push({
					domain,
					filename: entry.name,
					scope,
					path: fullPath,
					size: stats.size,
					projectPath: projectPath ?? null,
					projectName: projectName ?? null,
				});
			}
		}
	} catch {
		// Ignore errors
	}

	return results;
}

/**
 * List all rules from both project and user scopes
 * @deprecated Use listAllRules() instead which works across all registered projects
 */
export function listRules(): RuleFile[] {
	const projectRules = listRulesRecursive(getProjectRulesPath(), "project");
	const userRules = listRulesRecursive(getUserRulesPath(), "user");

	// Return project rules first, then user rules
	return [...projectRules, ...userRules];
}

/**
 * List rules for a specific project
 */
export function listRulesForProject(
	projectPath: string,
	projectName: string,
): RuleFileWithProject[] {
	const rulesDir = getProjectRulesPath(projectPath);
	return listRulesRecursive(rulesDir, "project", projectPath, projectName);
}

/**
 * List all rules across all registered projects and user scope
 * This is the main function to use for the browse UI
 */
export function listAllRules(
	projects: Array<{ path: string; name: string }>,
): RuleFileWithProject[] {
	const allRules: RuleFileWithProject[] = [];

	// Get rules from each project
	for (const project of projects) {
		const projectRules = listRulesForProject(project.path, project.name);
		allRules.push(...projectRules);
	}

	// Get user rules (not project-specific)
	const userRules = listRulesRecursive(getUserRulesPath(), "user");
	allRules.push(...userRules);

	return allRules;
}

/**
 * Get rule content by domain and scope
 */
export function getRule(
	domain: string,
	scope: "project" | "user",
): RuleContent | null {
	const dirPath =
		scope === "project" ? getProjectRulesPath() : getUserRulesPath();
	const filePath = join(dirPath, `${domain}.md`);

	if (!existsSync(filePath)) {
		return null;
	}

	try {
		const content = readFileSync(filePath, "utf-8");
		return {
			domain,
			scope,
			path: filePath,
			content,
		};
	} catch {
		return null;
	}
}

/**
 * Find a rule by domain, preferring project scope over user scope
 */
export function findRule(domain: string): RuleContent | null {
	// Try project scope first
	const projectRule = getRule(domain, "project");
	if (projectRule) {
		return projectRule;
	}

	// Fall back to user scope
	return getRule(domain, "user");
}

/**
 * Handle rules API requests
 */
export async function handleRulesRequest(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const path = url.pathname;

	// Extract domain and optional scope from path: /api/rules/:domain or /api/rules/:domain/:scope
	const ruleMatch = path.match(/^\/api\/rules\/([^/]+)(?:\/([^/]+))?$/);

	try {
		if (ruleMatch) {
			// GET /api/rules/:domain or /api/rules/:domain/:scope
			const domain = decodeURIComponent(ruleMatch[1]);
			const scopeParam = ruleMatch[2] as "project" | "user" | undefined;

			let rule: RuleContent | null;
			if (scopeParam && (scopeParam === "project" || scopeParam === "user")) {
				// Specific scope requested
				rule = getRule(domain, scopeParam);
			} else {
				// Auto-detect scope (prefer project)
				rule = findRule(domain);
			}

			if (!rule) {
				return new Response(
					JSON.stringify({
						error: "Rule not found",
						details: `No rule found for domain: ${domain}${scopeParam ? ` in ${scopeParam} scope` : ""}`,
					}),
					{ status: 404, headers: { "Content-Type": "application/json" } },
				);
			}

			return new Response(JSON.stringify(rule), {
				headers: { "Content-Type": "application/json" },
			});
		}

		// GET /api/rules
		const rules = listRules();
		return new Response(JSON.stringify({ data: rules, total: rules.length }), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return new Response(
			JSON.stringify({ error: "Internal server error", details: message }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}
