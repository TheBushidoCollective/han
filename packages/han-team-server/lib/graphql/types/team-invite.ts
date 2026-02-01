/**
 * GraphQL Team Invite Type
 *
 * Represents a team invitation code that allows users to join a team.
 * Invite codes are valid for 24 hours and can be used once.
 *
 * @description Team invites are created by team admins and contain a short
 * alphanumeric code that can be shared with potential team members.
 */

import { builder } from "../builder.ts";

/**
 * Team invite data shape from the database.
 *
 * @description Maps to the `team_invites` table in PostgreSQL.
 */
export interface TeamInviteData {
  /** Unique invite identifier (UUID) */
  id: string;
  /** Random 8-character alphanumeric invite code */
  code: string;
  /** Team the invite is for */
  teamId: string;
  /** User who created the invite */
  createdBy: string;
  /** When the invite was created */
  createdAt: Date;
  /** When the invite expires (24 hours from creation) */
  expiresAt: Date;
  /** Whether the invite has been used */
  usedAt: Date | null;
  /** User who used the invite (if any) */
  usedBy: string | null;
}

/**
 * Team invite object reference for lazy type resolution.
 */
export const TeamInviteRef = builder.objectRef<TeamInviteData>("TeamInvite");

/**
 * Team invite GraphQL type implementation.
 *
 * @description Represents an invitation to join a team. The code can be
 * shared with users who want to join the team.
 */
export const TeamInviteType = TeamInviteRef.implement({
  description:
    "An invitation code for joining a team. Valid for 24 hours after creation.",
  fields: (t) => ({
    id: t.exposeID("id", {
      description: "Unique invite identifier (UUID format)",
    }),
    code: t.exposeString("code", {
      description:
        "8-character alphanumeric invite code to share with potential members",
    }),
    teamId: t.exposeString("teamId", {
      description: "ID of the team this invite is for",
    }),
    createdBy: t.exposeString("createdBy", {
      description: "ID of the user who created this invite",
    }),
    createdAt: t.field({
      type: "DateTime",
      description: "Timestamp when the invite was created",
      resolve: (invite) => invite.createdAt,
    }),
    expiresAt: t.field({
      type: "DateTime",
      description: "Timestamp when the invite expires (24 hours from creation)",
      resolve: (invite) => invite.expiresAt,
    }),
  }),
});

/**
 * Generate a random 8-character alphanumeric invite code.
 *
 * @description Uses uppercase letters and digits for clarity (no ambiguous chars).
 * @returns 8-character alphanumeric string
 */
export function generateInviteCode(): string {
  // Use characters that are unambiguous (no 0/O, 1/I/l confusion)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const randomBytes = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}

/**
 * Create a team invite data object.
 *
 * @description Creates an invite that expires in 24 hours.
 * @param teamId - ID of the team to invite to
 * @param createdBy - ID of the user creating the invite
 * @returns TeamInviteData object
 */
export function createTeamInvite(
  teamId: string,
  createdBy: string
): TeamInviteData {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  return {
    id: crypto.randomUUID(),
    code: generateInviteCode(),
    teamId,
    createdBy,
    createdAt: now,
    expiresAt,
    usedAt: null,
    usedBy: null,
  };
}

/**
 * Check if an invite is still valid.
 *
 * @description An invite is valid if it hasn't been used and hasn't expired.
 * @param invite - The invite to check
 * @returns true if the invite is valid
 */
export function isInviteValid(invite: TeamInviteData): boolean {
  if (invite.usedAt !== null) {
    return false;
  }
  return new Date() < invite.expiresAt;
}
