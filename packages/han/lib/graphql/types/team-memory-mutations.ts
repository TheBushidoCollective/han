/**
 * GraphQL Mutations for Team Memory
 *
 * Provides mutations for:
 * - Sharing learnings with team
 * - Export/import team knowledge
 * - Admin moderation controls
 */

import { builder } from "../builder.ts";
import {
	shareLearningWithTeam,
	type ShareLearningResult,
	type SharedLearning,
} from "../../memory/share-learning.ts";
import {
	exportTeamKnowledge,
	importTeamKnowledge,
	type TeamKnowledgeExport,
} from "../../memory/export-import.ts";
import {
	approveLearning,
	rejectLearning,
	removeSharedLearning,
	reviewPendingLearnings,
	updateOrgSharingPolicy,
	type ModerationResult,
	type OrgSharingPolicy,
} from "../../memory/admin-controls.ts";
import type { UserPermissionContext } from "../../memory/permission-filter.ts";

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input for sharing a learning with the team
 */
export const ShareLearningInput = builder.inputType("ShareLearningInput", {
	fields: (t) => ({
		content: t.string({ required: true, description: "Learning content to share" }),
		domain: t.string({ required: true, description: "Domain/category for the learning" }),
		source: t.string({ required: false, description: "Original source reference" }),
		tags: t.stringList({ required: false, description: "Tags for categorization" }),
		requireApproval: t.boolean({ required: false, description: "Require admin approval" }),
	}),
});

/**
 * Input for user context (passed to team memory operations)
 */
export const TeamUserContextInput = builder.inputType("TeamUserContextInput", {
	fields: (t) => ({
		userId: t.string({ required: true, description: "User ID" }),
		orgId: t.string({ required: false, description: "Organization ID" }),
		email: t.string({ required: false, description: "User email" }),
		isAdmin: t.boolean({ required: false, description: "Whether user is an admin" }),
	}),
});

/**
 * Input for export options
 */
export const ExportOptionsInput = builder.inputType("ExportOptionsInput", {
	fields: (t) => ({
		approvedOnly: t.boolean({ required: false, description: "Only export approved learnings" }),
		domains: t.stringList({ required: false, description: "Filter by domains" }),
		includePatterns: t.boolean({ required: false, description: "Include aggregated patterns" }),
		description: t.string({ required: false, description: "Description for the export" }),
	}),
});

/**
 * Input for import options
 */
export const ImportOptionsInput = builder.inputType("ImportOptionsInput", {
	fields: (t) => ({
		duplicateStrategy: t.string({ required: false, description: "How to handle duplicates: skip, replace, create_new" }),
		autoApprove: t.boolean({ required: false, description: "Auto-approve imported learnings" }),
		domains: t.stringList({ required: false, description: "Filter to specific domains" }),
		dryRun: t.boolean({ required: false, description: "Dry run without importing" }),
	}),
});

/**
 * Input for updating sharing policy
 */
export const SharingPolicyInput = builder.inputType("SharingPolicyInput", {
	fields: (t) => ({
		requireApproval: t.boolean({ required: false }),
		allowedDomains: t.stringList({ required: false }),
		blockedDomains: t.stringList({ required: false }),
		maxLearningsPerDay: t.int({ required: false }),
		allowAnonymous: t.boolean({ required: false }),
		minContentLength: t.int({ required: false }),
		maxContentLength: t.int({ required: false }),
	}),
});

// =============================================================================
// Result Types
// =============================================================================

/**
 * Result of sharing a learning
 */
const ShareLearningResultRef = builder.objectRef<ShareLearningResult>("ShareLearningResult");
export const ShareLearningResultType = ShareLearningResultRef.implement({
	description: "Result of sharing a learning with the team",
	fields: (t) => ({
		success: t.exposeBoolean("success"),
		learningId: t.string({
			nullable: true,
			resolve: (r) => r.learningId ?? null,
		}),
		message: t.exposeString("message"),
	}),
});

