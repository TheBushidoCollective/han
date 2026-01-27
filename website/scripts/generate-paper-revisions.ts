import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as Diff from "diff";

const PAPERS_DIR = path.join(process.cwd(), "content", "papers");
const OUTPUT_DIR = path.join(process.cwd(), "public", "data");

interface RevisionChange {
	type: "added" | "removed" | "unchanged";
	content: string;
	lineNumber?: number;
}

interface SectionChange {
	section: string; // Normalized name for display
	originalSection?: string; // Original heading text for anchor links
	isNew: boolean;
	isRemoved?: boolean;
	renamedFrom?: string; // Old section name if this is a rename
	linesAdded: number;
	linesRemoved: number;
}

interface Revision {
	version: string;
	date: string;
	commitHash: string;
	fullCommitHash: string; // Full hash for fetching from GitHub
	commitMessage: string;
	stats: {
		linesAdded: number;
		linesRemoved: number;
	};
	sectionChanges: SectionChange[];
}

interface PaperRevisions {
	slug: string;
	currentVersion: string;
	revisions: Revision[];
	newSections: string[]; // Sections added in latest version
}

function getGitLog(filePath: string): Array<{
	hash: string;
	date: string;
	message: string;
}> {
	try {
		const result = execSync(
			`git log --pretty=format:"%H|%aI|%s" --follow -- "${filePath}"`,
			{ encoding: "utf-8", cwd: process.cwd() },
		);

		if (!result.trim()) return [];

		return result
			.trim()
			.split("\n")
			.map((line) => {
				const [hash, date, ...messageParts] = line.split("|");
				return {
					hash,
					date,
					message: messageParts.join("|"),
				};
			});
	} catch {
		return [];
	}
}

function getFileAtCommit(filePath: string, commitHash: string): string | null {
	try {
		// Get the relative path from repo root
		const repoRoot = execSync("git rev-parse --show-toplevel", {
			encoding: "utf-8",
		}).trim();
		const relativePath = path.relative(repoRoot, filePath);

		const result = execSync(`git show ${commitHash}:"${relativePath}"`, {
			encoding: "utf-8",
			cwd: repoRoot,
		});
		return result;
	} catch {
		return null;
	}
}

/**
 * Normalize section name by removing leading numbers, roman numerals, and punctuation
 * e.g., "VI. Decision Framework" -> "Decision Framework"
 *       "1. Introduction" -> "Introduction"
 *       "### Pattern A: Auditable" -> "Pattern A: Auditable"
 */
function normalizeSectionName(name: string): string {
	return (
		name
			// Remove leading roman numerals (I, II, III, IV, V, VI, VII, VIII, IX, X, XI, XII, XIII, etc.)
			.replace(/^[IVXLCDM]+\.\s*/i, "")
			// Remove leading numbers (1., 2., 3., etc.)
			.replace(/^\d+\.\s*/, "")
			// Remove leading letters (A., B., C., etc.)
			.replace(/^[A-Z]\.\s*/i, "")
			.trim()
	);
}

