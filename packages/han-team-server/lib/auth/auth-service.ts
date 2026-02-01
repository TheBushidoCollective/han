/**
 * AuthService - JWT Token Management
 *
 * Handles signing and verification of JWT tokens using the jose library.
 * Access tokens expire in 24 hours, refresh tokens in 30 days.
 */

import * as jose from "jose";
import { type TokenPayload, type VerifyResult, AuthError } from "./types.ts";

/** Access token expiration: 24 hours */
const ACCESS_TOKEN_EXPIRY = "24h";

/** Refresh token expiration: 30 days */
const REFRESH_TOKEN_EXPIRY = "30d";

/** Algorithm for JWT signing */
const JWT_ALGORITHM = "HS256";

/** Audience claim for tokens */
const JWT_AUDIENCE = "han-team-api";

/**
 * AuthService class for JWT token operations
 *
 * Provides methods to sign and verify access/refresh tokens.
 */
export class AuthService {
  private readonly secretKey: Uint8Array;
  private readonly issuer: string;

  /**
   * Create a new AuthService instance
   *
   * @param secret - Secret key for signing tokens (minimum 32 characters)
   * @param issuer - Token issuer (default: "han-team-platform")
   */
  constructor(secret: string, issuer = "han-team-platform") {
    if (secret.length < 32) {
      throw new Error("JWT secret must be at least 32 characters");
    }
    this.secretKey = new TextEncoder().encode(secret);
    this.issuer = issuer;
  }

  /**
   * Sign an access token for a user
   *
   * @param userId - The user's unique identifier
   * @param email - Optional user email to include in token
   * @returns Promise resolving to signed JWT string
   */
  async signAccessToken(userId: string, email?: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const payload: Partial<TokenPayload> = {
      sub: userId,
      type: "access",
    };

    if (email) {
      payload.email = email;
    }

    const jwt = await new jose.SignJWT(payload as jose.JWTPayload)
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .setIssuedAt(now)
      .setIssuer(this.issuer)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(this.secretKey);

    return jwt;
  }

  /**
   * Sign a refresh token for a user
   *
   * @param userId - The user's unique identifier
   * @returns Promise resolving to signed JWT string
   */
  async signRefreshToken(userId: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const payload: Partial<TokenPayload> = {
      sub: userId,
      type: "refresh",
    };

    const jwt = await new jose.SignJWT(payload as jose.JWTPayload)
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .setIssuedAt(now)
      .setIssuer(this.issuer)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(REFRESH_TOKEN_EXPIRY)
      .sign(this.secretKey);

    return jwt;
  }

  /**
   * Verify a JWT token and return its payload
   *
   * @param token - The JWT string to verify
   * @returns Promise resolving to verification result
   * @throws AuthError if token is invalid or expired
   */
  async verifyToken(token: string): Promise<VerifyResult> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secretKey, {
        issuer: this.issuer,
        audience: JWT_AUDIENCE,
      });

      const tokenPayload = payload as unknown as TokenPayload;

      if (!tokenPayload.sub) {
        throw new AuthError("unauthorized", "Token missing subject claim");
      }

      if (!tokenPayload.type) {
        throw new AuthError("unauthorized", "Token missing type claim");
      }

      return {
        payload: tokenPayload,
        userId: tokenPayload.sub,
        email: tokenPayload.email,
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      if (error instanceof jose.errors.JWTExpired) {
        throw new AuthError("token_expired", "Token has expired");
      }

      if (error instanceof jose.errors.JWTClaimValidationFailed) {
        throw new AuthError("unauthorized", "Token validation failed");
      }

      if (
        error instanceof jose.errors.JWSSignatureVerificationFailed ||
        error instanceof jose.errors.JWSInvalid
      ) {
        throw new AuthError("unauthorized", "Invalid token signature");
      }

      // Generic JWT error
      throw new AuthError("unauthorized", "Invalid token");
    }
  }

  /**
   * Verify an access token specifically
   *
   * @param token - The JWT string to verify
   * @returns Promise resolving to verification result
   * @throws AuthError if token is invalid, expired, or not an access token
   */
  async verifyAccessToken(token: string): Promise<VerifyResult> {
    const result = await this.verifyToken(token);

    if (result.payload.type !== "access") {
      throw new AuthError("invalid_token_type", "Expected access token");
    }

    return result;
  }

  /**
   * Verify a refresh token specifically
   *
   * @param token - The JWT string to verify
   * @returns Promise resolving to verification result
   * @throws AuthError if token is invalid, expired, or not a refresh token
   */
  async verifyRefreshToken(token: string): Promise<VerifyResult> {
    const result = await this.verifyToken(token);

    if (result.payload.type !== "refresh") {
      throw new AuthError("invalid_token_type", "Expected refresh token");
    }

    return result;
  }
}

/**
 * Singleton AuthService instance
 */
let _authService: AuthService | null = null;

/**
 * Get the singleton AuthService instance
 *
 * @param secret - JWT secret (required on first call)
 * @returns AuthService instance
 */
export function getAuthService(secret?: string): AuthService {
  if (!_authService) {
    if (!secret) {
      throw new Error("AuthService not initialized. Provide JWT secret.");
    }
    _authService = new AuthService(secret);
  }
  return _authService;
}

/**
 * Initialize the AuthService with a secret
 *
 * @param secret - JWT secret
 * @returns AuthService instance
 */
export function initAuthService(secret: string): AuthService {
  _authService = new AuthService(secret);
  return _authService;
}

/**
 * Reset the singleton (for testing)
 */
export function resetAuthService(): void {
  _authService = null;
}
