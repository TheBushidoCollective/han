/**
 * Authentication Types for Team Platform
 *
 * Types for user, organization, and team member data
 * used in hosted mode for team session viewing.
 */

/**
 * Represents a user in the team platform
 */
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/**
 * Represents an organization that users belong to
 */
export interface Org {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
}

/**
 * Represents a team member within an organization
 */
export interface TeamMember {
  id: string;
  userId: string;
  orgId: string;
  role: 'admin' | 'member' | 'viewer';
  user: User;
}

/**
 * Date range for filtering sessions
 */
export interface DateRange {
  start: string | null;
  end: string | null;
}

/**
 * Filters for team session queries
 */
export interface TeamSessionFilters {
  orgId?: string;
  userId?: string;
  dateRange?: DateRange;
  viewMode: 'personal' | 'team';
}
