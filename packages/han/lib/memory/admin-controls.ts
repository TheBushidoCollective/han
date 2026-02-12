/**
 * Admin Controls for Shared Content
 *
 * Provides moderation capabilities for administrators to manage
 * shared learnings and team knowledge. Includes:
 * - Review pending learnings
 * - Approve/reject shared content
 * - Remove inappropriate content
 * - Set organization-wide sharing policies
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { UserPermissionContext } from './permission-filter.ts';
import { enforceRateLimit } from './rate-limiter.ts';
import { loadSharedLearnings, type SharedLearning } from './share-learning.ts';
import { invalidateOrgLearnings } from './team-memory-cache.ts';

/**
 * Admin role check
 */
export type AdminRole = 'owner' | 'admin' | 'moderator';

/**
 * Organization sharing policy
 */
export interface OrgSharingPolicy {
  /** Whether learnings require approval before being visible */
  requireApproval: boolean;
  /** Allowed domains for sharing (empty = all allowed) */
  allowedDomains: string[];
  /** Blocked domains (take precedence over allowed) */
  blockedDomains: string[];
  /** Maximum learnings per user per day */
  maxLearningsPerDay: number;
  /** Whether to allow anonymous sharing (hide author) */
  allowAnonymous: boolean;
  /** Minimum content length */
  minContentLength: number;
  /** Maximum content length */
  maxContentLength: number;
  /** Auto-reject patterns (regex strings) */
  autoRejectPatterns: string[];
  /** Updated at timestamp */
  updatedAt: number;
  /** Updated by user ID */
  updatedBy: string;
}

/**
 * Default sharing policy
 */
const DEFAULT_POLICY: OrgSharingPolicy = {
  requireApproval: true,
  allowedDomains: [],
  blockedDomains: [],
  maxLearningsPerDay: 10,
  allowAnonymous: false,
  minContentLength: 10,
  maxContentLength: 10000,
  autoRejectPatterns: [],
  updatedAt: Date.now(),
  updatedBy: 'system',
};

/**
 * Moderation action result
 */
export interface ModerationResult {
  success: boolean;
  message: string;
  learningId?: string;
}

/**
 * Batch moderation result
 */
export interface BatchModerationResult {
  success: boolean;
  message: string;
  results: ModerationResult[];
  stats: {
    approved: number;
    rejected: number;
    errors: number;
  };
}

/**
 * Check if user has admin role
 *
 * In a real implementation, this would check against an organization's
 * member roles. For now, we use a simple heuristic based on context.
 */
export function checkAdminRole(context: UserPermissionContext): {
  isAdmin: boolean;
  role?: AdminRole;
} {
  // Check if user has admin flag in context
  // This is a placeholder - real implementation would check org membership
  const adminContext = context as UserPermissionContext & {
    isAdmin?: boolean;
    role?: AdminRole;
  };

  if (adminContext.isAdmin || adminContext.role) {
    return {
      isAdmin: true,
      role: adminContext.role ?? 'admin',
    };
  }

  // For demo purposes, treat org owners as admins
  // In production, this would be a proper role check
  return {
    isAdmin: false,
  };
}

/**
 * Require admin role - throws if not admin
 */
function requireAdmin(context: UserPermissionContext): AdminRole {
  const { isAdmin, role } = checkAdminRole(context);
  if (!isAdmin) {
    throw new Error('Admin role required for this operation');
  }
  return role!;
}

/**
 * Get the path to shared learnings storage
 */
function getSharedLearningsPath(orgId: string): string {
  return join(homedir(), '.claude', 'han', 'shared-learnings', `${orgId}.json`);
}

/**
 * Get the path to org policy storage
 */
