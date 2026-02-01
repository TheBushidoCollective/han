/**
 * Export/Import Team Knowledge Base
 *
 * Provides functionality to export team learnings to a portable JSON format
 * and import them from external sources. Useful for:
 * - Backup and restore
 * - Migration between organizations
 * - Sharing knowledge bases between teams
 * - Seeding new organizations with existing knowledge
 */

import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import type { UserPermissionContext } from "./permission-filter.ts";
import { enforceRateLimit } from "./rate-limiter.ts";
import { invalidateOrgLearnings } from "./team-memory-cache.ts";
import {
	loadSharedLearnings,
	type SharedLearning,
} from "./share-learning.ts";
import { getCachedOrgLearnings, type OrgLearningsCacheEntry } from "./team-memory-cache.ts";

/**
 * Export format version for compatibility tracking
 */
const EXPORT_FORMAT_VERSION = "1.0.0";

/**
 * Exported team knowledge structure
 */
export interface TeamKnowledgeExport {
	/** Format version for compatibility */
	version: string;
	/** Export metadata */
	metadata: {
		exportedAt: number;
		exportedBy: string;
		exportedByEmail?: string;
		orgId: string;
		orgName?: string;
		description?: string;
	};
	/** Shared learnings */
	learnings: SharedLearning[];
	/** Aggregated patterns (if available) */
	patterns?: OrgLearningsCacheEntry;
	/** Statistics about the export */
	stats: {
		totalLearnings: number;
		byDomain: Record<string, number>;
		byStatus: Record<string, number>;
	};
}

/**
 * Import result
 */
export interface ImportResult {
	success: boolean;
	message: string;
	stats?: {
		imported: number;
		skipped: number;
		errors: number;
	};
}

/**
 * Export result
 */
export interface ExportResult {
	success: boolean;
	message: string;
	data?: TeamKnowledgeExport;
	filePath?: string;
}

/**
 * Export options
 */
export interface ExportOptions {
	/** Include only approved learnings (default: true) */
	approvedOnly?: boolean;
	/** Filter by domains */
	domains?: string[];
	/** Include aggregated patterns */
	includePatterns?: boolean;
	/** Optional file path to save export */
	filePath?: string;
	/** Optional description for the export */
	description?: string;
}

/**
 * Import options
 */
export interface ImportOptions {
	/** How to handle duplicate content */
	duplicateStrategy?: "skip" | "replace" | "create_new";
	/** Whether to auto-approve imported learnings */
	autoApprove?: boolean;
	/** Filter to specific domains */
	domains?: string[];
	/** Dry run - don't actually import */
	dryRun?: boolean;
}

/**
 * Calculate statistics for learnings
 */
function calculateStats(learnings: SharedLearning[]): TeamKnowledgeExport["stats"] {
	const byDomain: Record<string, number> = {};
	const byStatus: Record<string, number> = {};

	for (const learning of learnings) {
		byDomain[learning.domain] = (byDomain[learning.domain] ?? 0) + 1;
		byStatus[learning.status] = (byStatus[learning.status] ?? 0) + 1;
	}

	return {
		totalLearnings: learnings.length,
		byDomain,
		byStatus,
	};
}

/**
 * Export team knowledge to a portable format
 *
 * Exports all shared learnings and optionally aggregated patterns
 * to a JSON format that can be imported elsewhere.
 */
