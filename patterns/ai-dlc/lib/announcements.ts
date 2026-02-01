/**
 * AI-DLC Announcement Generation System
 *
 * Generates various announcement formats when an intent is completed:
 * - CHANGELOG: Conventional changelog entry (Keep a Changelog format)
 * - Release notes: User-facing summary of changes
 * - Social posts: Short-form posts for Twitter/LinkedIn
 * - Blog draft: Long-form announcement for company blog
 *
 * Usage:
 *   import { generateAnnouncements, AnnouncementFormat } from './announcements';
 *   await generateAnnouncements(intentDir, ['changelog', 'release-notes']);
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

/**
 * Valid announcement format types
 */
export type AnnouncementFormat =
	| "changelog"
	| "release-notes"
	| "social-posts"
	| "blog-draft";

/**
 * Intent metadata from frontmatter
 */
export interface IntentMetadata {
	title: string;
	problem: string;
	solution: string;
	criteria: string[];
	workflow: string;
	created: string;
	completed?: string;
	announcements: AnnouncementFormat[];
}

/**
 * Unit metadata from frontmatter
 */
export interface UnitMetadata {
	name: string;
	description: string;
	discipline: string;
	status: string;
}

/**
 * Generated announcement content
 */
export interface AnnouncementContent {
	format: AnnouncementFormat;
	filename: string;
	content: string;
}

/**
 * Parse YAML frontmatter from markdown file
 */
function parseYamlFrontmatter(
	content: string,
): Record<string, unknown> | null {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;

	try {
		const result = execSync("han parse yaml --json", {
			input: match[1],
			stdio: ["pipe", "pipe", "pipe"],
		});
		return JSON.parse(result.toString());
	} catch {
		return null;
	}
}

/**
 * Extract markdown section content
 */
function extractSection(content: string, sectionName: string): string {
	const regex = new RegExp(
		`## ${sectionName}\\n([\\s\\S]*?)(?=\\n## |$)`,
		"i",
	);
	const match = content.match(regex);
	return match ? match[1].trim() : "";
}

/**
 * Extract criteria list from markdown
 */
function extractCriteria(content: string): string[] {
	const criteriaSection = extractSection(content, "Success Criteria");
	const lines = criteriaSection.split("\n");
	return lines
		.filter((line) => line.match(/^[-*]\s*\[.\]/))
		.map((line) => line.replace(/^[-*]\s*\[.\]\s*/, "").trim());
}

/**
 * Load intent metadata from intent.md
 */
