/**
 * GraphQL Types Index
 *
 * Re-exports all GraphQL types for the Han Team Server.
 *
 * @description This module provides a single import point for all GraphQL types.
 * Types are organized by domain:
 * - User: User accounts and authentication
 * - Team: Team groupings within organizations
 * - TeamInvite: Team invitation codes
 * - Organization: Multi-tenant organization entities
 * - Session: Claude Code sessions synced to the server
 * - Errors: Structured error types
 * - ApiInfo: API metadata and feature discovery
 */

// User types
export {
  TeamMembershipRef,
  TeamMembershipType,
  UserRef,
  UserTierEnum,
  UserType,
  getUserById,
  getUserTeamMemberships,
  updateUserDisplayName,
} from "./user.ts";
export type { TeamMembershipData, UserData } from "./user.ts";

// Team types
export {
  DeleteTeamPayloadRef,
  DeleteTeamPayloadType,
  RemoveMemberPayloadRef,
  RemoveMemberPayloadType,
  TeamMemberRef,
  TeamMemberRoleEnum,
  TeamMemberType,
  TeamRef,
  TeamRoleEnum,
  TeamType,
  generateTeamSlug,
  getTeamRole,
  isTeamAdmin,
  isTeamMember,
} from "./team.ts";
export type {
  DeleteTeamPayloadData,
  RemoveMemberPayloadData,
  TeamData,
  TeamMemberData,
} from "./team.ts";

// Team invite types
export {
  TeamInviteRef,
  TeamInviteType,
  createTeamInvite,
  generateInviteCode,
  isInviteValid,
} from "./team-invite.ts";
export type { TeamInviteData } from "./team-invite.ts";

// Organization types
export {
  BillingPlanEnum,
  OrgMemberRef,
  OrgMemberRoleEnum,
  OrgMemberType,
  OrgRef,
  OrgType,
} from "./organization.ts";
export type { OrgData, OrgMemberData } from "./organization.ts";

// Session types
export {
  SessionRef,
  SessionStatusEnum,
  SessionType,
  SessionVisibilityEnum,
} from "./session.ts";
export type { SessionData } from "./session.ts";

// Error types
export {
  AuthErrorRef,
  AuthErrorType,
  BaseErrorRef,
  BaseErrorType,
  ErrorCodeEnum,
  FieldErrorRef,
  FieldErrorType,
  ValidationErrorRef,
  ValidationErrorType,
} from "./errors.ts";
export type {
  AuthErrorData,
  BaseErrorData,
  FieldErrorData,
  ValidationErrorData,
} from "./errors.ts";

// API info types
export { ApiInfoRef, ApiInfoType, getApiInfo } from "./api-info.ts";
export type { ApiInfoData } from "./api-info.ts";

// Billing types
export {
  BillingInfoRef,
  BillingInfoType,
  CheckoutSessionResultRef,
  CheckoutSessionResultType,
  PriceIntervalEnum,
  SubscriptionStatusEnum,
} from "./billing.ts";

// GDPR types
export {
  DataExportRef,
  DataExportStatusEnum,
  DataExportType,
  DeletionRequestRef,
  DeletionRequestStatusEnum,
  DeletionRequestType,
  RequestDeletionResultRef,
  RequestDeletionResultType,
  RequestExportResultRef,
  RequestExportResultType,
} from "./gdpr.ts";