export async function exportTeamKnowledge(
	context: UserPermissionContext,
	options: ExportOptions = {},
): Promise<ExportResult> {
	const {
		approvedOnly = true,
		domains,
		includePatterns = true,
		filePath,
		description,
	} = options;

	// Validate context
	if (!context.orgId) {
		return {
			success: false,
			message: "Organization context required for export",
		};
	}

	// Rate limit check
	try {
		enforceRateLimit(context.userId, "export");
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : "Rate limit exceeded",
		};
	}

	// Load learnings
	let learnings = loadSharedLearnings(context.orgId);

	// Filter by status if requested
	if (approvedOnly) {
		learnings = learnings.filter((l) => l.status === "approved");
	}

	// Filter by domains if specified
	if (domains && domains.length > 0) {
		const domainSet = new Set(domains);
		learnings = learnings.filter((l) => domainSet.has(l.domain));
	}

	// Get patterns if requested
	let patterns: OrgLearningsCacheEntry | undefined;
	if (includePatterns) {
		patterns = getCachedOrgLearnings(context.orgId) ?? undefined;
	}

	// Build export
	const exportData: TeamKnowledgeExport = {
		version: EXPORT_FORMAT_VERSION,
		metadata: {
			exportedAt: Date.now(),
			exportedBy: context.userId,
			exportedByEmail: context.email,
			orgId: context.orgId,
			description,
		},
		learnings,
		patterns,
		stats: calculateStats(learnings),
	};

	// Save to file if path provided
	if (filePath) {
		try {
			const dir = dirname(filePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			writeFileSync(filePath, JSON.stringify(exportData, null, 2));
			return {
				success: true,
				message: `Exported ${learnings.length} learnings to ${filePath}`,
				data: exportData,
				filePath,
			};
		} catch (error) {
			return {
				success: false,
				message: `Failed to write export file: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	return {
		success: true,
		message: `Exported ${learnings.length} learnings`,
		data: exportData,
	};
}

/**
 * Get the path to shared learnings storage
 */
function getSharedLearningsPath(orgId: string): string {
	return join(homedir(), ".claude", "han", "shared-learnings", `${orgId}.json`);
}

/**
 * Save shared learnings to storage
 */
function saveSharedLearnings(orgId: string, learnings: SharedLearning[]): void {
	const path = getSharedLearningsPath(orgId);
	const dir = dirname(path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(path, JSON.stringify(learnings, null, 2));
}

/**
 * Check if two learnings are duplicates
 */
function isDuplicate(a: SharedLearning, b: SharedLearning): boolean {
	// Consider duplicate if same domain and very similar content
	if (a.domain !== b.domain) return false;

	// Simple content similarity check (exact match or high overlap)
	const contentA = a.content.toLowerCase().trim();
	const contentB = b.content.toLowerCase().trim();

	if (contentA === contentB) return true;

	// Check if one is a substring of the other (>80% overlap)
	if (contentA.includes(contentB) || contentB.includes(contentA)) {
		const shorter = Math.min(contentA.length, contentB.length);
		const longer = Math.max(contentA.length, contentB.length);
		if (shorter / longer > 0.8) return true;
	}

	return false;
}

/**
 * Import team knowledge from a portable format
 *
 * Imports learnings from an export file or data structure.
 * Supports various strategies for handling duplicates.
 */
export async function importTeamKnowledge(
	context: UserPermissionContext,
	source: string | TeamKnowledgeExport,
	options: ImportOptions = {},
): Promise<ImportResult> {
	const {
		duplicateStrategy = "skip",
		autoApprove = false,
		domains,
		dryRun = false,
	} = options;

	// Validate context
	if (!context.orgId) {
		return {
			success: false,
			message: "Organization context required for import",
		};
	}

	// Rate limit check
	try {
		enforceRateLimit(context.userId, "import");
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : "Rate limit exceeded",
		};
	}

	// Load import data
	let importData: TeamKnowledgeExport;

	if (typeof source === "string") {
		// Load from file
		try {
			if (!existsSync(source)) {
				return {
					success: false,
					message: `Import file not found: ${source}`,
				};
			}
			const content = readFileSync(source, "utf-8");
			importData = JSON.parse(content) as TeamKnowledgeExport;
		} catch (error) {
			return {
				success: false,
				message: `Failed to read import file: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	} else {
		importData = source;
	}

	// Validate import data
	if (!importData.version || !importData.learnings) {
		return {
			success: false,
			message: "Invalid import format: missing required fields",
		};
	}

	// Check version compatibility
	const [majorVersion] = importData.version.split(".");
	const [currentMajor] = EXPORT_FORMAT_VERSION.split(".");
	if (majorVersion !== currentMajor) {
		return {
			success: false,
			message: `Incompatible format version: ${importData.version} (expected ${EXPORT_FORMAT_VERSION})`,
		};
	}

	// Load existing learnings
	const existingLearnings = loadSharedLearnings(context.orgId);

	// Filter and process import learnings
	let learningsToImport = importData.learnings;

	// Filter by domains if specified
	if (domains && domains.length > 0) {
		const domainSet = new Set(domains);
		learningsToImport = learningsToImport.filter((l) => domainSet.has(l.domain));
	}

	// Process each learning
	let imported = 0;
	let skipped = 0;
	let errors = 0;
	const newLearnings: SharedLearning[] = [];

	for (const learning of learningsToImport) {
		try {
			// Check for duplicates
			const existingDuplicate = existingLearnings.find((e) =>
				isDuplicate(e, learning),
			);

			if (existingDuplicate) {
				if (duplicateStrategy === "skip") {
					skipped++;
					continue;
				} else if (duplicateStrategy === "replace") {
					// Remove the existing duplicate
					const idx = existingLearnings.indexOf(existingDuplicate);
					if (idx !== -1) {
						existingLearnings.splice(idx, 1);
					}
				}
				// For "create_new", we just add it as a new entry
			}

			// Create new learning with updated metadata
			const newLearning: SharedLearning = {
				...learning,
				id: `learn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				sharedAt: Date.now(),
				status: autoApprove ? "approved" : "pending",
				moderationNotes: `Imported from ${importData.metadata.orgId} on ${new Date().toISOString()}`,
			};

			newLearnings.push(newLearning);
			imported++;
		} catch {
			errors++;
		}
	}

	// Save if not dry run
	if (!dryRun && newLearnings.length > 0) {
		const allLearnings = [...existingLearnings, ...newLearnings];
		saveSharedLearnings(context.orgId, allLearnings);

		// Invalidate cache
		invalidateOrgLearnings(context.orgId);
	}

	return {
		success: true,
		message: dryRun
			? `Dry run: would import ${imported}, skip ${skipped}, errors ${errors}`
			: `Imported ${imported} learnings, skipped ${skipped}, errors ${errors}`,
		stats: {
			imported,
			skipped,
			errors,
		},
	};
}

/**
 * Validate an export file without importing
 */
export function validateExportFile(
	filePath: string,
): {
	valid: boolean;
	message: string;
	stats?: TeamKnowledgeExport["stats"];
} {
	try {
		if (!existsSync(filePath)) {
			return {
				valid: false,
				message: `File not found: ${filePath}`,
			};
		}

		const content = readFileSync(filePath, "utf-8");
		const data = JSON.parse(content) as TeamKnowledgeExport;

		// Check required fields
		if (!data.version) {
			return {
				valid: false,
				message: "Missing version field",
			};
		}

		if (!data.metadata) {
			return {
				valid: false,
				message: "Missing metadata field",
			};
		}

		if (!Array.isArray(data.learnings)) {
			return {
				valid: false,
				message: "Learnings must be an array",
			};
		}

		// Check version compatibility
		const [majorVersion] = data.version.split(".");
		const [currentMajor] = EXPORT_FORMAT_VERSION.split(".");
		if (majorVersion !== currentMajor) {
			return {
				valid: false,
				message: `Incompatible version: ${data.version} (expected ${EXPORT_FORMAT_VERSION})`,
			};
		}

		return {
			valid: true,
			message: `Valid export file with ${data.learnings.length} learnings`,
			stats: data.stats,
		};
	} catch (error) {
		return {
			valid: false,
			message: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}
