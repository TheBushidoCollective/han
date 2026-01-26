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
	section: string;
	isNew: boolean;
	linesAdded: number;
	linesRemoved: number;
}

interface Revision {
	version: string;
	date: string;
	commitHash: string;
	commitMessage: string;
	stats: {
		linesAdded: number;
		linesRemoved: number;
	};
	sectionChanges: SectionChange[];
	diff: RevisionChange[];
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

function extractSections(content: string): Map<string, string> {
	const sections = new Map<string, string>();
	const lines = content.split("\n");
	let currentSection = "Introduction";
	let currentContent: string[] = [];

	for (const line of lines) {
		// Match ## or ### headings
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

	return sections;
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

function computeSectionChanges(
	oldContent: string,
	newContent: string,
): SectionChange[] {
	const oldSections = extractSections(oldContent);
	const newSections = extractSections(newContent);
	const changes: SectionChange[] = [];

	// Check for new and modified sections
	for (const [section, content] of newSections) {
		const oldSectionContent = oldSections.get(section);

		if (!oldSectionContent) {
			// New section
			changes.push({
				section,
				isNew: true,
				linesAdded: content.split("\n").length,
				linesRemoved: 0,
			});
		} else if (oldSectionContent !== content) {
			// Modified section
			const { stats } = computeDiff(oldSectionContent, content);
			if (stats.linesAdded > 0 || stats.linesRemoved > 0) {
				changes.push({
					section,
					isNew: false,
					linesAdded: stats.linesAdded,
					linesRemoved: stats.linesRemoved,
				});
			}
		}
	}

	// Check for removed sections
	for (const [section, content] of oldSections) {
		if (!newSections.has(section)) {
			changes.push({
				section,
				isNew: false,
				linesAdded: 0,
				linesRemoved: content.split("\n").length,
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
				commitMessage: commit.message,
				stats,
				sectionChanges,
				diff: changes.slice(0, 500), // Limit diff size for performance
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