/**
 * Shared learning type for GraphQL
 */
const SharedLearningRef = builder.objectRef<SharedLearning>("SharedLearning");
export const SharedLearningType = SharedLearningRef.implement({
	description: "A learning shared with the team",
	fields: (t) => ({
		id: t.exposeString("id"),
		content: t.exposeString("content"),
		domain: t.exposeString("domain"),
		sharedBy: t.exposeString("sharedBy"),
		sharedByEmail: t.string({
			nullable: true,
			resolve: (l) => l.sharedByEmail ?? null,
		}),
		sharedAt: t.field({
			type: "Float",
			resolve: (l) => l.sharedAt,
		}),
		source: t.string({
			nullable: true,
			resolve: (l) => l.source ?? null,
		}),
		tags: t.stringList({
			nullable: true,
			resolve: (l) => l.tags ?? null,
		}),
		status: t.exposeString("status"),
		moderationNotes: t.string({
			nullable: true,
			resolve: (l) => l.moderationNotes ?? null,
		}),
	}),
});

/**
 * Export result type
 */
interface ExportResultData {
	success: boolean;
	message: string;
	exportJson: string | null;
}

const ExportResultRef = builder.objectRef<ExportResultData>("TeamKnowledgeExportResult");
export const TeamKnowledgeExportResultType = ExportResultRef.implement({
	description: "Result of exporting team knowledge",
	fields: (t) => ({
		success: t.exposeBoolean("success"),
		message: t.exposeString("message"),
		exportJson: t.string({
			nullable: true,
			description: "JSON string of the export data",
			resolve: (r) => r.exportJson,
		}),
	}),
});

/**
 * Import result type
 */
interface ImportResultData {
	success: boolean;
	message: string;
	imported: number;
	skipped: number;
	errors: number;
}

const ImportResultRef = builder.objectRef<ImportResultData>("TeamKnowledgeImportResult");
export const TeamKnowledgeImportResultType = ImportResultRef.implement({
	description: "Result of importing team knowledge",
	fields: (t) => ({
		success: t.exposeBoolean("success"),
		message: t.exposeString("message"),
		imported: t.exposeInt("imported"),
		skipped: t.exposeInt("skipped"),
		errors: t.exposeInt("errors"),
	}),
});

/**
 * Moderation result type
 */
const ModerationResultRef = builder.objectRef<ModerationResult>("ModerationResult");
export const ModerationResultType = ModerationResultRef.implement({
	description: "Result of a moderation action",
	fields: (t) => ({
		success: t.exposeBoolean("success"),
		message: t.exposeString("message"),
		learningId: t.string({
			nullable: true,
			resolve: (r) => r.learningId ?? null,
		}),
	}),
});

/**
 * Sharing policy type
 */
const SharingPolicyRef = builder.objectRef<OrgSharingPolicy>("OrgSharingPolicy");
export const OrgSharingPolicyType = SharingPolicyRef.implement({
	description: "Organization sharing policy",
	fields: (t) => ({
		requireApproval: t.exposeBoolean("requireApproval"),
		allowedDomains: t.exposeStringList("allowedDomains"),
		blockedDomains: t.exposeStringList("blockedDomains"),
		maxLearningsPerDay: t.exposeInt("maxLearningsPerDay"),
		allowAnonymous: t.exposeBoolean("allowAnonymous"),
		minContentLength: t.exposeInt("minContentLength"),
		maxContentLength: t.exposeInt("maxContentLength"),
		updatedAt: t.field({
			type: "Float",
			resolve: (p) => p.updatedAt,
		}),
		updatedBy: t.exposeString("updatedBy"),
	}),
});

/**
 * Policy update result type
 */
interface PolicyUpdateResultData {
	success: boolean;
	message: string;
	policy: OrgSharingPolicy | null;
}

