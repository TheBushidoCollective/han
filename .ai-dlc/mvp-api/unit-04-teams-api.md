---
status: completed
depends_on:
  - unit-01-auth-middleware
branch: ai-dlc/mvp-api/04-teams-api
discipline: backend
---

# unit-04-teams-api

## Description

Implement teams and user profile endpoints for collaboration features. Teams share encryption keys and session access.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `createTeam` mutation creates team with authenticated user as admin
- [ ] `teams` query returns teams user belongs to (Relay connection)
- [ ] `team(id: ID!)` query returns team details (if member)
- [ ] `updateTeam` mutation updates team name/settings (admin only)
- [ ] `deleteTeam` mutation soft-deletes team (admin only)
- [ ] `createTeamInvite` mutation generates 24h invite code (admin only)
- [ ] `joinTeam` mutation joins team via invite code
- [ ] `Team.members` field returns team members (Relay connection)
- [ ] `updateTeamMember` mutation changes member role (admin only)
- [ ] `removeTeamMember` mutation removes member (admin only)
- [ ] `me` query returns current user with team memberships
- [ ] `updateProfile` mutation updates user display name
- [ ] Team creation provisions encryption key via EncryptionService
- [ ] Unit tests for all resolvers with role-based access control

## Notes

**Roles:**
- `admin` - Can manage team, invite members, change roles
- `member` - Can access team sessions, sync to team

**Invite code format:**
```typescript
interface InviteCode {
  code: string;        // Random 8-char alphanumeric
  team_id: string;
  created_by: string;
  expires_at: Date;    // 24 hours from creation
}
```

**GraphQL Schema:**
```graphql
type Team implements Node {
  id: ID!
  name: String!
  members(first: Int, after: String): TeamMemberConnection!
  sessions(first: Int, after: String): SessionConnection!
  createdAt: DateTime!
  myRole: TeamRole!
}

type TeamMember {
  user: User!
  role: TeamRole!
  joinedAt: DateTime!
}

enum TeamRole { ADMIN MEMBER }

type User implements Node {
  id: ID!
  githubUsername: String!
  email: String!
  displayName: String
  teams: [TeamMembership!]!
  tier: UserTier!
}

type Query {
  me: User!
  team(id: ID!): Team
  teams(first: Int, after: String): TeamConnection!
}

type Mutation {
  createTeam(name: String!): Team!
  updateTeam(id: ID!, name: String!): Team!
  deleteTeam(id: ID!): DeleteTeamPayload!
  createTeamInvite(teamId: ID!): TeamInvite!
  joinTeam(code: String!): Team!
  updateTeamMember(teamId: ID!, userId: ID!, role: TeamRole!): TeamMember!
  removeTeamMember(teamId: ID!, userId: ID!): RemoveMemberPayload!
  updateProfile(displayName: String): User!
}
```

**File structure:**
```
lib/
  graphql/
    types/
      team.ts
      team-member.ts
      user.ts
      team-invite.ts
    resolvers/
      team-resolvers.ts
      user-resolvers.ts
```

**Database tables (already exist):**
- `teams` - id, name, created_at, updated_at
- `team_members` - team_id, user_id, role, joined_at
- `users` - id, github_id, email, display_name, etc.