function getOrgPolicyPath(orgId: string): string {
  return join(homedir(), '.claude', 'han', 'org-policies', `${orgId}.json`);
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
 * Load org sharing policy
 */
export function loadOrgPolicy(orgId: string): OrgSharingPolicy {
  const path = getOrgPolicyPath(orgId);
  if (!existsSync(path)) {
    return { ...DEFAULT_POLICY };
  }
  try {
    const content = readFileSync(path, 'utf-8');
    return { ...DEFAULT_POLICY, ...JSON.parse(content) };
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

/**
 * Save org sharing policy
 */
function saveOrgPolicy(orgId: string, policy: OrgSharingPolicy): void {
  const path = getOrgPolicyPath(orgId);
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(policy, null, 2));
}

/**
 * Get pending learnings for review
 */
export function reviewPendingLearnings(
  context: UserPermissionContext,
  options?: {
    limit?: number;
    domain?: string;
  }
): SharedLearning[] {
  if (!context.orgId) {
    throw new Error('Organization context required');
  }

  requireAdmin(context);

  let learnings = loadSharedLearnings(context.orgId).filter(
    (l) => l.status === 'pending'
  );

  // Filter by domain if specified
  if (options?.domain) {
    learnings = learnings.filter((l) => l.domain === options.domain);
  }

  // Sort by oldest first (FIFO review)
  learnings.sort((a, b) => a.sharedAt - b.sharedAt);

  // Apply limit
  if (options?.limit && options.limit > 0) {
    learnings = learnings.slice(0, options.limit);
  }

  return learnings;
}

/**
 * Approve a pending learning
 */
export function approveLearning(
  context: UserPermissionContext,
  learningId: string,
  notes?: string
): ModerationResult {
  if (!context.orgId) {
    return {
      success: false,
      message: 'Organization context required',
    };
  }

  try {
    requireAdmin(context);
    enforceRateLimit(context.userId, 'moderate');
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Permission denied',
    };
  }

  const learnings = loadSharedLearnings(context.orgId);
  const learning = learnings.find((l) => l.id === learningId);

  if (!learning) {
    return {
      success: false,
      message: `Learning not found: ${learningId}`,
      learningId,
    };
  }

  if (learning.status !== 'pending') {
    return {
      success: false,
      message: `Learning is not pending (status: ${learning.status})`,
      learningId,
    };
  }

  // Update status
  learning.status = 'approved';
  learning.moderationNotes = notes
    ? `Approved by ${context.userId}: ${notes}`
    : `Approved by ${context.userId}`;

  saveSharedLearnings(context.orgId, learnings);
  invalidateOrgLearnings(context.orgId);

  return {
    success: true,
    message: 'Learning approved',
    learningId,
  };
}

/**
 * Reject a pending learning
 */
export function rejectLearning(
  context: UserPermissionContext,
  learningId: string,
  reason: string
): ModerationResult {
  if (!context.orgId) {
    return {
      success: false,
      message: 'Organization context required',
    };
  }

  try {
    requireAdmin(context);
    enforceRateLimit(context.userId, 'moderate');
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Permission denied',
    };
  }

  const learnings = loadSharedLearnings(context.orgId);
  const learning = learnings.find((l) => l.id === learningId);

  if (!learning) {
    return {
      success: false,
      message: `Learning not found: ${learningId}`,
      learningId,
    };
  }

  if (learning.status !== 'pending') {
    return {
      success: false,
      message: `Learning is not pending (status: ${learning.status})`,
      learningId,
    };
  }

  // Update status
  learning.status = 'rejected';
  learning.moderationNotes = `Rejected by ${context.userId}: ${reason}`;

  saveSharedLearnings(context.orgId, learnings);

  return {
    success: true,
    message: 'Learning rejected',
    learningId,
  };
}

/**
 * Remove a shared learning (soft delete by setting status to rejected)
 */
export function removeSharedLearning(
  context: UserPermissionContext,
  learningId: string,
  reason: string
): ModerationResult {
  if (!context.orgId) {
    return {
      success: false,
      message: 'Organization context required',
    };
  }

  try {
    requireAdmin(context);
    enforceRateLimit(context.userId, 'moderate');
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Permission denied',
    };
  }

  const learnings = loadSharedLearnings(context.orgId);
  const learning = learnings.find((l) => l.id === learningId);

  if (!learning) {
    return {
      success: false,
      message: `Learning not found: ${learningId}`,
      learningId,
    };
  }

  // Update status to rejected (soft delete)
  learning.status = 'rejected';
  learning.moderationNotes = `Removed by ${context.userId}: ${reason}`;

  saveSharedLearnings(context.orgId, learnings);
  invalidateOrgLearnings(context.orgId);

  return {
    success: true,
    message: 'Learning removed',
    learningId,
  };
}

/**
 * Permanently delete a shared learning (hard delete)
 */
