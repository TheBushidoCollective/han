/**
 * AI-DLC Elaboration Workflow
 *
 * Handles elaboration branch creation and MR workflow when elaboration_review is enabled.
 * This allows plan review before construction begins.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getMergedSettings, findRepoRoot, type VcsConfig } from "./config.ts";

/**
 * Unit metadata from frontmatter
 */
export interface UnitMetadata {
	name: string;
	slug: string;
	status: string;
	dependsOn: string[];
	description?: string;
	discipline?: string;
}

/**
 * Intent summary for MR body
 */
export interface IntentSummary {
	title: string;
	problem?: string;
	solution?: string;
	criteria: string[];
	workflow?: string;
}

/**
 * Parse unit metadata from a unit file
 * @param unitPath - Path to unit-*.md file
 * @returns Unit metadata
 */
export function parseUnitMetadata(unitPath: string): UnitMetadata | null {
	if (!existsSync(unitPath)) return null;

	try {
		const content = readFileSync(unitPath, "utf-8");
		const filename = unitPath.split("/").pop() || "";
		const match = filename.match(/^unit-(\d+)-(.+)\.md$/);
		if (!match) return null;

		const [, num, slug] = match;
		const name = `unit-${num}-${slug}`;

		// Parse frontmatter
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (!fmMatch) {
			return {
				name,
				slug: `${num}-${slug}`,
				status: "pending",
				dependsOn: [],
			};
		}

		// Use han parse yaml via shell
		let frontmatter: Record<string, unknown> = {};
		try {
			const result = execSync("han parse yaml --json", {
				input: fmMatch[1],
				stdio: ["pipe", "pipe", "pipe"],
			});
			frontmatter = JSON.parse(result.toString());
		} catch {
			// Ignore parse errors, use defaults
		}

		// Extract description from content (first paragraph after frontmatter)
		const bodyMatch = content.match(/---\n[\s\S]*?\n---\n+#[^\n]+\n+## Description\n+([^\n]+)/);
		const description = bodyMatch ? bodyMatch[1].trim() : undefined;

		return {
			name,
			slug: `${num}-${slug}`,
			status: (frontmatter.status as string) || "pending",
			dependsOn: Array.isArray(frontmatter.depends_on) ? frontmatter.depends_on : [],
			description,
			discipline: frontmatter.discipline as string | undefined,
		};
	} catch {
		return null;
	}
}

/**
 * Parse intent summary from intent.md
 * @param intentDir - Path to intent directory
 * @returns Intent summary
 */
export function parseIntentSummary(intentDir: string): IntentSummary | null {
	const intentPath = join(intentDir, "intent.md");
	if (!existsSync(intentPath)) return null;

	try {
		const content = readFileSync(intentPath, "utf-8");

		// Extract title from first heading
		const titleMatch = content.match(/^#\s+(.+)$/m);
		const title = titleMatch ? titleMatch[1].trim() : "Untitled Intent";

		// Extract problem section
		const problemMatch = content.match(/## Problem\n+([\s\S]*?)(?=\n##|$)/);
		const problem = problemMatch ? problemMatch[1].trim() : undefined;

		// Extract solution section
		const solutionMatch = content.match(/## Solution\n+([\s\S]*?)(?=\n##|$)/);
		const solution = solutionMatch ? solutionMatch[1].trim() : undefined;

		// Extract success criteria (lines starting with - [ ])
		const criteriaMatch = content.match(/## Success Criteria\n+([\s\S]*?)(?=\n##|$)/);
		const criteria: string[] = [];
		if (criteriaMatch) {
			const lines = criteriaMatch[1].split("\n");
			for (const line of lines) {
				const match = line.match(/^-\s*\[[ x]\]\s*(.+)$/);
				if (match) {
					criteria.push(match[1].trim());
				}
			}
		}

		// Extract workflow from frontmatter
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
		let workflow: string | undefined;
		if (fmMatch) {
			try {
				const result = execSync("han parse yaml workflow -r", {
					input: fmMatch[1],
					stdio: ["pipe", "pipe", "pipe"],
				});
				workflow = result.toString().trim() || undefined;
			} catch {
				// No workflow specified
			}
		}

		return { title, problem, solution, criteria, workflow };
	} catch {
		return null;
	}
}

/**
 * Get all units from an intent directory
 * @param intentDir - Path to intent directory
 * @returns Array of unit metadata sorted by number
 */
export function getAllUnits(intentDir: string): UnitMetadata[] {
	if (!existsSync(intentDir)) return [];

	const files = readdirSync(intentDir).filter((f) => f.match(/^unit-\d+-.*\.md$/));
	const units: UnitMetadata[] = [];

	for (const file of files) {
		const metadata = parseUnitMetadata(join(intentDir, file));
		if (metadata) {
			units.push(metadata);
		}
	}

	// Sort by unit number
	return units.sort((a, b) => {
		const numA = parseInt(a.slug.split("-")[0], 10);
		const numB = parseInt(b.slug.split("-")[0], 10);
		return numA - numB;
	});
}

/**
 * Generate Mermaid DAG visualization from units
 * @param units - Array of unit metadata
 * @returns Mermaid diagram string
 */
export function generateDagVisualization(units: UnitMetadata[]): string {
	if (units.length === 0) {
		return "```mermaid\ngraph LR\n    START([Start]) --> END([Complete])\n```";
	}

	const lines: string[] = ["```mermaid", "graph TD"];

	// Add node definitions with status styling
	for (const unit of units) {
		const label = unit.name.replace(/^unit-/, "").replace(/-/g, " ");
		const shortId = unit.name.replace(/^unit-/, "u");

		// Use different shapes based on status
		switch (unit.status) {
			case "completed":
				lines.push(`    ${shortId}[${label}]:::completed`);
				break;
			case "in_progress":
				lines.push(`    ${shortId}[${label}]:::inProgress`);
				break;
			case "blocked":
				lines.push(`    ${shortId}[${label}]:::blocked`);
				break;
			default:
				lines.push(`    ${shortId}[${label}]:::pending`);
		}
	}

	// Add dependency edges
	for (const unit of units) {
		const targetId = unit.name.replace(/^unit-/, "u");

		if (unit.dependsOn.length === 0) {
			lines.push(`    START([Start]) --> ${targetId}`);
		} else {
			for (const dep of unit.dependsOn) {
				const sourceId = dep.replace(/^unit-/, "u");
				lines.push(`    ${sourceId} --> ${targetId}`);
			}
		}
	}

	// Find terminal nodes (not depended on by anyone)
	const dependedOn = new Set<string>();
	for (const unit of units) {
		for (const dep of unit.dependsOn) {
			dependedOn.add(dep);
		}
	}

	for (const unit of units) {
		if (!dependedOn.has(unit.name)) {
			const unitId = unit.name.replace(/^unit-/, "u");
			lines.push(`    ${unitId} --> END([Complete])`);
		}
	}

	// Add styling
	lines.push("");
	lines.push("    classDef completed fill:#22c55e,stroke:#16a34a,color:white");
	lines.push("    classDef inProgress fill:#3b82f6,stroke:#2563eb,color:white");
	lines.push("    classDef pending fill:#94a3b8,stroke:#64748b,color:white");
	lines.push("    classDef blocked fill:#ef4444,stroke:#dc2626,color:white");
	lines.push("```");

	return lines.join("\n");
}

/**
 * Generate ASCII DAG visualization (fallback for environments without Mermaid)
 * @param units - Array of unit metadata
 * @returns ASCII art diagram
 */
export function generateAsciiDag(units: UnitMetadata[]): string {
	if (units.length === 0) {
		return "No units defined.";
	}

	const lines: string[] = [];

	// Status icons
	const statusIcon: Record<string, string> = {
		completed: "[x]",
		in_progress: "[~]",
		pending: "[ ]",
		blocked: "[!]",
	};

	// Build adjacency list for topological layout
	const levels = new Map<string, number>();

	// Calculate level for each unit based on max dependency depth
	function getLevel(unitName: string, visited = new Set<string>()): number {
		if (levels.has(unitName)) return levels.get(unitName)!;
		if (visited.has(unitName)) return 0; // Cycle detection

		visited.add(unitName);
		const unit = units.find((u) => u.name === unitName);
		if (!unit) return 0;

		if (unit.dependsOn.length === 0) {
			levels.set(unitName, 0);
			return 0;
		}

		const maxDepLevel = Math.max(...unit.dependsOn.map((dep) => getLevel(dep, new Set(visited))));
		const level = maxDepLevel + 1;
		levels.set(unitName, level);
		return level;
	}

	// Calculate levels for all units
	for (const unit of units) {
		getLevel(unit.name);
	}

	// Group units by level
	const unitsByLevel = new Map<number, UnitMetadata[]>();
	for (const unit of units) {
		const level = levels.get(unit.name) || 0;
		if (!unitsByLevel.has(level)) {
			unitsByLevel.set(level, []);
		}
		unitsByLevel.get(level)!.push(unit);
	}

	// Render
	lines.push("Unit Dependency Graph");
	lines.push("=====================");
	lines.push("");
	lines.push("Legend: [ ] pending  [~] in-progress  [x] completed  [!] blocked");
	lines.push("");

	const maxLevel = Math.max(...Array.from(unitsByLevel.keys()));
	for (let level = 0; level <= maxLevel; level++) {
		const levelUnits = unitsByLevel.get(level) || [];
		const indent = "  ".repeat(level);

		for (const unit of levelUnits) {
			const icon = statusIcon[unit.status] || "[ ]";
			const deps = unit.dependsOn.length > 0 ? ` <- [${unit.dependsOn.map((d) => d.replace("unit-", "")).join(", ")}]` : "";
			lines.push(`${indent}${icon} ${unit.name.replace("unit-", "")}${deps}`);
		}
	}

	return lines.join("\n");
}

/**
 * Create plan branch for elaboration review
 * @param intentSlug - Intent slug identifier
 * @param config - VCS configuration
 * @param repoRoot - Repository root path
 * @returns Branch name created
 */
export function createPlanBranch(
	intentSlug: string,
	config: VcsConfig,
	repoRoot?: string,
): string {
	const cwd = repoRoot || findRepoRoot() || process.cwd();
	const branchName = `ai-dlc/${intentSlug}/plan`;
	const defaultBranch = config.default_branch;

	try {
		// Check if branch already exists
		try {
			execSync(`git rev-parse --verify ${branchName}`, { cwd, stdio: "pipe" });
			// Branch exists, switch to it
			execSync(`git checkout ${branchName}`, { cwd, stdio: "pipe" });
		} catch {
			// Branch doesn't exist, create from default branch
			execSync(`git checkout -b ${branchName} ${defaultBranch}`, {
				cwd,
				stdio: "pipe",
			});
		}

		return branchName;
	} catch (error) {
		throw new Error(`Failed to create plan branch: ${error}`);
	}
}

/**
 * Commit elaboration artifacts to current branch
 * @param intentDir - Path to intent directory (relative to repo root)
 * @param intentSlug - Intent slug for commit message
 * @param repoRoot - Repository root path
 */
export function commitElaborationArtifacts(
	intentDir: string,
	intentSlug: string,
	repoRoot?: string,
): void {
	const cwd = repoRoot || findRepoRoot() || process.cwd();

	try {
		// Stage all files in intent directory
		execSync(`git add "${intentDir}"`, { cwd, stdio: "pipe" });

		// Check if there are staged changes
		try {
			execSync("git diff --cached --quiet", { cwd, stdio: "pipe" });
			// No changes, nothing to commit
			return;
		} catch {
			// There are staged changes, proceed with commit
		}

		// Commit
		const message = `feat(ai-dlc): elaborate intent ${intentSlug}

- Define problem and solution
- Establish success criteria
- Create unit breakdown (if decomposed)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`;

		execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
			cwd,
			stdio: "pipe",
		});
	} catch (error) {
		throw new Error(`Failed to commit elaboration artifacts: ${error}`);
	}
}

/**
 * Generate MR body for plan review
 * @param intentSlug - Intent slug
 * @param intentDir - Path to intent directory
 * @returns Markdown string for MR body
 */
export function generatePlanMrBody(intentSlug: string, intentDir: string): string {
	const intent = parseIntentSummary(intentDir);
	const units = getAllUnits(intentDir);

	const lines: string[] = [];

	lines.push("## Summary");
	lines.push("");
	if (intent) {
		if (intent.problem) {
			lines.push("### Problem");
			lines.push(intent.problem);
			lines.push("");
		}
		if (intent.solution) {
			lines.push("### Solution");
			lines.push(intent.solution);
			lines.push("");
		}
		if (intent.workflow) {
			lines.push(`**Workflow:** ${intent.workflow}`);
			lines.push("");
		}
	}

	lines.push("## Success Criteria");
	lines.push("");
	if (intent && intent.criteria.length > 0) {
		for (const criterion of intent.criteria) {
			lines.push(`- [ ] ${criterion}`);
		}
	} else {
		lines.push("_See intent.md for criteria_");
	}
	lines.push("");

	if (units.length > 0) {
		lines.push("## Units");
		lines.push("");
		lines.push("| Unit | Discipline | Dependencies |");
		lines.push("|------|------------|--------------|");
		for (const unit of units) {
			const deps = unit.dependsOn.length > 0 ? unit.dependsOn.map((d) => d.replace("unit-", "")).join(", ") : "-";
			const discipline = unit.discipline || "-";
			lines.push(`| ${unit.name.replace("unit-", "")} | ${discipline} | ${deps} |`);
		}
		lines.push("");

		lines.push("## Dependency Graph");
		lines.push("");
		lines.push(generateDagVisualization(units));
		lines.push("");
	}

	lines.push("---");
	lines.push("");
	lines.push("_This plan was generated by AI-DLC elaboration. Review and merge to begin construction._");
	lines.push("");
	lines.push("🤖 Generated with [Claude Code](https://claude.com/claude-code)");

	return lines.join("\n");
}

/**
 * Create MR for plan review
 * @param intentSlug - Intent slug
 * @param intentDir - Path to intent directory
 * @param config - VCS configuration
 * @param repoRoot - Repository root path
 * @returns MR URL or null if creation failed
 */
export function createPlanMr(
	intentSlug: string,
	intentDir: string,
	config: VcsConfig,
	repoRoot?: string,
): string | null {
	const cwd = repoRoot || findRepoRoot() || process.cwd();
	const intent = parseIntentSummary(intentDir);
	const title = intent ? `Plan: ${intent.title}` : `Plan: ${intentSlug}`;
	const body = generatePlanMrBody(intentSlug, intentDir);
	const branchName = `ai-dlc/${intentSlug}/plan`;
	const baseBranch = config.default_branch;

	try {
		// Push branch to remote
		execSync(`git push -u origin ${branchName}`, { cwd, stdio: "pipe" });

		// Create PR using gh CLI
		const result = execSync(
			`gh pr create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}" --base ${baseBranch}`,
			{ cwd, stdio: "pipe" },
		);

		return result.toString().trim();
	} catch (error) {
		console.error(`Failed to create plan MR: ${error}`);
		return null;
	}
}

/**
 * Check if plan MR is merged
 * @param intentSlug - Intent slug
 * @param repoRoot - Repository root path
 * @returns true if merged or no review required, false if pending
 */
export function isPlanMrMerged(intentSlug: string, repoRoot?: string): boolean {
	const cwd = repoRoot || findRepoRoot() || process.cwd();
	const branchName = `ai-dlc/${intentSlug}/plan`;

	try {
		// Check if there's an open PR for this branch
		const result = execSync(`gh pr list --head ${branchName} --state open --json number`, {
			cwd,
			stdio: "pipe",
		});

		const prs = JSON.parse(result.toString());

		// If no open PR, either it's merged or never created
		if (prs.length === 0) {
			// Check if it was merged by looking for merged PRs
			const mergedResult = execSync(`gh pr list --head ${branchName} --state merged --json number`, {
				cwd,
				stdio: "pipe",
			});
			const mergedPrs = JSON.parse(mergedResult.toString());

			// If there's a merged PR, return true
			if (mergedPrs.length > 0) {
				return true;
			}

			// No PR at all - check if plan branch exists
			try {
				execSync(`git rev-parse --verify origin/${branchName}`, { cwd, stdio: "pipe" });
				// Branch exists but no PR - unusual state, allow construction
				return true;
			} catch {
				// No branch, no PR - plan not created yet, allow construction
				return true;
			}
		}

		// There's an open PR - not merged yet
		return false;
	} catch {
		// Error checking - allow construction to proceed
		return true;
	}
}

/**
 * Get plan MR status
 * @param intentSlug - Intent slug
 * @param repoRoot - Repository root path
 * @returns Status object with state and URL
 */
export function getPlanMrStatus(
	intentSlug: string,
	repoRoot?: string,
): { state: "none" | "open" | "merged" | "closed"; url?: string; number?: number } {
	const cwd = repoRoot || findRepoRoot() || process.cwd();
	const branchName = `ai-dlc/${intentSlug}/plan`;

	try {
		// Check for open PR
		const openResult = execSync(`gh pr list --head ${branchName} --state open --json number,url`, {
			cwd,
			stdio: "pipe",
		});
		const openPrs = JSON.parse(openResult.toString());
		if (openPrs.length > 0) {
			return { state: "open", url: openPrs[0].url, number: openPrs[0].number };
		}

		// Check for merged PR
		const mergedResult = execSync(`gh pr list --head ${branchName} --state merged --json number,url`, {
			cwd,
			stdio: "pipe",
		});
		const mergedPrs = JSON.parse(mergedResult.toString());
		if (mergedPrs.length > 0) {
			return { state: "merged", url: mergedPrs[0].url, number: mergedPrs[0].number };
		}

		// Check for closed PR
		const closedResult = execSync(`gh pr list --head ${branchName} --state closed --json number,url`, {
			cwd,
			stdio: "pipe",
		});
		const closedPrs = JSON.parse(closedResult.toString());
		if (closedPrs.length > 0) {
			return { state: "closed", url: closedPrs[0].url, number: closedPrs[0].number };
		}

		return { state: "none" };
	} catch {
		return { state: "none" };
	}
}
