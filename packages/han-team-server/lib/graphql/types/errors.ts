/**
 * GraphQL Error Types
 *
 * Defines standardized error types for the API. Errors are returned as
 * part of union types or as structured error objects rather than throwing.
 *
 * @description Error types provide structured, type-safe error handling.
 * Each error type includes:
 * - A machine-readable error code
 * - A human-readable message
 * - Optional additional context
 *
 * Clients can pattern match on error types for specific handling.
 */

import { builder } from "../builder.ts";

/**
 * Error code enum for machine-readable error identification.
 *
 * @description These codes are stable and can be used for:
 * - Client-side error handling logic
 * - Error tracking and metrics
 * - Internationalization (mapping codes to localized messages)
 */
export const ErrorCodeEnum = builder.enumType("ErrorCode", {
  description: "Machine-readable error codes for programmatic error handling",
  values: {
    // Authentication errors (1xx)
    UNAUTHENTICATED: {
      value: "UNAUTHENTICATED",
      description: "No valid authentication token provided",
    },
    INVALID_TOKEN: {
      value: "INVALID_TOKEN",
      description: "Authentication token is malformed or expired",
    },
    INSUFFICIENT_PERMISSIONS: {
      value: "INSUFFICIENT_PERMISSIONS",
      description: "User lacks required permissions for this action",
    },

    // Resource errors (2xx)
    NOT_FOUND: {
      value: "NOT_FOUND",
      description: "Requested resource does not exist",
    },
    ALREADY_EXISTS: {
      value: "ALREADY_EXISTS",
      description:
        "Resource with this identifier already exists (duplicate slug, etc.)",
    },

    // Validation errors (3xx)
    VALIDATION_ERROR: {
      value: "VALIDATION_ERROR",
      description: "Input validation failed (see message for details)",
    },
    INVALID_INPUT: {
      value: "INVALID_INPUT",
      description: "Input format is invalid",
    },

    // Rate limiting (4xx)
    RATE_LIMITED: {
      value: "RATE_LIMITED",
      description: "Too many requests, please slow down",
    },

    // Server errors (5xx)
    INTERNAL_ERROR: {
      value: "INTERNAL_ERROR",
      description: "Unexpected server error occurred",
    },
    SERVICE_UNAVAILABLE: {
      value: "SERVICE_UNAVAILABLE",
      description: "Service is temporarily unavailable",
    },
  },
});

/**
 * All possible error codes as a type.
 */
export type ErrorCodeValue =
  | "UNAUTHENTICATED"
  | "INVALID_TOKEN"
  | "INSUFFICIENT_PERMISSIONS"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "VALIDATION_ERROR"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

/**
 * Base error data shape.
 */
export interface BaseErrorData {
  /** Error code for programmatic handling */
  code: ErrorCodeValue;
  /** Human-readable error message */
  message: string;
  /** Additional context (e.g., field names for validation errors) */
  details?: Record<string, unknown>;
}

/**
 * Authentication error data.
 */
export interface AuthErrorData {
  code: "UNAUTHENTICATED" | "INVALID_TOKEN" | "INSUFFICIENT_PERMISSIONS";
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Validation error data with field-level details.
 */
export interface ValidationErrorData {
  code: "VALIDATION_ERROR" | "INVALID_INPUT";
  message: string;
  details?: Record<string, unknown>;
  /** Fields that failed validation */
  fields?: Array<{ field: string; message: string }>;
}

/**
 * Base error object reference.
 */
export const BaseErrorRef = builder.objectRef<BaseErrorData>("BaseError");

/**
 * Authentication error object reference.
 */
export const AuthErrorRef = builder.objectRef<AuthErrorData>("AuthError");

/**
 * Validation error field type.
 */
export interface FieldErrorData {
  field: string;
  message: string;
}

export const FieldErrorRef = builder.objectRef<FieldErrorData>("FieldError");

export const FieldErrorType = FieldErrorRef.implement({
  description: "A validation error for a specific input field",
  fields: (t) => ({
    field: t.exposeString("field", {
      description: "Name of the field that failed validation",
    }),
    message: t.exposeString("message", {
      description: "Validation error message for this field",
    }),
  }),
});

/**
 * Validation error object reference.
 */
export const ValidationErrorRef =
  builder.objectRef<ValidationErrorData>("ValidationError");

/**
 * Base error type implementation.
 *
 * @description Generic error type for server errors and unexpected conditions.
 */
export const BaseErrorType = BaseErrorRef.implement({
  description: "Base error type for unexpected or server errors",
  fields: (t) => ({
    code: t.field({
      type: ErrorCodeEnum,
      description: "Machine-readable error code",
      resolve: (error) => error.code,
    }),
    message: t.exposeString("message", {
      description:
        "Human-readable error message. May be shown to users directly.",
    }),
  }),
});

/**
 * Authentication error type implementation.
 *
 * @description Used for authentication and authorization failures.
 */
export const AuthErrorType = AuthErrorRef.implement({
  description: "Error related to authentication or authorization",
  fields: (t) => ({
    code: t.field({
      type: ErrorCodeEnum,
      description: "Authentication error code",
      resolve: (error) => error.code,
    }),
    message: t.exposeString("message", {
      description: "Description of the authentication failure",
    }),
  }),
});

/**
 * Validation error type implementation.
 *
 * @description Used for input validation failures. Includes field-level details.
 */
export const ValidationErrorType = ValidationErrorRef.implement({
  description: "Input validation error with field-level details",
  fields: (t) => ({
    code: t.field({
      type: ErrorCodeEnum,
      description: "Validation error code",
      resolve: (error) => error.code,
    }),
    message: t.exposeString("message", {
      description: "Overall validation error message",
    }),
    fields: t.field({
      type: [FieldErrorRef],
      nullable: true,
      description: "List of fields that failed validation with specific errors",
      resolve: (error) => error.fields ?? null,
    }),
  }),
});
