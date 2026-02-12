/**
 * PostgreSQL Schema for Hosted Mode
 *
 * This module exports all Drizzle ORM table definitions for the hosted
 * multi-tenant platform. All tables include organization_id for tenant isolation.
 *
 * Schema design principles:
 * - Multi-tenant: All tables have organization_id with CASCADE delete
 * - Correlation: Local IDs (local_session_id, local_message_id) for syncing
 * - Normalized: Proper foreign key relationships
 * - Indexed: Appropriate indexes for common queries
 */

export {
  type NewSessionFileChange,
  type SessionFileChange,
  sessionFileChanges,
} from './file-changes.ts';
export {
  type NewSessionFileValidation,
  type SessionFileValidation,
  sessionFileValidations,
} from './file-validations.ts';
// Hook and validation tables
export {
  type HookExecution,
  hookExecutions,
  type NewHookExecution,
} from './hook-executions.ts';
export {
  type Membership,
  type MembershipRole,
  memberships,
  type NewMembership,
} from './memberships.ts';
export { type Message, messages, type NewMessage } from './messages.ts';
// Task tracking
export {
  type NativeTask,
  type NewNativeTask,
  nativeTasks,
} from './native-tasks.ts';
// Core organizational tables
export {
  type NewOrganization,
  type Organization,
  organizations,
} from './organizations.ts';
export { type NewProject, type Project, projects } from './projects.ts';
// Project structure tables
export {
  type NewRepository,
  type Repository,
  repositories,
} from './repositories.ts';
// Session and message tables
export { type NewSession, type Session, sessions } from './sessions.ts';
export { type NewTeam, type Team, teams } from './teams.ts';
export { type NewUser, type User, users } from './users.ts';
