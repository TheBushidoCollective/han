import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	type MarketplaceConfig,
} from "../config/claude-settings.ts";
// NOTE: Database-backed checkpoints removed - async functions now return defaults
import {
	buildManifest,
	type CacheManifest,
	computeFileHash,
	findFilesWithGlob,
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
 * Derive a filesystem-safe project slug from a directory path
 * @param projectPath - Absolute path to the project directory
 * @returns A normalized slug suitable for use in filesystem paths
 *
 * @example
 * getProjectSlug("/Users/john/projects/my-app") // "Users-john-projects-my-app"
 * getProjectSlug("/home/dev/work/api-service") // "home-dev-work-api-service"
 */
export function getProjectSlug(projectPath?: string): string {
	const path = projectPath || getProjectRoot();
	// Remove leading slash and replace remaining slashes with dashes
	return path.replace(/^\//, "").replace(/\//g, "-");
}

/**
 * Get the base projects directory
 * Returns: $CLAUDE_CONFIG_DIR/projects/ or ~/.claude/projects/
 */
export function getProjectsBaseDir(): string {
	const configDir = getClaudeConfigDir();
	return join(configDir, "projects");
}

/**
 * Get the checkpoint directory for the current project
 * Returns: ~/.claude/projects/{project-slug}/
 */
export function getCheckpointDir(): string {
	const projectSlug = getProjectSlug();
	return join(getProjectsBaseDir(), projectSlug);
}

/**
 * Get the path for a specific checkpoint file
 * @param type - Type of checkpoint (session or agent)
 * @param id - Unique identifier for this checkpoint
 * @returns Full path to checkpoint file
 *
 * For sessions: ~/.claude/projects/{project-slug}/{session-id}/checkpoint.json
 * For agents: ~/.claude/projects/{project-slug}/agent-{agent-id}/checkpoint.json
 */
export function getCheckpointPath(
	type: "session" | "agent",
	id: string,
): string {
	const checkpointDir = getCheckpointDir();
	// Sanitize ID for directory name (replace / with _)
	const sanitizedId = id.replace(/\//g, "_");
	// Use folder-based structure: session-id/ or agent-{id}/
	const folderName = type === "agent" ? `agent-${sanitizedId}` : sanitizedId;
	return join(checkpointDir, folderName, "checkpoint.json");
}

/**
 * Capture a checkpoint of current file state
 * @deprecated Use captureCheckpointAsync for database-backed storage
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
 * @deprecated Use getCheckpointAsync for database-backed storage
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
 * @deprecated Use hasChangedSinceCheckpointAsync for database-backed storage
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
 * Checkpoint metadata for listing
 */
export interface CheckpointInfo {
	type: "session" | "agent";
	id: string;
	path: string;
	createdAt: string;
	fileCount: number;
}

// ============================================================================
// Blob Storage (content-addressable file storage)
// ============================================================================

/**
 * Get the blob storage directory
 * Located at ~/.claude/han/blobs/
 */
export function getBlobDir(): string {
	return join(homedir(), ".claude", "han", "blobs");
}

/**
 * Get the path for a blob by its hash
 * Uses first 2 chars as subdirectory for better filesystem performance
 */
export function getBlobPath(hash: string): string {
	const prefix = hash.slice(0, 2);
	return join(getBlobDir(), prefix, hash);
}

/**
 * Store file content as a blob (content-addressable)
 * Returns the blob path if successful, null otherwise
 */
export function storeBlob(
	filePath: string,
): { hash: string; blobPath: string } | null {
	try {
		const hash = computeFileHash(filePath);
		const blobPath = getBlobPath(hash);

		// Skip if blob already exists (deduplication)
		if (existsSync(blobPath)) {
			return { hash, blobPath };
		}

		// Ensure blob directory exists
		const blobDir = dirname(blobPath);
		if (!existsSync(blobDir)) {
			mkdirSync(blobDir, { recursive: true });
		}

		// Copy file content to blob
		const content = readFileSync(filePath);
		writeFileSync(blobPath, content);

		return { hash, blobPath };
	} catch {
		return null;
	}
}

/**
 * Read blob content by hash
 * Returns the file content as a Buffer, or null if not found
 */
export function readBlob(hash: string): Buffer | null {
	try {
		const blobPath = getBlobPath(hash);
		if (!existsSync(blobPath)) {
			return null;
		}
		return readFileSync(blobPath);
	} catch {
		return null;
	}
}

// ============================================================================
// Database-backed Checkpoint Functions (DEPRECATED - database removed)
// These functions now return safe defaults instead of using SQLite
// ============================================================================

/**
 * Stub checkpoint record type for compatibility
 * @deprecated Database-backed checkpoints have been removed
 */
interface StubCheckpoint {
	id: string;
	sessionId: string;
	projectPath: string;
	filePath: string;
	fileHash: string;
	blobPath: string;
	createdAt: string;
}

/**
 * Capture a checkpoint of current file state (async, database-backed)
 * @deprecated Database-backed checkpoints removed - returns empty array
 */
export async function captureCheckpointAsync(
	_sessionId: string,
	_patterns: string[],
): Promise<StubCheckpoint[]> {
	// Database-backed checkpoints removed - no-op
	return [];
}

/**
 * Get a checkpoint for a specific file (async, database-backed)
 * @deprecated Database-backed checkpoints removed - returns null
 */
export async function getCheckpointAsync(
	_sessionId: string,
	_filePath: string,
): Promise<StubCheckpoint | null> {
	// Database-backed checkpoints removed - always return null
	return null;
}

/**
 * List all checkpoints for a session (async, database-backed)
 * @deprecated Database-backed checkpoints removed - returns empty array
 */
export async function listCheckpointsAsync(
	_sessionId: string,
): Promise<StubCheckpoint[]> {
	// Database-backed checkpoints removed - always return empty
	return [];
}

/**
 * Restore a file from checkpoint (async, database-backed)
 * @deprecated Database-backed checkpoints removed - returns false
 */
export async function restoreFromCheckpointAsync(
	_sessionId: string,
	_filePath: string,
): Promise<boolean> {
	// Database-backed checkpoints removed - cannot restore
	return false;
}

/**
 * Check if files have changed since checkpoint (async, database-backed)
 * @deprecated Database-backed checkpoints removed - always returns true
 * This means hooks will always run (safe fallback)
 */
export async function hasChangedSinceCheckpointAsync(
	_sessionId: string,
	_patterns: string[],
	_directory?: string,
): Promise<boolean> {
	// Database-backed checkpoints removed - treat as always changed
	// This ensures hooks run when they should (safe fallback)
	return true;
}

// ============================================================================
// Legacy Filesystem-based Functions (Sync, Deprecated)
// ============================================================================

/**
 * List all checkpoints for the current project
 * @deprecated Use listCheckpointsAsync for database-backed storage
 * @returns Array of checkpoint info objects
 */
export function listCheckpoints(): CheckpointInfo[] {
	try {
		const checkpointDir = getCheckpointDir();

		if (!existsSync(checkpointDir)) {
			return [];
		}

		const checkpoints: CheckpointInfo[] = [];
		const entries = readdirSync(checkpointDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) {
				continue;
			}

			const checkpointPath = join(checkpointDir, entry.name, "checkpoint.json");
			if (!existsSync(checkpointPath)) {
				continue;
			}

			try {
				const content = readFileSync(checkpointPath, "utf-8");
				const checkpoint = JSON.parse(content) as Checkpoint;

				// Determine type and id from folder name
				const isAgent = entry.name.startsWith("agent-");
				const type: "session" | "agent" = isAgent ? "agent" : "session";
				const id = isAgent ? entry.name.slice(6) : entry.name;

				checkpoints.push({
					type,
					id,
					path: checkpointPath,
					createdAt: checkpoint.created_at,
					fileCount: Object.keys(checkpoint.files).length,
				});
			} catch {
				// Skip invalid checkpoints
			}
		}

		// Sort by creation time, newest first
		checkpoints.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		return checkpoints;
	} catch {
		return [];
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

		// Read all subdirectories in checkpoint directory
		const entries = readdirSync(checkpointDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) {
				continue;
			}

			const sessionDir = join(checkpointDir, entry.name);
			const checkpointPath = join(sessionDir, "checkpoint.json");

			if (!existsSync(checkpointPath)) {
				continue;
			}

			try {
				// Check checkpoint file age
				const stats = statSync(checkpointPath);
				const age = now - stats.mtimeMs;

				if (age > maxAgeMs) {
					// Remove the entire session/agent directory
					rmSync(sessionDir, { recursive: true, force: true });
					removed++;
				}
			} catch {
				// Skip on error
			}
		}

		return removed;
	} catch {
		return 0;
	}
}

/**
 * Clean up orphaned blobs that are not referenced by any checkpoint
 * @returns Number of blobs removed
 */
export async function cleanupOrphanedBlobs(): Promise<number> {
	try {
		const blobDir = getBlobDir();
		if (!existsSync(blobDir)) {
			return 0;
		}

		// Get all referenced hashes from database
		// Note: This would require a new DB query to get all checkpoint hashes
		// For now, we'll implement a simple approach that walks the blob dirs
		// and checks each against the database

		const removed = 0;
		const prefixDirs = readdirSync(blobDir, { withFileTypes: true });

		for (const prefixDir of prefixDirs) {
			if (!prefixDir.isDirectory()) {
				continue;
			}

			const prefixPath = join(blobDir, prefixDir.name);
			const blobs = readdirSync(prefixPath, { withFileTypes: true });

			for (const blob of blobs) {
				if (!blob.isFile()) {
				}

				// Check if blob is referenced by any checkpoint
				// This is a placeholder - would need getAllCheckpointHashes() from DB
				// For now, we skip orphan cleanup until we have that query
				// const isReferenced = await isHashReferenced(blob.name);
				// if (!isReferenced) {
				//   rmSync(join(prefixPath, blob.name));
				//   removed++;
				// }
			}

			// Remove empty prefix directories
			try {
				const remaining = readdirSync(prefixPath);
				if (remaining.length === 0) {
					rmSync(prefixPath, { recursive: true });
				}
			} catch {
				// Skip on error
			}
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
