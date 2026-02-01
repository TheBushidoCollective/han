/**
 * Share Learning with Team
 *
 * Provides functionality for users to explicitly share their personal learnings
 * with the team/organization. This is an opt-in mechanism - learnings are not
 * automatically shared.
 *
 * Flow:
 * 1. User has a personal learning (from their sessions)
 * 2. User explicitly shares it with the team
 * 3. Learning is copied to org-scoped storage with attribution
 * 4. Other team members can access the shared learning
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { UserPermissionContext } from "./permission-filter.ts";
import { enforceRateLimit } from "./rate-limiter.ts";
import { invalidateOrgLearnings } from "./team-memory-cache.ts";

/**
 * Shared learning record stored in org-scoped storage
 */
export interface SharedLearning {
	/** Unique ID for the shared learning */
	id: string;
	/** Original learning content */
	content: string;
	/** Domain/category of the learning */
	domain: string;
	/** User who shared it */
	sharedBy: string;
	/** User's email for attribution */
	sharedByEmail?: string;
	/** When it was shared */
	sharedAt: number;
	/** Original source (session ID, message ID, etc.) */
	source?: string;
	/** Optional tags for categorization */
	tags?: string[];
	/** Sharing status */
	status: "pending" | "approved" | "rejected";
	/** Optional moderation notes */
	moderationNotes?: string;
}

/**
 * Result of sharing a learning
 */
export interface ShareLearningResult {
	success: boolean;
	learningId?: string;
	message: string;
}

/**
 * Get the path to the shared learnings storage for an org
 */
function getSharedLearningsPath(orgId: string): string {
	const basePath = join(homedir(), ".claude", "han", "shared-learnings");
	return join(basePath, `${orgId}.json`);
}

/**
 * Load shared learnings for an org
 */
export function loadSharedLearnings(orgId: string): SharedLearning[] {
	const path = getSharedLearningsPath(orgId);
	if (!existsSync(path)) {
		return [];
	}
	try {
		const content = readFileSync(path, "utf-8");
		return JSON.parse(content) as SharedLearning[];
	} catch {
		return [];
	}
}

/**
 * Save shared learnings for an org
 */
function saveSharedLearnings(orgId: string, learnings: SharedLearning[]): void {
	const path = getSharedLearningsPath(orgId);
	const dir = join(homedir(), ".claude", "han", "shared-learnings");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(path, JSON.stringify(learnings, null, 2));
}

/**
 * Generate a unique ID for a shared learning
 */
function generateLearningId(): string {
	return `learn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Share a learning with the team
 *
 * This is the main entry point for users to share their personal learnings
 * with the organization.
 */
export async function shareLearningWithTeam(params: {
	/** The learning content to share */
	content: string;
	/** Domain/category for the learning */
	domain: string;
	/** User context (for permissions and attribution) */
	context: UserPermissionContext;
	/** Original source reference (optional) */
	source?: string;
	/** Tags for categorization (optional) */
	tags?: string[];
	/** Whether to require admin approval (default: depends on org settings) */
	requireApproval?: boolean;
}): Promise<ShareLearningResult> {
	const { content, domain, context, source, tags, requireApproval = true } = params;

	// Validate context
	if (!context.orgId) {
		return {
			success: false,
			message: "Organization context required to share with team",
		};
	}

	if (!content || content.trim().length === 0) {
		return {
			success: false,
			message: "Learning content cannot be empty",
		};
	}

	if (!domain || domain.trim().length === 0) {
		return {
			success: false,
			message: "Domain is required for categorization",
		};
	}

	// Rate limit check
	try {
		enforceRateLimit(context.userId, "share");
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : "Rate limit exceeded",
		};
	}

	// Create the shared learning record
	const learningId = generateLearningId();
	const learning: SharedLearning = {
		id: learningId,
		content: content.trim(),
		domain: domain.trim(),
		sharedBy: context.userId,
		sharedByEmail: context.email,
		sharedAt: Date.now(),
		source,
		tags,
		status: requireApproval ? "pending" : "approved",
	};

	// Load existing learnings and add the new one
	const learnings = loadSharedLearnings(context.orgId);
	learnings.push(learning);
	saveSharedLearnings(context.orgId, learnings);

	// Invalidate org learnings cache
	invalidateOrgLearnings(context.orgId);

	return {
		success: true,
		learningId,
		message: requireApproval
			? "Learning submitted for team review"
			: "Learning shared with team",
	};
}

/**
 * Get shared learnings for a user's organization
 */
export function getSharedLearnings(
	context: UserPermissionContext,
	options?: {
		status?: "pending" | "approved" | "rejected" | "all";
		domain?: string;
		limit?: number;
	},
): SharedLearning[] {
	if (!context.orgId) {
		return [];
	}

	let learnings = loadSharedLearnings(context.orgId);

	// Filter by status
	const status = options?.status ?? "approved";
	if (status !== "all") {
		learnings = learnings.filter((l) => l.status === status);
	}

	// Filter by domain
	if (options?.domain) {
		learnings = learnings.filter((l) => l.domain === options.domain);
	}

	// Sort by most recent first
	learnings.sort((a, b) => b.sharedAt - a.sharedAt);

	// Apply limit
	if (options?.limit && options.limit > 0) {
		learnings = learnings.slice(0, options.limit);
	}

	return learnings;
}

/**
 * Get a specific shared learning by ID
 */
export function getSharedLearningById(
	context: UserPermissionContext,
	learningId: string,
): SharedLearning | null {
	if (!context.orgId) {
		return null;
	}

	const learnings = loadSharedLearnings(context.orgId);
	return learnings.find((l) => l.id === learningId) ?? null;
}

/**
 * Get domains with shared learnings count
 */
export function getSharedLearningDomains(
	context: UserPermissionContext,
): Array<{ domain: string; count: number }> {
	if (!context.orgId) {
		return [];
	}

	const learnings = loadSharedLearnings(context.orgId).filter(
		(l) => l.status === "approved",
	);

	const domains = new Map<string, number>();
	for (const learning of learnings) {
		domains.set(learning.domain, (domains.get(learning.domain) ?? 0) + 1);
	}

	return Array.from(domains.entries())
		.map(([domain, count]) => ({ domain, count }))
		.sort((a, b) => b.count - a.count);
}