function extractSections(content: string): Map<string, string> {
	const sections = new Map<string, string>();
	const lines = content.split("\n");
	let currentSection = "Introduction";
	let currentContent: string[] = [];
	let inCodeBlock = false;

	for (const line of lines) {
		// Track fenced code blocks (``` or ~~~)
		if (line.trim().startsWith("```") || line.trim().startsWith("~~~")) {
			inCodeBlock = !inCodeBlock;
			currentContent.push(line);
			continue;
		}

		// Skip headers inside code blocks
		if (inCodeBlock) {
			currentContent.push(line);
			continue;
		}

		// Match ## or ### headings (not inside code blocks)
		const match = line.match(/^(#{2,3})\s+(.+)$/);
		if (match) {
			// Save previous section
			if (currentContent.length > 0) {
				sections.set(currentSection, currentContent.join("\n"));
			}
			currentSection = match[2].trim();
			currentContent = [];
		} else {
			currentContent.push(line);
		}
	}

	// Save last section
	if (currentContent.length > 0) {
		sections.set(currentSection, currentContent.join("\n"));
	}

	// Normalize section content by trimming whitespace
	const normalized = new Map<string, string>();
	for (const [name, content] of sections) {
		normalized.set(name, content.trim());
	}

	return normalized;
}

function computeDiff(
	oldContent: string,
	newContent: string,
): {
	changes: RevisionChange[];
	stats: { linesAdded: number; linesRemoved: number };
} {
	const diff = Diff.diffLines(oldContent, newContent);
	const changes: RevisionChange[] = [];
	let linesAdded = 0;
	let linesRemoved = 0;
	let lineNumber = 1;

	for (const part of diff) {
		const lines = part.value.split("\n").filter((l) => l !== "");

		if (part.added) {
			linesAdded += lines.length;
			for (const line of lines) {
				changes.push({
					type: "added",
					content: line,
					lineNumber: lineNumber++,
				});
			}
		} else if (part.removed) {
			linesRemoved += lines.length;
			for (const line of lines) {
				changes.push({
					type: "removed",
					content: line,
				});
			}
		} else {
			for (const line of lines) {
				changes.push({
					type: "unchanged",
					content: line,
					lineNumber: lineNumber++,
				});
			}
		}
	}

	return { changes, stats: { linesAdded, linesRemoved } };
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
function contentSimilarity(a: string, b: string): number {
	if (a === b) return 1;
	if (!a || !b) return 0;

	const aLines = new Set(a.split("\n").filter((l) => l.trim()));
	const bLines = new Set(b.split("\n").filter((l) => l.trim()));

	let matches = 0;
	for (const line of aLines) {
		if (bLines.has(line)) matches++;
	}

	const total = Math.max(aLines.size, bLines.size);
	return total > 0 ? matches / total : 0;
}

function computeSectionChanges(
	oldContent: string,
	newContent: string,
): SectionChange[] {
	const oldSections = extractSections(oldContent);
	const newSections = extractSections(newContent);
	const changes: SectionChange[] = [];

	// Create normalized lookup maps for matching
	const oldNormalized = new Map<string, { name: string; content: string }>();
	for (const [name, content] of oldSections) {
		oldNormalized.set(normalizeSectionName(name), { name, content });
	}

	const newNormalized = new Map<string, { name: string; content: string }>();
	for (const [name, content] of newSections) {
		newNormalized.set(normalizeSectionName(name), { name, content });
	}

	// Track which old sections have been matched (for rename detection)
	const matchedOldSections = new Set<string>();

	// First pass: find exact matches and modifications
	for (const [
		normalizedName,
		{ name: originalName, content },
	] of newNormalized) {
		const oldSection = oldNormalized.get(normalizedName);

		if (oldSection) {
			matchedOldSections.add(normalizedName);
			if (oldSection.content !== content) {
				// Modified section
				const { stats } = computeDiff(oldSection.content, content);
				if (stats.linesAdded > 0 || stats.linesRemoved > 0) {
					changes.push({
						section: normalizedName,
						originalSection: originalName,
						isNew: false,
						linesAdded: stats.linesAdded,
						linesRemoved: stats.linesRemoved,
					});
				}
			}
		}
	}

	// Collect unmatched sections (with both normalized and original names)
	const unmatchedNew: Array<{
		normalizedName: string;
		originalName: string;
		content: string;
	}> = [];
	const unmatchedOld: Array<{
		normalizedName: string;
		originalName: string;
		content: string;
	}> = [];

	for (const [normalizedName, data] of newNormalized) {
		if (!oldNormalized.has(normalizedName)) {
			unmatchedNew.push({
				normalizedName,
				originalName: data.name,
				content: data.content,
			});
		}
	}

	for (const [normalizedName, data] of oldNormalized) {
		if (
			!matchedOldSections.has(normalizedName) &&
			!newNormalized.has(normalizedName)
		) {
			unmatchedOld.push({
				normalizedName,
				originalName: data.name,
				content: data.content,
			});
		}
	}

	// Second pass: detect renames by matching similar content
	const usedOldSections = new Set<string>();

	for (const newSection of unmatchedNew) {
		let bestMatch: {
			normalizedName: string;
			originalName: string;
			similarity: number;
		} | null = null;

		for (const oldSection of unmatchedOld) {
			if (usedOldSections.has(oldSection.normalizedName)) continue;

			const similarity = contentSimilarity(
				oldSection.content,
				newSection.content,
			);
			if (
				similarity > 0.7 &&
				(!bestMatch || similarity > bestMatch.similarity)
			) {
				bestMatch = {
					normalizedName: oldSection.normalizedName,
					originalName: oldSection.originalName,
					similarity,
				};
			}
		}

		if (bestMatch) {
			// This is a rename
			usedOldSections.add(bestMatch.normalizedName);
			const oldSection = unmatchedOld.find(
				(s) => s.normalizedName === bestMatch!.normalizedName,
			)!;
			const { stats } = computeDiff(oldSection.content, newSection.content);

			changes.push({
				section: newSection.normalizedName,
				originalSection: newSection.originalName,
				isNew: false,
				renamedFrom: bestMatch.normalizedName,
				linesAdded: stats.linesAdded,
				linesRemoved: stats.linesRemoved,
			});
		} else {
			// Truly new section
			changes.push({
				section: newSection.normalizedName,
				originalSection: newSection.originalName,
				isNew: true,
				linesAdded: newSection.content.split("\n").length,
				linesRemoved: 0,
			});
		}
	}

	// Add truly removed sections
	for (const oldSection of unmatchedOld) {
		if (!usedOldSections.has(oldSection.normalizedName)) {
			changes.push({
				section: oldSection.normalizedName,
				originalSection: oldSection.originalName,
				isNew: false,
				isRemoved: true,
				linesAdded: 0,
				linesRemoved: oldSection.content.split("\n").length,
			});
		}
	}

	return changes;
}

function assignVersions(
	commits: Array<{ hash: string; date: string; message: string }>,
): Map<string, string> {
	const versions = new Map<string, string>();

	// Reverse to process oldest first, assign simple incrementing version numbers
	const reversed = [...commits].reverse();

	for (let i = 0; i < reversed.length; i++) {
		const commit = reversed[i];
		// Simple integer versioning: v1, v2, v3, etc.
		versions.set(commit.hash, String(i + 1));
	}

	return versions;
}

function generatePaperRevisions(filePath: string): PaperRevisions | null {
	const slug = path.basename(filePath, path.extname(filePath));
	const commits = getGitLog(filePath);

	if (commits.length === 0) {
		console.log(`  No git history for ${slug}`);
		return null;
	}

	const versions = assignVersions(commits);
	const revisions: Revision[] = [];
	const currentContent = fs.readFileSync(filePath, "utf-8");

	// Process commits (newest to oldest)
	for (let i = 0; i < commits.length; i++) {
		const commit = commits[i];
		const previousCommit = commits[i + 1];

		const newContent = getFileAtCommit(filePath, commit.hash);
		const oldContent = previousCommit
			? getFileAtCommit(filePath, previousCommit.hash)
			: "";

		if (newContent === null) continue;

		const { changes, stats } = computeDiff(oldContent || "", newContent);
		const sectionChanges = computeSectionChanges(oldContent || "", newContent);

		// Only include revisions with actual changes
		if (stats.linesAdded > 0 || stats.linesRemoved > 0) {
			revisions.push({
				version: versions.get(commit.hash) || "1.0",
				date: commit.date.split("T")[0],
				commitHash: commit.hash.substring(0, 7),
				fullCommitHash: commit.hash, // For fetching from GitHub
				commitMessage: commit.message,
				stats,
				sectionChanges,
			});
		}
	}

	// Deduplicate versions (keep latest commit for each version)
	const seenVersions = new Set<string>();
	const deduplicatedRevisions = revisions.filter((r) => {
		if (seenVersions.has(r.version)) return false;
		seenVersions.add(r.version);
		return true;
	});

	// Get new sections in latest version compared to first tracked version
	const firstContent =
		commits.length > 1
			? getFileAtCommit(filePath, commits[commits.length - 1].hash)
			: "";
	const firstSections = extractSections(firstContent || "");
	const currentSections = extractSections(currentContent);
	const newSections: string[] = [];

	for (const section of currentSections.keys()) {
		if (!firstSections.has(section)) {
			newSections.push(section);
		}
	}

	return {
		slug,
		currentVersion:
			deduplicatedRevisions[0]?.version ||
			versions.get(commits[0]?.hash) ||
			"1.0",
		revisions: deduplicatedRevisions.slice(0, 10), // Keep last 10 versions
		newSections,
	};
}

// Main execution
console.log("Generating paper revision data...\n");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Get all paper files
const paperFiles = fs
	.readdirSync(PAPERS_DIR)
	.filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
	.map((f) => path.join(PAPERS_DIR, f));

const allRevisions: Record<string, PaperRevisions> = {};

for (const filePath of paperFiles) {
	const slug = path.basename(filePath, path.extname(filePath));
	console.log(`Processing: ${slug}`);

	const revisions = generatePaperRevisions(filePath);
	if (revisions) {
		allRevisions[slug] = revisions;
		console.log(
			`  Found ${revisions.revisions.length} revisions, current version: ${revisions.currentVersion}`,
		);
		if (revisions.newSections.length > 0) {
			console.log(`  New sections: ${revisions.newSections.join(", ")}`);
		}
	}
}

// Write output
const outputPath = path.join(OUTPUT_DIR, "paper-revisions.json");
fs.writeFileSync(outputPath, JSON.stringify(allRevisions, null, 2));
console.log(`\n✓ Paper revisions written to ${outputPath}`);
