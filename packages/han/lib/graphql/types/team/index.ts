/**
 * Team Platform GraphQL Types
 *
 * Types for multi-user team session viewing.
 * In local mode, these return null/empty values.
 * In hosted mode, populated from team platform.
 */

export { OrgRef, OrgType, TeamMemberRef, TeamMemberRoleEnum, TeamMemberType } from "./org.ts";
export type { OrgData, TeamMemberData } from "./org.ts";
export { UserRef, UserType } from "./user.ts";
export type { UserData } from "./user.ts";
