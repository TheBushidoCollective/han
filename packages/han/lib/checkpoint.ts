import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	type MarketplaceConfig,
} from "./config/claude-settings.ts";
import {
	buildManifest,
	type CacheManifest,
	findFilesWithGlob,
	getCacheDir,
	getProjectRoot,
} from "./hook-cache.ts";
import { loadPluginConfig } from "./hook-config.ts";

/**
 * Checkpoint structure - captures file state at a point in time
 */
export interface Checkpoint {
	created_at: string; // ISO 8601 timestamp
	type: "session" | "agent";
	patterns: string[]; // Glob patterns used to capture files
	files: Record<string, string>; // path -> sha256 hash
}

/**
 * Get the checkpoint directory for the current project
 * Returns: ~/.claude/projects/{slug}/han/checkpoints/
 */
export function getCheckpointDir(): string {
	const cacheDir = getCacheDir();
	return join(cacheDir, "checkpoints");
}

/**
 * Get the path for a specific checkpoint file
 * @param type - Type of checkpoint (session or agent)
 * @param id - Unique identifier for this checkpoint
 * @returns Full path to checkpoint file
 */
export function getCheckpointPath(
	type: "session" | "agent",
	id: string,
): string {
	const checkpointDir = getCheckpointDir();
	// Sanitize ID for filename (replace / with _)
	const sanitizedId = id.replace(/\//g, "_");
	return join(checkpointDir, `${type}_${sanitizedId}.json`);
}

/**
 * Capture a checkpoint of current file state
 * @param type - Type of checkpoint (session or agent)
 * @param id - Unique identifier for this checkpoint
 * @param patterns - Glob patterns to match files
 * @returns true if successful, false otherwise
 */
export function captureCheckpoint(
	type: "session" | "agent",
	id: string,
	patterns: string[],
): boolean {
	try {
		const projectRoot = getProjectRoot();
		const checkpointPath = getCheckpointPath(type, id);

		// Ensure checkpoint directory exists
		const checkpointDir = dirname(checkpointPath);
		if (!existsSync(checkpointDir)) {
			mkdirSync(checkpointDir, { recursive: true });
		}

		// Find files matching patterns
		const files = findFilesWithGlob(projectRoot, patterns);

		// Build manifest of file hashes
		const manifest: CacheManifest = buildManifest(files, projectRoot);

		// Create checkpoint
		const checkpoint: Checkpoint = {
			created_at: new Date().toISOString(),
			type,
			patterns,
			files: manifest,
		};

		// Save to disk
		writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
		return true;
	} catch {
		return false;
	}
}

/**
 * Load a checkpoint from disk
 * @param type - Type of checkpoint (session or agent)
 * @param id - Unique identifier for the checkpoint
 * @returns Checkpoint data or null if not found/invalid
 */
export function loadCheckpoint(
	type: "session" | "agent",
	id: string,
): Checkpoint | null {
	try {
		const checkpointPath = getCheckpointPath(type, id);
		if (!existsSync(checkpointPath)) {
			return null;
		}

		const content = readFileSync(checkpointPath, "utf-8");
		const checkpoint = JSON.parse(content) as Checkpoint;

		// Validate structure
		if (
			!checkpoint.created_at ||
			!checkpoint.type ||
			!checkpoint.patterns ||
			!checkpoint.files
		) {
			return null;
		}

		return checkpoint;
	} catch {
		return null;
	}
}

/**
 * Check if any files have changed since the checkpoint was created
 * @param checkpoint - The checkpoint to compare against
 * @param directory - Directory to check for changes
 * @param patterns - Glob patterns to match files
 * @returns true if changes detected, false if no changes
 */
export function hasChangedSinceCheckpoint(
	checkpoint: Checkpoint,
	directory: string,
	patterns: string[],
): boolean {
	try {
		const projectRoot = getProjectRoot();

		// Find current files matching patterns
		const currentFiles = findFilesWithGlob(directory, patterns);

		// Build current manifest (paths relative to directory)
		const currentManifest = buildManifest(currentFiles, directory);

		// Calculate relative path from project root to directory
		// If directory=/project/packages/core and projectRoot=/project
		// then relativePath=packages/core
		const relativePath = relative(projectRoot, directory);

		// Filter checkpoint files to only those within directory
		// and convert paths for comparison
		const checkpointFilesInDir: Record<string, string> = {};
		const prefix = relativePath ? `${relativePath}/` : "";

		for (const [path, hash] of Object.entries(checkpoint.files)) {
			if (relativePath === "" || path.startsWith(prefix)) {
				// Strip the prefix to get path relative to directory
				const pathInDir =
					relativePath === "" ? path : path.slice(prefix.length);
				checkpointFilesInDir[pathInDir] = hash;
			}
		}

		// Compare file counts first (quick check)
		const checkpointFileCount = Object.keys(checkpointFilesInDir).length;
		const currentFileCount = Object.keys(currentManifest).length;
		if (checkpointFileCount !== currentFileCount) {
			return true;
		}

		// Check if any files in checkpoint are missing or changed
		for (const [path, hash] of Object.entries(checkpointFilesInDir)) {
			if (currentManifest[path] !== hash) {
				return true;
			}
		}

		// Check if any new files exist that weren't in checkpoint
		for (const path of Object.keys(currentManifest)) {
			if (!(path in checkpointFilesInDir)) {
				return true;
			}
		}

		return false;
	} catch {
		// On error, assume changes to be safe
		return true;
	}
}

/**
 * Remove checkpoints older than maxAge
 * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
 * @returns Number of checkpoints removed
 */
export function cleanupOldCheckpoints(maxAgeMs = 86400000): number {
	try {
		const checkpointDir = getCheckpointDir();

		// If directory doesn't exist, nothing to clean
		if (!existsSync(checkpointDir)) {
			return 0;
		}

		const now = Date.now();
		let removed = 0;

		// Read all files in checkpoint directory
		const files = readdirSync(checkpointDir);

		for (const file of files) {
			// Only process checkpoint files
			if (!file.endsWith(".json")) {
				continue;
			}

			const filePath = join(checkpointDir, file);

			try {
				// Check file age
				const stats = statSync(filePath);
				const age = now - stats.mtimeMs;

				if (age > maxAgeMs) {
					unlinkSync(filePath);
					removed++;
				}
			} catch {}
		}

		return removed;
	} catch {
		return 0;
	}
}

/**
 * Find plugin in a marketplace root directory
 */
function findPluginInMarketplace(
	marketplaceRoot: string,
	pluginName: string,
): string | null {
	const potentialPaths = [
		join(marketplaceRoot, "jutsu", pluginName),
		join(marketplaceRoot, "do", pluginName),
		join(marketplaceRoot, "hashi", pluginName),
		join(marketplaceRoot, pluginName),
	];

	for (const path of potentialPaths) {
		if (existsSync(path)) {
			return path;
		}
	}

	return null;
}

/**
 * Resolve a path to absolute, relative to cwd
 */
function resolveToAbsolute(path: string): string {
	if (path.startsWith("/")) {
		return path;
	}
	return join(process.cwd(), path);
}

/**
 * Get plugin directory based on plugin name, marketplace, and marketplace config
 */
function getPluginDir(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): string | null {
	// If marketplace config specifies a directory source, use that path
	if (marketplaceConfig?.source?.source === "directory") {
		const directoryPath = marketplaceConfig.source.path;
		if (directoryPath) {
			const absolutePath = resolveToAbsolute(directoryPath);
			const found = findPluginInMarketplace(absolutePath, pluginName);
			if (found) {
				return found;
			}
		}
	}

	// Check if we're in the marketplace repo itself (for development)
	const cwd = process.cwd();
	if (existsSync(join(cwd, ".claude-plugin", "marketplace.json"))) {
		const found = findPluginInMarketplace(cwd, pluginName);
		if (found) {
			return found;
		}
	}

	// Fall back to the default shared config path
	const configDir = getClaudeConfigDir();
	if (!configDir) {
		return null;
	}

	const marketplaceRoot = join(
		configDir,
		"plugins",
		"marketplaces",
		marketplace,
	);

	if (!existsSync(marketplaceRoot)) {
		return null;
	}

	return findPluginInMarketplace(marketplaceRoot, pluginName);
}

/**
 * Collect all ifChanged patterns from enabled plugins
 * @returns Array of deduplicated glob patterns
 */
export function collectIfChangedPatterns(): string[] {
	const patterns = new Set<string>();

	try {
		// Get all enabled plugins
		const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

		// Iterate through each plugin
		for (const [pluginName, marketplace] of plugins.entries()) {
			const marketplaceConfig = marketplaces.get(marketplace);
			const pluginRoot = getPluginDir(
				pluginName,
				marketplace,
				marketplaceConfig,
			);

			if (!pluginRoot) {
				continue;
			}

			// Load plugin config
			const pluginConfig = loadPluginConfig(pluginRoot, false); // Skip validation for speed

			if (!pluginConfig?.hooks) {
				continue;
			}

			// Collect ifChanged patterns from all hooks in this plugin
			for (const hookDef of Object.values(pluginConfig.hooks)) {
				if (hookDef.ifChanged) {
					for (const pattern of hookDef.ifChanged) {
						patterns.add(pattern);
					}
				}
			}
		}
	} catch {
		// On error, return empty array - non-blocking
	}

	return Array.from(patterns);
}
