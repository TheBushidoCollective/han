import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ignore from "ignore";

interface ValidateOptions {
	failFast: boolean;
	dirsWith: string | null;
	command: string;
}

// Load gitignore rules from the repository root
function loadGitignoreRules(rootDir: string): ReturnType<typeof ignore> {
	const ig = ignore();

	// Add default patterns to always ignore
	ig.add([".git", "node_modules"]);

	// Try to read .gitignore from root
	const gitignorePath = join(rootDir, ".gitignore");
	if (existsSync(gitignorePath)) {
		try {
			const gitignoreContent = readFileSync(gitignorePath, "utf-8");
			ig.add(gitignoreContent);
		} catch (_e) {
			// If we can't read .gitignore, just continue with defaults
		}
	}

	return ig;
}

// Check if a filename matches a pattern (supports * wildcard)
function matchesPattern(filename: string, pattern: string): boolean {
	// Convert glob pattern to regex
	const regexPattern = pattern
		.replace(/\./g, "\\.")
		.replace(/\*/g, ".*")
		.replace(/\?/g, ".");
	const regex = new RegExp(`^${regexPattern}$`);
	return regex.test(filename);
}

// Check if directory contains any of the marker files/patterns
function hasMarkerFile(dir: string, patterns: string[]): boolean {
	try {
		const entries = readdirSync(dir);
		for (const pattern of patterns) {
			for (const entry of entries) {
				if (matchesPattern(entry, pattern)) {
					return true;
				}
			}
		}
		return false;
	} catch (_e) {
		return false;
	}
}

// Recursively find all directories containing a marker file
function findDirectoriesWithMarker(
	rootDir: string,
	markerPatterns: string[],
	ig: ReturnType<typeof ignore>,
): string[] {
	const dirs: string[] = [];

	function searchDir(dir: string): void {
		// Get relative path from root for gitignore matching
		const relativePath = relative(rootDir, dir);

		// Skip if ignored by gitignore rules (empty path means root dir, which we don't skip)
		if (relativePath && ig.ignores(relativePath)) {
			return;
		}

		try {
			// Check if this directory contains any of the marker files
			if (hasMarkerFile(dir, markerPatterns)) {
				dirs.push(dir);
			}

			// Recursively search subdirectories
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory()) {
					searchDir(join(dir, entry.name));
				}
			}
		} catch (_e) {
			// Skip directories we can't read
		}
	}

	searchDir(rootDir);
	return dirs;
}

// Run command in directory
function runCommand(dir: string, cmd: string): boolean {
	try {
		execSync(cmd, {
			cwd: dir,
			stdio: "inherit",
			encoding: "utf8",
		});
		return true;
	} catch (_e) {
		return false;
	}
}

export function validate(options: ValidateOptions): void {
	const { failFast, dirsWith, command: commandToRun } = options;

	// Main execution
	const rootDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	if (!dirsWith) {
		console.error("Error: --dirs-with <file> is required");
		process.exit(1);
	}

	// Parse comma-delimited patterns
	const patterns = dirsWith.split(",").map((p) => p.trim());

	// Load gitignore rules
	const ig = loadGitignoreRules(rootDir);

	const targetDirs = findDirectoriesWithMarker(rootDir, patterns, ig);

	if (targetDirs.length === 0) {
		console.log(`No directories found with ${dirsWith}`);
		process.exit(0);
	}

	const failures: string[] = [];

	for (const dir of targetDirs) {
		const success = runCommand(dir, commandToRun);

		if (!success) {
			const relativePath = dir.replace(`${rootDir}/`, "");
			failures.push(relativePath);

			console.error(
				`\nFailed when trying to run \`${commandToRun}\` in directory: \`${relativePath}\`\n`,
			);

			if (failFast) {
				process.exit(2);
			}
		}
	}

	if (failures.length > 0) {
		console.error(
			`\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed validation:\n`,
		);
		for (const dir of failures) {
			console.error(`  - ${dir}`);
		}
		process.exit(2);
	}

	console.log(
		`\n✅ All ${targetDirs.length} director${targetDirs.length === 1 ? "y" : "ies"} passed validation`,
	);
	process.exit(0);
}