const PolicyUpdateResultRef = builder.objectRef<PolicyUpdateResultData>("PolicyUpdateResult");
export const PolicyUpdateResultType = PolicyUpdateResultRef.implement({
	description: "Result of updating sharing policy",
	fields: (t) => ({
		success: t.exposeBoolean("success"),
		message: t.exposeString("message"),
		policy: t.field({
			type: OrgSharingPolicyType,
			nullable: true,
			resolve: (r) => r.policy,
		}),
	}),
});

// =============================================================================
// Helper function to build context
// =============================================================================

interface TeamUserContextInputData {
	userId: string;
	orgId?: string | null;
	email?: string | null;
	isAdmin?: boolean | null;
}

function buildContext(input: TeamUserContextInputData): UserPermissionContext {
	return {
		userId: input.userId,
		orgId: input.orgId ?? undefined,
		email: input.email ?? undefined,
	} as UserPermissionContext & { isAdmin?: boolean };
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * Share a learning with the team
 */
builder.mutationField("shareWithTeam", (t) =>
	t.field({
		type: ShareLearningResultType,
		args: {
			input: t.arg({ type: ShareLearningInput, required: true }),
			context: t.arg({ type: TeamUserContextInput, required: true }),
		},
		description: "Share a personal learning with the team",
		resolve: async (_parent, args) => {
			const ctx = buildContext(args.context);
			return await shareLearningWithTeam({
				content: args.input.content,
				domain: args.input.domain,
				context: ctx,
				source: args.input.source ?? undefined,
				tags: args.input.tags ?? undefined,
				requireApproval: args.input.requireApproval ?? undefined,
			});
		},
	}),
);

/**
 * Export team knowledge
 */
builder.mutationField("exportTeamKnowledge", (t) =>
	t.field({
		type: TeamKnowledgeExportResultType,
		args: {
			context: t.arg({ type: TeamUserContextInput, required: true }),
			options: t.arg({ type: ExportOptionsInput, required: false }),
		},
		description: "Export team knowledge to JSON format",
		resolve: async (_parent, args) => {
			const ctx = buildContext(args.context);
			const result = await exportTeamKnowledge(ctx, {
				approvedOnly: args.options?.approvedOnly ?? undefined,
				domains: args.options?.domains ?? undefined,
				includePatterns: args.options?.includePatterns ?? undefined,
				description: args.options?.description ?? undefined,
			});

			return {
				success: result.success,
				message: result.message,
				exportJson: result.data ? JSON.stringify(result.data) : null,
			};
		},
	}),
);

/**
 * Import team knowledge
 */
builder.mutationField("importTeamKnowledge", (t) =>
	t.field({
		type: TeamKnowledgeImportResultType,
		args: {
			context: t.arg({ type: TeamUserContextInput, required: true }),
			importJson: t.arg.string({ required: true, description: "JSON string of export data" }),
			options: t.arg({ type: ImportOptionsInput, required: false }),
		},
		description: "Import team knowledge from JSON format",
		resolve: async (_parent, args) => {
			const ctx = buildContext(args.context);

			// Parse the import JSON
			let importData: TeamKnowledgeExport;
			try {
				importData = JSON.parse(args.importJson) as TeamKnowledgeExport;
			} catch {
				return {
					success: false,
					message: "Invalid JSON format",
					imported: 0,
					skipped: 0,
					errors: 1,
				};
			}

			const result = await importTeamKnowledge(ctx, importData, {
				duplicateStrategy: (args.options?.duplicateStrategy as "skip" | "replace" | "create_new") ?? undefined,
				autoApprove: args.options?.autoApprove ?? undefined,
				domains: args.options?.domains ?? undefined,
				dryRun: args.options?.dryRun ?? undefined,
			});

			return {
				success: result.success,
				message: result.message,
				imported: result.stats?.imported ?? 0,
				skipped: result.stats?.skipped ?? 0,
				errors: result.stats?.errors ?? 0,
			};
		},
	}),
);

/**
 * Approve a pending learning (admin only)
 */
builder.mutationField("approveLearning", (t) =>
	t.field({
		type: ModerationResultType,
		args: {
			context: t.arg({ type: TeamUserContextInput, required: true }),
			learningId: t.arg.string({ required: true }),
			notes: t.arg.string({ required: false }),
		},
		description: "Approve a pending learning (admin only)",
		resolve: (_parent, args) => {
			const ctx = {
				...buildContext(args.context),
				isAdmin: args.context.isAdmin ?? false,
			} as UserPermissionContext & { isAdmin: boolean };

			return approveLearning(ctx, args.learningId, args.notes ?? undefined);
		},
	}),
);

/**
 * Reject a pending learning (admin only)
 */
builder.mutationField("rejectLearning", (t) =>
	t.field({
		type: ModerationResultType,
		args: {
			context: t.arg({ type: TeamUserContextInput, required: true }),
			learningId: t.arg.string({ required: true }),
			reason: t.arg.string({ required: true }),
		},
		description: "Reject a pending learning (admin only)",
		resolve: (_parent, args) => {
			const ctx = {
				...buildContext(args.context),
				isAdmin: args.context.isAdmin ?? false,
			} as UserPermissionContext & { isAdmin: boolean };

			return rejectLearning(ctx, args.learningId, args.reason);
		},
	}),
);

/**
 * Remove a shared learning (admin only)
 */
builder.mutationField("removeSharedLearning", (t) =>
	t.field({
		type: ModerationResultType,
		args: {
			context: t.arg({ type: TeamUserContextInput, required: true }),
			learningId: t.arg.string({ required: true }),
			reason: t.arg.string({ required: true }),
		},
		description: "Remove a shared learning (admin only)",
		resolve: (_parent, args) => {
			const ctx = {
				...buildContext(args.context),
				isAdmin: args.context.isAdmin ?? false,
			} as UserPermissionContext & { isAdmin: boolean };

			return removeSharedLearning(ctx, args.learningId, args.reason);
		},
	}),
);

/**
 * Get pending learnings for review (admin only)
 */
builder.queryField("pendingLearnings", (t) =>
	t.field({
		type: [SharedLearningType],
		args: {
			context: t.arg({ type: TeamUserContextInput, required: true }),
			limit: t.arg.int({ required: false }),
			domain: t.arg.string({ required: false }),
		},
		description: "Get pending learnings for review (admin only)",
		resolve: (_parent, args) => {
			const ctx = {
				...buildContext(args.context),
				isAdmin: args.context.isAdmin ?? false,
			} as UserPermissionContext & { isAdmin: boolean };

			return reviewPendingLearnings(ctx, {
				limit: args.limit ?? undefined,
				domain: args.domain ?? undefined,
			});
		},
	}),
);

/**
 * Update organization sharing policy (admin only)
 */
builder.mutationField("updateSharingPolicy", (t) =>
	t.field({
		type: PolicyUpdateResultType,
		args: {
			context: t.arg({ type: TeamUserContextInput, required: true }),
			policy: t.arg({ type: SharingPolicyInput, required: true }),
		},
		description: "Update organization sharing policy (admin only)",
		resolve: (_parent, args) => {
			const ctx = {
				...buildContext(args.context),
				isAdmin: args.context.isAdmin ?? false,
				role: "admin" as const,
			} as UserPermissionContext & { isAdmin: boolean; role: "admin" };

			const result = updateOrgSharingPolicy(ctx, {
				requireApproval: args.policy.requireApproval ?? undefined,
				allowedDomains: args.policy.allowedDomains ?? undefined,
				blockedDomains: args.policy.blockedDomains ?? undefined,
				maxLearningsPerDay: args.policy.maxLearningsPerDay ?? undefined,
				allowAnonymous: args.policy.allowAnonymous ?? undefined,
				minContentLength: args.policy.minContentLength ?? undefined,
				maxContentLength: args.policy.maxContentLength ?? undefined,
			});

			return {
				success: result.success,
				message: result.message,
				policy: result.policy ?? null,
			};
		},
	}),
);
