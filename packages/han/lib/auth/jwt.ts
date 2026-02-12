/**
 * JWT Utilities
 *
 * JWT creation and verification using jose library.
 * Supports access tokens (1 hour) and refresh tokens (7 days).
 */

import { randomUUID } from 'node:crypto';
import * as jose from 'jose';
import { hashSHA256 } from './encryption.ts';
import type {
  AccessTokenPayload,
  AuthConfig,
  RefreshTokenPayload,
  TokenPair,
} from './types.ts';

/**
 * Create a new access token
 *
 * @param userId - User ID to include in the token
 * @param sessionId - Session ID for tracking
 * @param config - Auth configuration
 * @param email - Optional email to include in payload
 * @returns Signed JWT access token
 */
export async function createAccessToken(
  userId: string,
  sessionId: string,
  config: AuthConfig,
  email?: string
): Promise<string> {
  const secret = new TextEncoder().encode(config.jwtSecret);
  const expiresIn = config.accessTokenExpiry || 3600;

  const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
    sub: userId,
    jti: randomUUID(),
    iss: config.jwtIssuer,
    sid: sessionId,
    type: 'access',
    ...(email && { email }),
  };

  return await new jose.SignJWT(payload as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret);
}

/**
 * Create a new refresh token
 *
 * @param userId - User ID to include in the token
 * @param sessionId - Session ID for tracking
 * @param config - Auth configuration
 * @returns Signed JWT refresh token
 */
export async function createRefreshToken(
  userId: string,
  sessionId: string,
  config: AuthConfig
): Promise<string> {
  const secret = new TextEncoder().encode(config.jwtSecret);
  const expiresIn = config.refreshTokenExpiry || 604800;

  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    sub: userId,
    jti: randomUUID(),
    iss: config.jwtIssuer,
    sid: sessionId,
    type: 'refresh',
  };

  return await new jose.SignJWT(payload as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret);
}

/**
 * Create a token pair (access + refresh tokens)
 *
 * @param userId - User ID
 * @param sessionId - Session ID
 * @param config - Auth configuration
 * @param email - Optional user email
 * @returns Token pair with expiration dates
 */
export async function createTokenPair(
  userId: string,
  sessionId: string,
  config: AuthConfig,
  email?: string
): Promise<TokenPair> {
  const now = new Date();
  const accessTokenExpiry = config.accessTokenExpiry || 3600;
  const refreshTokenExpiry = config.refreshTokenExpiry || 604800;

  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(userId, sessionId, config, email),
    createRefreshToken(userId, sessionId, config),
  ]);

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date(now.getTime() + accessTokenExpiry * 1000),
    refreshTokenExpiresAt: new Date(now.getTime() + refreshTokenExpiry * 1000),
  };
}

/**
 * Verify and decode an access token
 *
 * @param token - JWT to verify
 * @param config - Auth configuration
 * @returns Decoded payload or null if invalid
 */
export async function verifyAccessToken(
  token: string,
  config: AuthConfig
): Promise<AccessTokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(config.jwtSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: config.jwtIssuer,
    });

    // Validate token type
    const typedPayload = payload as unknown as AccessTokenPayload;
    if (typedPayload.type !== 'access') {
      return null;
    }

    return typedPayload;
  } catch {
    return null;
  }
}

/**
 * Verify and decode a refresh token
 *
 * @param token - JWT to verify
 * @param config - Auth configuration
 * @returns Decoded payload or null if invalid
 */
export async function verifyRefreshToken(
  token: string,
  config: AuthConfig
): Promise<RefreshTokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(config.jwtSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: config.jwtIssuer,
    });

    // Validate token type
    const typedPayload = payload as unknown as RefreshTokenPayload;
    if (typedPayload.type !== 'refresh') {
      return null;
    }

    return typedPayload;
  } catch {
    return null;
  }
}

/**
 * Decode a token without verification (for debugging/logging)
 * WARNING: This does not verify the signature!
 *
 * @param token - JWT to decode
 * @returns Decoded payload or null if malformed
 */
export function decodeTokenUnsafe(
  token: string
): AccessTokenPayload | RefreshTokenPayload | null {
  try {
    const decoded = jose.decodeJwt(token);
    return decoded as unknown as AccessTokenPayload | RefreshTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Get token hash for session lookup
 * Uses SHA-256 to create a lookup key without storing the actual token
 *
 * @param token - JWT token
 * @returns SHA-256 hash of the token
 */
export function getTokenHash(token: string): string {
  return hashSHA256(token);
}

/**
 * Extract the session ID from a token (without full verification)
 *
 * @param token - JWT token
 * @returns Session ID or null if not found
 */
export function extractSessionId(token: string): string | null {
  const decoded = decodeTokenUnsafe(token);
  return decoded?.sid || null;
}

/**
 * Check if a token is expired (without verification)
 *
 * @param token - JWT token
 * @returns true if expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeTokenUnsafe(token);
  if (!decoded?.exp) {
    return true;
  }
  return decoded.exp * 1000 < Date.now();
}

/**
 * Generate a JWT secret key
 *
 * @returns 64-character hex string (256 bits)
 */
export function generateJWTSecret(): string {
  const { randomBytes } = require('node:crypto');
  return randomBytes(32).toString('hex');
}