export function deleteSharedLearning(
  context: UserPermissionContext,
  learningId: string
): ModerationResult {
  if (!context.orgId) {
    return {
      success: false,
      message: 'Organization context required',
    };
  }

  try {
    const role = requireAdmin(context);
    // Only owners can hard delete
    if (role !== 'owner') {
      return {
        success: false,
        message: 'Only organization owners can permanently delete learnings',
        learningId,
      };
    }
    enforceRateLimit(context.userId, 'moderate');
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Permission denied',
    };
  }

  const learnings = loadSharedLearnings(context.orgId);
  const idx = learnings.findIndex((l) => l.id === learningId);

  if (idx === -1) {
    return {
      success: false,
      message: `Learning not found: ${learningId}`,
      learningId,
    };
  }

  // Remove from array
  learnings.splice(idx, 1);

  saveSharedLearnings(context.orgId, learnings);
  invalidateOrgLearnings(context.orgId);

  return {
    success: true,
    message: 'Learning permanently deleted',
    learningId,
  };
}

/**
 * Batch approve multiple learnings
 */
export function batchApproveLearnings(
  context: UserPermissionContext,
  learningIds: string[],
  notes?: string
): BatchModerationResult {
  const results: ModerationResult[] = [];
  let approved = 0;
  let rejected = 0;
  let errors = 0;

  for (const id of learningIds) {
    const result = approveLearning(context, id, notes);
    results.push(result);
    if (result.success) {
      approved++;
    } else if (result.message.includes('not pending')) {
      rejected++;
    } else {
      errors++;
    }
  }

  return {
    success: errors === 0,
    message: `Approved ${approved}, already processed ${rejected}, errors ${errors}`,
    results,
    stats: { approved, rejected, errors },
  };
}

/**
 * Batch reject multiple learnings
 */
export function batchRejectLearnings(
  context: UserPermissionContext,
  learningIds: string[],
  reason: string
): BatchModerationResult {
  const results: ModerationResult[] = [];
  let approved = 0;
  let rejected = 0;
  let errors = 0;

  for (const id of learningIds) {
    const result = rejectLearning(context, id, reason);
    results.push(result);
    if (result.success) {
      rejected++;
    } else if (result.message.includes('not pending')) {
      approved++; // Already processed
    } else {
      errors++;
    }
  }

  return {
    success: errors === 0,
    message: `Rejected ${rejected}, already processed ${approved}, errors ${errors}`,
    results,
    stats: { approved, rejected, errors },
  };
}

/**
 * Get organization sharing policy
 */
export function getOrgSharingPolicy(
  context: UserPermissionContext
): OrgSharingPolicy | null {
  if (!context.orgId) {
    return null;
  }

  return loadOrgPolicy(context.orgId);
}

/**
 * Update organization sharing policy
 */
export function updateOrgSharingPolicy(
  context: UserPermissionContext,
  updates: Partial<Omit<OrgSharingPolicy, 'updatedAt' | 'updatedBy'>>
): {
  success: boolean;
  message: string;
  policy?: OrgSharingPolicy;
} {
  if (!context.orgId) {
    return {
      success: false,
      message: 'Organization context required',
    };
  }

  try {
    const role = requireAdmin(context);
    // Only owners and admins can update policy
    if (role !== 'owner' && role !== 'admin') {
      return {
        success: false,
        message: 'Admin role required to update sharing policy',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Permission denied',
    };
  }

  const currentPolicy = loadOrgPolicy(context.orgId);
  const newPolicy: OrgSharingPolicy = {
    ...currentPolicy,
    ...updates,
    updatedAt: Date.now(),
    updatedBy: context.userId,
  };

  saveOrgPolicy(context.orgId, newPolicy);

  return {
    success: true,
    message: 'Sharing policy updated',
    policy: newPolicy,
  };
}

/**
 * Get moderation statistics for an org
 */
export function getModerationStats(context: UserPermissionContext): {
  pending: number;
  approved: number;
  rejected: number;
  byDomain: Record<
    string,
    { pending: number; approved: number; rejected: number }
  >;
} | null {
  if (!context.orgId) {
    return null;
  }

  try {
    requireAdmin(context);
  } catch {
    return null;
  }

  const learnings = loadSharedLearnings(context.orgId);

  const stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    byDomain: {} as Record<
      string,
      { pending: number; approved: number; rejected: number }
    >,
  };

  for (const learning of learnings) {
    stats[learning.status]++;

    if (!stats.byDomain[learning.domain]) {
      stats.byDomain[learning.domain] = {
        pending: 0,
        approved: 0,
        rejected: 0,
      };
    }
    stats.byDomain[learning.domain][learning.status]++;
  }

  return stats;
}
