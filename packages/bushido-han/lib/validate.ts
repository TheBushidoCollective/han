import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ignore from "ignore";

interface ValidateOptions {
	failFast: boolean;
	dirsWith: string | null;
	testDir?: string | null;
	command: string;
	stdinData?: string | null;
}

// Load .gitignore rules from root directory
function loadGitignoreRules(rootDir: string): ReturnType<typeof ignore> {
	const ig = ignore();
	const gitignorePath = join(rootDir, ".gitignore");

	if (existsSync(gitignorePath)) {
		try {
			const gitignoreContent = readFileSync(gitignorePath, "utf8");
			ig.add(gitignoreContent);
		} catch (_e) {
			// If we can't read .gitignore, continue without it
		}
	}

	// Always ignore common patterns
	ig.add(["node_modules/", ".git/"]);

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

		// Skip if this path is git-ignored (only check subdirectories, not root)
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
function runCommand(
	dir: string,
	cmd: string,
	stdinData?: string | null,
): boolean {
	try {
		execSync(cmd, {
			cwd: dir,
			// If stdinData provided, pipe it; otherwise ignore stdin entirely
			stdio: stdinData
				? ["pipe", "inherit", "inherit"]
				: ["ignore", "inherit", "inherit"],
			input: stdinData || undefined,
			encoding: "utf8",
			shell: "/bin/sh",
			env: process.env,
		});
		return true;
	} catch (_e) {
		return false;
	}
}

// Run test command silently in directory (returns true if exit code 0)
function testDirCommand(dir: string, cmd: string): boolean {
	try {
		execSync(cmd, {
			cwd: dir,
			stdio: ["ignore", "ignore", "ignore"],
			encoding: "utf8",
			shell: "/bin/sh",
			env: process.env,
		});
		return true;
	} catch (_e) {
		return false;
	}
}

export function validate(options: ValidateOptions): void {
	const {
		failFast,
		dirsWith,
		testDir,
		command: commandToRun,
		stdinData,
	} = options;

	// Main execution
	const rootDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	if (!dirsWith) {
		console.error("Error: --dirs-with <file> is required");
		process.exit(1);
	}

	// Parse comma-delimited patterns
	const patterns = dirsWith.split(",").map((p) => p.trim());

	// Load .gitignore rules
	const ig = loadGitignoreRules(rootDir);

	let targetDirs = findDirectoriesWithMarker(rootDir, patterns, ig);

	// Filter directories using test command if specified
	if (testDir && targetDirs.length > 0) {
		targetDirs = targetDirs.filter((dir) => testDirCommand(dir, testDir));
	}

	if (targetDirs.length === 0) {
		console.log(`No directories found with ${dirsWith}`);
		process.exit(0);
	}

	const failures: string[] = [];

	for (const dir of targetDirs) {
		const success = runCommand(dir, commandToRun, stdinData);

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
