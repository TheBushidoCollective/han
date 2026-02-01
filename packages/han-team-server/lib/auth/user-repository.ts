/**
 * User Repository
 *
 * Database operations for user management.
 * Handles CRUD operations and GitHub OAuth user creation.
 */

import { getDbConnection } from "../db/index.ts";

/**
 * User creation/update input from GitHub OAuth
 */
export interface GitHubUserInput {
  githubId: string;
  githubUsername: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * User record from database
 */
export interface User {
  id: string;
  email: string;
  name: string;
  githubId: string | null;
  githubUsername: string | null;
  avatarUrl: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create or update a user from GitHub OAuth
 *
 * If user with github_id exists: Updates their profile
 * If user with email exists (no github_id): Links GitHub account
 * Otherwise: Creates new user
 *
 * @param input - User data from GitHub
 * @returns User record or null on failure
 */
export async function createOrUpdateUser(
  input: GitHubUserInput
): Promise<User | null> {
  const db = await getDbConnection();

  try {
    // First, try to find existing user by GitHub ID
    const existingByGitHub = await db.query<User>(
      `SELECT id, email, name, github_id as "githubId",
              github_username as "githubUsername", avatar_url as "avatarUrl",
              stripe_customer_id as "stripeCustomerId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users
       WHERE github_id = $1`,
      [input.githubId]
    );

    if (existingByGitHub.rows.length > 0) {
      // Update existing user
      const result = await db.query<User>(
        `UPDATE users SET
           github_username = $2,
           email = COALESCE($3, email),
           name = COALESCE($4, name),
           avatar_url = $5,
           updated_at = CURRENT_TIMESTAMP
         WHERE github_id = $1
         RETURNING id, email, name,
                   github_id as "githubId",
                   github_username as "githubUsername",
                   avatar_url as "avatarUrl",
                   stripe_customer_id as "stripeCustomerId",
                   created_at as "createdAt",
                   updated_at as "updatedAt"`,
        [input.githubId, input.githubUsername, input.email, input.name, input.avatarUrl]
      );
      return result.rows[0] ?? null;
    }

    // Check if user exists by email (link GitHub to existing account)
    const existingByEmail = await db.query<User>(
      `SELECT id, email, name, github_id as "githubId",
              github_username as "githubUsername", avatar_url as "avatarUrl",
              stripe_customer_id as "stripeCustomerId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users
       WHERE email = $1 AND github_id IS NULL`,
      [input.email]
    );

    if (existingByEmail.rows.length > 0) {
      // Link GitHub account to existing user
      const result = await db.query<User>(
        `UPDATE users SET
           github_id = $2,
           github_username = $3,
           name = COALESCE($4, name),
           avatar_url = COALESCE($5, avatar_url),
           updated_at = CURRENT_TIMESTAMP
         WHERE email = $1
         RETURNING id, email, name,
                   github_id as "githubId",
                   github_username as "githubUsername",
                   avatar_url as "avatarUrl",
                   stripe_customer_id as "stripeCustomerId",
                   created_at as "createdAt",
                   updated_at as "updatedAt"`,
        [input.email, input.githubId, input.githubUsername, input.name, input.avatarUrl]
      );
      return result.rows[0] ?? null;
    }

    // Create new user
    const result = await db.query<User>(
      `INSERT INTO users (email, name, github_id, github_username, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name,
                 github_id as "githubId",
                 github_username as "githubUsername",
                 avatar_url as "avatarUrl",
                 stripe_customer_id as "stripeCustomerId",
                 created_at as "createdAt",
                 updated_at as "updatedAt"`,
      [input.email, input.name, input.githubId, input.githubUsername, input.avatarUrl]
    );

    const user = result.rows[0];

    if (user) {
      // Create Stripe customer for new users
      // Note: Stripe integration will be handled by a separate unit
      // For now, we just create the user without a Stripe customer
      // TODO: HIGH-2 - Integrate with Stripe customer creation
      await createStripeCustomer(user);
    }

    return user ?? null;
  } catch (error) {
    console.error("Error creating/updating user:", error);
    return null;
  }
}

/**
 * Get user by GitHub ID
 *
 * @param githubId - GitHub user ID
 * @returns User record or null if not found
 */
export async function getUserByGitHubId(githubId: string): Promise<User | null> {
  const db = await getDbConnection();

  try {
    const result = await db.query<User>(
      `SELECT id, email, name,
              github_id as "githubId",
              github_username as "githubUsername",
              avatar_url as "avatarUrl",
              stripe_customer_id as "stripeCustomerId",
              created_at as "createdAt",
              updated_at as "updatedAt"
       FROM users
       WHERE github_id = $1`,
      [githubId]
    );
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching user by GitHub ID:", error);
    return null;
  }
}

/**
 * Get user by ID
 *
 * @param id - User UUID
 * @returns User record or null if not found
 */
export async function getUserById(id: string): Promise<User | null> {
  const db = await getDbConnection();

  try {
    const result = await db.query<User>(
      `SELECT id, email, name,
              github_id as "githubId",
              github_username as "githubUsername",
              avatar_url as "avatarUrl",
              stripe_customer_id as "stripeCustomerId",
              created_at as "createdAt",
              updated_at as "updatedAt"
       FROM users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return null;
  }
}

/**
 * Get user by email
 *
 * @param email - User email address
 * @returns User record or null if not found
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const db = await getDbConnection();

  try {
    const result = await db.query<User>(
      `SELECT id, email, name,
              github_id as "githubId",
              github_username as "githubUsername",
              avatar_url as "avatarUrl",
              stripe_customer_id as "stripeCustomerId",
              created_at as "createdAt",
              updated_at as "updatedAt"
       FROM users
       WHERE email = $1`,
      [email]
    );
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching user by email:", error);
    return null;
  }
}

/**
 * Update user's Stripe customer ID
 *
 * @param userId - User UUID
 * @param stripeCustomerId - Stripe customer ID
 * @returns Updated user or null on failure
 */
export async function updateStripeCustomerId(
  userId: string,
  stripeCustomerId: string
): Promise<User | null> {
  const db = await getDbConnection();

  try {
    const result = await db.query<User>(
      `UPDATE users SET
         stripe_customer_id = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, email, name,
                 github_id as "githubId",
                 github_username as "githubUsername",
                 avatar_url as "avatarUrl",
                 stripe_customer_id as "stripeCustomerId",
                 created_at as "createdAt",
                 updated_at as "updatedAt"`,
      [userId, stripeCustomerId]
    );
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("Error updating Stripe customer ID:", error);
    return null;
  }
}

/**
 * Create Stripe customer for a user
 *
 * Placeholder for Stripe integration. Will be implemented in billing unit.
 *
 * @param user - User to create Stripe customer for
 */
async function createStripeCustomer(user: User): Promise<void> {
  // TODO: HIGH-2 - Implement Stripe customer creation
  // This will call the Stripe API to create a customer and update the user record
  // For now, we just log that a customer should be created
  console.log(`[Stripe] Should create customer for user ${user.id} (${user.email})`);
}
