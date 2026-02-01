/**
 * Authentication Types
 *
 * Type definitions for JWT authentication and authorization.
 */

/**
 * JWT token payload structure
 */
export interface TokenPayload {
  /** Subject - the user ID */
  sub: string;
  /** User email (optional) */
  email?: string;
  /** Token type: 'access' or 'refresh' */
  type: "access" | "refresh";
  /** Issued at timestamp (seconds) */
  iat: number;
  /** Expiration timestamp (seconds) */
  exp: number;
}

/**
 * Authenticated user context set by middleware
 */
export interface AuthUser {
  id: string;
  email?: string;
}

/**
 * Token verification result
 */
export interface VerifyResult {
  payload: TokenPayload;
  userId: string;
  email?: string;
}

/**
 * Error codes for authentication failures
 */
export type AuthErrorCode =
  | "missing_token"
  | "unauthorized"
  | "token_expired"
  | "invalid_token_type";

/**
 * Auth error with standardized code
 */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}
