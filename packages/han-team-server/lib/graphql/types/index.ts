/**
 * GraphQL Types Index
 *
 * Re-exports all GraphQL types for the Han Team Server.
 *
 * @description This module provides a single import point for all GraphQL types.
 * Types are organized by domain:
 * - User: User accounts and authentication
 * - Team: Team groupings within organizations
 * - Organization: Multi-tenant organization entities
 * - Session: Claude Code sessions synced to the server
 * - Errors: Structured error types
 * - ApiInfo: API metadata and feature discovery
 */

// User types
export { UserRef, UserType } from "./user.ts";
export type { UserData } from "./user.ts";

// Team types
export {
  TeamMemberRoleEnum,
  TeamMemberRef,
  TeamMemberType,
  TeamRef,
  TeamType,
} from "./team.ts";
export type { TeamData, TeamMemberData } from "./team.ts";

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

// Sync session types
export {
  MessageInput,
  SyncSessionInput,
  SyncSessionPayloadRef,
  SyncSessionPayloadType,
} from "./sync-session.ts";
export type { SyncSessionPayloadData } from "./sync-session.ts";

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
