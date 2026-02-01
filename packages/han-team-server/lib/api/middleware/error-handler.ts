/**
 * Error Handler Middleware for Han Team Platform
 *
 * Sanitizes error responses to prevent leaking sensitive information
 * about encryption, keys, or internal system details.
 */

import type { Context, Next, ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { EncryptionNotAvailableError } from "../../crypto/index.ts";
import { DecryptionError } from "../../services/index.ts";
import { AuthError } from "../../auth/index.ts";

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  message: string;
  requestId?: string;
}

/**
 * Errors that are safe to expose details about
 */
const SAFE_ERROR_TYPES = new Set([
  "ValidationError",
  "NotFoundError",
  "ConflictError",
]);

/**
 * Error messages that should be sanitized
 */
const SENSITIVE_PATTERNS = [
  /key/i,
  /secret/i,
  /encrypt/i,
  /decrypt/i,
  /cipher/i,
  /nonce/i,
  /iv/i,
  /token/i,
  /password/i,
  /credential/i,
  /auth/i,
  /database/i,
  /sql/i,
  /connection/i,
  /internal/i,
];

/**
 * Check if an error message contains sensitive information
 */
function containsSensitiveInfo(message: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Get a safe error message for the response
 */
function getSafeMessage(error: Error): string {
  // Known safe error types
  if (SAFE_ERROR_TYPES.has(error.name)) {
    return error.message;
  }

  // Auth errors - return the message as-is (already sanitized)
  if (error instanceof AuthError) {
    return error.message;
  }

  // Encryption-specific errors with safe messages
  if (error instanceof EncryptionNotAvailableError) {
    return "Encryption service is not currently available. Please try again later.";
  }

  if (error instanceof DecryptionError) {
    return "Unable to access the requested data. Please verify your permissions.";
  }

  // Check for sensitive patterns
  if (containsSensitiveInfo(error.message)) {
    return "An error occurred while processing your request.";
  }

  // Default to generic message for unknown errors
  return "An unexpected error occurred. Please try again later.";
}

/**
 * Get HTTP status code for an error
 */
function getStatusCode(error: Error): number {
  // Auth errors always return 401
  if (error instanceof AuthError) {
    return 401;
  }

  // Check error name for known types
  switch (error.name) {
    case "ValidationError":
      return 400;
    case "UnauthorizedError":
    case "AuthError":
      return 401;
    case "ForbiddenError":
      return 403;
    case "NotFoundError":
      return 404;
    case "ConflictError":
      return 409;
    case "EncryptionNotAvailableError":
      return 503; // Service Unavailable
    case "DecryptionError":
      return 403; // Forbidden (likely key access issue)
    default:
      return 500;
  }
}

/**
 * Get error code for the response
 */
function getErrorCode(error: Error): string {
  // Auth errors have their own code
  if (error instanceof AuthError) {
    return error.code;
  }

  switch (error.name) {
    case "ValidationError":
      return "validation_error";
    case "UnauthorizedError":
      return "unauthorized";
    case "ForbiddenError":
      return "forbidden";
    case "NotFoundError":
      return "not_found";
    case "ConflictError":
      return "conflict";
    case "EncryptionNotAvailableError":
      return "service_unavailable";
    case "DecryptionError":
      return "access_denied";
    default:
      return "internal_error";
  }
}

/**
 * Create error response from an error
 */
function createErrorResponse(error: Error, requestId: string): { body: ErrorResponse; status: number } {
  const statusCode = getStatusCode(error);
  const errorCode = getErrorCode(error);
  const safeMessage = getSafeMessage(error);

  return {
    body: {
      error: errorCode,
      message: safeMessage,
      requestId,
    },
    status: statusCode,
  };
}

/**
 * Global error handler for Hono onError
 *
 * Catches all errors and returns sanitized responses.
 */
export const onErrorHandler: ErrorHandler = (error, c) => {
  const requestId = c.req.header("x-request-id") || crypto.randomUUID();

  if (error instanceof Error) {
    // Log with request ID for correlation
    console.error(`[${requestId}] Error:`, {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });

    const { body, status } = createErrorResponse(error, requestId);
    return c.json(body, status as 400 | 401 | 403 | 404 | 409 | 500 | 503);
  }

  // Unknown error type
  console.error(`[${requestId}] Unknown error:`, error);

  return c.json(
    {
      error: "internal_error",
      message: "An unexpected error occurred.",
      requestId,
    },
    500
  );
};

/**
 * Global error handler middleware (legacy wrapper)
 *
 * Catches all errors and returns sanitized responses.
 */
export async function errorHandler(
  c: Context,
  next: Next
): Promise<Response | void> {
  try {
    await next();
  } catch (error) {
    return onErrorHandler(error as Error, c);
  }
}

/**
 * Custom error classes for API responses
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