export function loadIntentMetadata(intentDir: string): IntentMetadata | null {
	const intentPath = join(intentDir, "intent.md");
	if (!existsSync(intentPath)) return null;

	const content = readFileSync(intentPath, "utf-8");
	const frontmatter = parseYamlFrontmatter(content);
	if (!frontmatter) return null;

	// Extract title from first # heading
	const titleMatch = content.match(/^#\s+(.+)$/m);
	const title = titleMatch ? titleMatch[1].trim() : "Untitled Intent";

	return {
		title,
		problem: extractSection(content, "Problem"),
		solution: extractSection(content, "Solution"),
		criteria: extractCriteria(content),
		workflow: (frontmatter.workflow as string) || "default",
		created: (frontmatter.created as string) || new Date().toISOString(),
		completed: frontmatter.completed as string | undefined,
		announcements: (frontmatter.announcements as AnnouncementFormat[]) || [],
	};
}

/**
 * Load all unit metadata from intent directory
 */
export function loadUnits(intentDir: string): UnitMetadata[] {
	const units: UnitMetadata[] = [];

	try {
		const files = execSync(`ls "${intentDir}"/unit-*.md 2>/dev/null || true`, {
			encoding: "utf-8",
		})
			.trim()
			.split("\n")
			.filter(Boolean);

		for (const file of files) {
			if (!existsSync(file)) continue;
			const content = readFileSync(file, "utf-8");
			const frontmatter = parseYamlFrontmatter(content);

			// Extract name from first # heading
			const nameMatch = content.match(/^#\s+(.+)$/m);
			const name = nameMatch ? nameMatch[1].trim() : file.split("/").pop() || "";

			units.push({
				name,
				description: extractSection(content, "Description"),
				discipline: (frontmatter?.discipline as string) || "general",
				status: (frontmatter?.status as string) || "pending",
			});
		}
	} catch {
		// No units found
	}

	return units;
}

/**
 * Categorize changes for changelog (Added/Changed/Fixed/Removed)
 */
function categorizeChanges(
	criteria: string[],
	problem: string,
): { added: string[]; changed: string[]; fixed: string[]; removed: string[] } {
	const result = { added: [], changed: [], fixed: [], removed: [] } as {
		added: string[];
		changed: string[];
		fixed: string[];
		removed: string[];
	};

	// Heuristic: bug fixes go to "Fixed", new features to "Added", improvements to "Changed"
	const isBugFix =
		problem.toLowerCase().includes("bug") ||
		problem.toLowerCase().includes("fix") ||
		problem.toLowerCase().includes("error") ||
		problem.toLowerCase().includes("broken");

	for (const criterion of criteria) {
		const lower = criterion.toLowerCase();

		if (lower.includes("remove") || lower.includes("delete")) {
			result.removed.push(criterion);
		} else if (
			lower.includes("fix") ||
			lower.includes("resolve") ||
			lower.includes("correct") ||
			isBugFix
		) {
			result.fixed.push(criterion);
		} else if (
			lower.includes("update") ||
			lower.includes("improve") ||
			lower.includes("enhance") ||
			lower.includes("refactor")
		) {
			result.changed.push(criterion);
		} else {
			result.added.push(criterion);
		}
	}

	return result;
}

/**
 * Generate CHANGELOG entry (Keep a Changelog format)
 */
export function generateChangelog(
	metadata: IntentMetadata,
	_units: UnitMetadata[],
): string {
	const date = metadata.completed || new Date().toISOString().split("T")[0];
	const categories = categorizeChanges(metadata.criteria, metadata.problem);

	let content = `## [Unreleased] - ${date}\n\n`;

	if (categories.added.length > 0) {
		content += "### Added\n\n";
		for (const item of categories.added) {
			content += `- ${item}\n`;
		}
		content += "\n";
	}

	if (categories.changed.length > 0) {
		content += "### Changed\n\n";
		for (const item of categories.changed) {
			content += `- ${item}\n`;
		}
		content += "\n";
	}

	if (categories.fixed.length > 0) {
		content += "### Fixed\n\n";
		for (const item of categories.fixed) {
			content += `- ${item}\n`;
		}
		content += "\n";
	}

	if (categories.removed.length > 0) {
		content += "### Removed\n\n";
		for (const item of categories.removed) {
			content += `- ${item}\n`;
		}
		content += "\n";
	}

	return content.trim();
}

/**
 * Generate user-facing release notes
 */
export function generateReleaseNotes(
	metadata: IntentMetadata,
	units: UnitMetadata[],
): string {
	let content = `# Release Notes: ${metadata.title}\n\n`;

	content += `## Overview\n\n${metadata.solution}\n\n`;

	content += `## What's New\n\n`;
	for (const criterion of metadata.criteria) {
		content += `- ${criterion}\n`;
	}
	content += "\n";

	if (units.length > 0) {
		content += `## Components\n\n`;
		for (const unit of units) {
			content += `### ${unit.name}\n\n`;
			content += `${unit.description}\n\n`;
		}
	}

	content += `## Background\n\n${metadata.problem}\n`;

	return content;
}

/**
 * Generate social media posts
 */
export function generateSocialPosts(
	metadata: IntentMetadata,
	_units: UnitMetadata[],
): string {
	// Twitter: 280 chars max
	const twitterPost = generateTwitterPost(metadata);

	// LinkedIn: Professional tone, longer
	const linkedinPost = generateLinkedInPost(metadata);

	return `# Social Media Posts

## Twitter (280 char max)

${twitterPost}

---

## LinkedIn

${linkedinPost}
`;
}

/**
 * Generate Twitter-optimized post (280 chars max)
 */
function generateTwitterPost(metadata: IntentMetadata): string {
	// Try to fit: emoji + title + brief benefit
	const benefit = metadata.criteria[0] || metadata.solution.split(".")[0];

	// Start with full version
	let post = `${metadata.title}: ${benefit}`;

	// Truncate if too long
	if (post.length > 277) {
		post = `${post.substring(0, 274)}...`;
	}

	return post;
}

/**
 * Generate LinkedIn post
 */
function generateLinkedInPost(metadata: IntentMetadata): string {
	let post = `**${metadata.title}**\n\n`;
	post += `${metadata.solution}\n\n`;
	post += `Key improvements:\n`;

	for (const criterion of metadata.criteria.slice(0, 3)) {
		post += `- ${criterion}\n`;
	}

	if (metadata.criteria.length > 3) {
		post += `- ...and ${metadata.criteria.length - 3} more improvements\n`;
	}

	return post;
}

/**
 * Generate blog draft
 */
export function generateBlogDraft(
	metadata: IntentMetadata,
	units: UnitMetadata[],
): string {
	let content = `# ${metadata.title}\n\n`;

	// Problem statement
	content += `## The Challenge\n\n${metadata.problem}\n\n`;

	// Solution overview
	content += `## Our Solution\n\n${metadata.solution}\n\n`;

	// Key features/benefits
	content += `## Key Features\n\n`;
	for (const criterion of metadata.criteria) {
		content += `### ${criterion}\n\n`;
		content += `[Expand on this feature - explain the benefit to users]\n\n`;
	}

	// Technical details (if units exist)
	if (units.length > 0) {
		content += `## Technical Details\n\n`;
		content += `This release involved ${units.length} key components:\n\n`;
		for (const unit of units) {
			content += `- **${unit.name}** (${unit.discipline}): ${unit.description}\n`;
		}
		content += "\n";
	}

	// What's next
	content += `## What's Next\n\n`;
	content += `[Describe upcoming features or improvements planned for the roadmap]\n\n`;

	// Call to action
	content += `## Get Started\n\n`;
	content += `[Instructions for users to access or try the new features]\n`;

	return content;
}

/**
 * Generate announcements for all configured formats
 */
export function generateAnnouncements(
	intentDir: string,
	formats?: AnnouncementFormat[],
): AnnouncementContent[] {
	const metadata = loadIntentMetadata(intentDir);
	if (!metadata) {
		throw new Error(`Cannot load intent metadata from ${intentDir}`);
	}

	const units = loadUnits(intentDir);
	const formatsToGenerate = formats || metadata.announcements;

	if (formatsToGenerate.length === 0) {
		return [];
	}

	const announcements: AnnouncementContent[] = [];

	for (const format of formatsToGenerate) {
		let content: string;
		let filename: string;

		switch (format) {
			case "changelog":
				content = generateChangelog(metadata, units);
				filename = "CHANGELOG.md";
				break;
			case "release-notes":
				content = generateReleaseNotes(metadata, units);
				filename = "RELEASE-NOTES.md";
				break;
			case "social-posts":
				content = generateSocialPosts(metadata, units);
				filename = "SOCIAL-POSTS.md";
				break;
			case "blog-draft":
				content = generateBlogDraft(metadata, units);
				filename = "BLOG-DRAFT.md";
				break;
			default:
				console.warn(`Unknown announcement format: ${format}`);
				continue;
		}

		announcements.push({ format, filename, content });
	}

	return announcements;
}

/**
 * Write announcements to the announcements directory
 */
export function writeAnnouncements(
	intentDir: string,
	announcements: AnnouncementContent[],
): string[] {
	const announcementsDir = join(intentDir, "announcements");

	// Create directory if it doesn't exist
	if (!existsSync(announcementsDir)) {
		mkdirSync(announcementsDir, { recursive: true });
	}

	const writtenFiles: string[] = [];

	for (const announcement of announcements) {
		const filePath = join(announcementsDir, announcement.filename);
		writeFileSync(filePath, announcement.content, "utf-8");
		writtenFiles.push(filePath);
	}

	return writtenFiles;
}

/**
 * Main function: Generate and write all configured announcements
 */
export function generateAndWriteAnnouncements(
	intentDir: string,
	formats?: AnnouncementFormat[],
): string[] {
	const announcements = generateAnnouncements(intentDir, formats);
	if (announcements.length === 0) {
		return [];
	}
	return writeAnnouncements(intentDir, announcements);
}

/**
 * Check if announcements are configured for this intent
 */
export function hasAnnouncementsConfigured(intentDir: string): boolean {
	const metadata = loadIntentMetadata(intentDir);
	return metadata !== null && metadata.announcements.length > 0;
}

/**
 * Get configured announcement formats
 */
export function getConfiguredFormats(
	intentDir: string,
): AnnouncementFormat[] {
	const metadata = loadIntentMetadata(intentDir);
	return metadata?.announcements || [];
}
