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

// Core organizational tables
export { organizations, type Organization, type NewOrganization } from "./organizations.ts";
export { teams, type Team, type NewTeam } from "./teams.ts";
export { users, type User, type NewUser } from "./users.ts";
export { memberships, type Membership, type NewMembership, type MembershipRole } from "./memberships.ts";

// Project structure tables
export { repositories, type Repository, type NewRepository } from "./repositories.ts";
export { projects, type Project, type NewProject } from "./projects.ts";

// Session and message tables
export { sessions, type Session, type NewSession } from "./sessions.ts";
export { messages, type Message, type NewMessage } from "./messages.ts";

// Hook and validation tables
export { hookExecutions, type HookExecution, type NewHookExecution } from "./hook-executions.ts";
export { sessionFileChanges, type SessionFileChange, type NewSessionFileChange } from "./file-changes.ts";
export { sessionFileValidations, type SessionFileValidation, type NewSessionFileValidation } from "./file-validations.ts";

// Task tracking
export { nativeTasks, type NativeTask, type NewNativeTask } from "./native-tasks.ts";
