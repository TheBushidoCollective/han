/**
 * Git source provider for Han Memory Team layer
 *
 * Extracts observations from git commit history.
 * Provides team knowledge about who changed what and why.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import type {
	ExtractedObservation,
	ExtractOptions,
	MemoryProvider,
	ObservationType,
} from "../types.ts";

/**
 * Parse git log output into structured commit data
 */
interface GitCommit {
	sha: string;
	author: string;
	timestamp: number;
	subject: string;
	body: string;
	files: string[];
}

/**
 * Execute a git command and return output
 */
function execGit(command: string): string {
	try {
		return execSync(`git ${command}`, {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
	} catch (_error) {
		// Git command failed
		return "";
	}
}

/**
 * Check if current directory is a git repository
 */
function isGitRepo(): boolean {
	return existsSync(".git");
}

/**
 * Get commits from git log
 */
function getCommits(options: ExtractOptions): GitCommit[] {
	const commits: GitCommit[] = [];

	// Build git log command
	const args: string[] = [];

	// Note: We'll apply limit after filtering by timestamp for more accurate results
	// Filter by authors
	if (options.authors && options.authors.length > 0) {
		for (const author of options.authors) {
			args.push(`--author="${author}"`);
		}
	}

	// Custom format: SHA|Author|Timestamp|Subject
	// Using format that's easy to parse
	const format = "%H|%an <%ae>|%at|%s";
	args.push(`--format="${format}"`);

	const logOutput = execGit(`log ${args.join(" ")}`);
	if (!logOutput) {
		return commits;
	}

	const lines = logOutput.split("\n");
	for (const line of lines) {
		if (!line.trim()) continue;

		const parts = line.split("|");
		if (parts.length < 4) continue;

		const [sha, author, timestampStr, subject] = parts;
		const timestamp = Number.parseInt(timestampStr, 10) * 1000; // Convert to ms

		// Get commit body
		const body = execGit(`log -1 --format=%b ${sha}`);

		// Get files changed in this commit
		const files = getCommitFiles(sha, options.files);

		// If file filtering is active and no files match, skip this commit
		if (options.files && options.files.length > 0 && files.length === 0) {
			continue;
		}

		commits.push({
			sha,
			author,
			timestamp,
			subject,
			body,
			files,
		});
	}

	// Apply timestamp filtering (more precise than git's --since)
	let filtered = commits;
	if (options.since !== undefined) {
		const since = options.since;
		filtered = commits.filter((commit) => commit.timestamp >= since);
	}

	// Apply limit after filtering
	if (options.limit && filtered.length > options.limit) {
		filtered = filtered.slice(0, options.limit);
	}

	return filtered;
}

/**
 * Get list of files changed in a commit
 */
function getCommitFiles(sha: string, filePatterns?: string[]): string[] {
	const output = execGit(`diff-tree --no-commit-id --name-only -r ${sha}`);
	if (!output) {
		return [];
	}

	const files = output.split("\n").filter((f) => f.trim());

	// Apply file pattern filtering if provided
	if (filePatterns && filePatterns.length > 0) {
		return files.filter((file) => {
			return filePatterns.some((pattern) => {
				// Simple glob matching (just prefix/suffix for now)
				if (pattern.includes("*")) {
					const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
					return regex.test(file);
				}
				return file.includes(pattern);
			});
		});
	}

	return files;
}

/**
 * Infer observation type from commit message
 * Uses conventional commit prefixes
 */
function inferType(commit: GitCommit): ObservationType {
	const _subject = commit.subject.toLowerCase();

	// All git commits are type "commit"
	// We could infer more specific types based on conventional commits,
	// but for now keeping it simple
	return "commit";
}

/**
 * Build detail field from commit message
 */
function buildDetail(commit: GitCommit): string {
	const parts = [commit.subject];

	if (commit.body?.trim()) {
		parts.push("");
		parts.push(commit.body);
	}

	return parts.join("\n");
}

/**
 * Git source provider
 */
export const gitProvider: MemoryProvider = {
	name: "git",

	async isAvailable(): Promise<boolean> {
		return isGitRepo();
	},

	async extract(options: ExtractOptions): Promise<ExtractedObservation[]> {
		if (!isGitRepo()) {
			return [];
		}

		const commits = getCommits(options);
		const observations: ExtractedObservation[] = [];

		for (const commit of commits) {
			observations.push({
				source: `git:commit:${commit.sha}`,
				type: inferType(commit),
				timestamp: commit.timestamp,
				author: commit.author,
				summary: commit.subject,
				detail: buildDetail(commit),
				files: commit.files,
			});
		}

		return observations;
	},
};
