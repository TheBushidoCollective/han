/**
 * GraphQL API Info Type
 *
 * Provides metadata about the API for discovery and documentation.
 *
 * @description The ApiInfo type exposes runtime information about the API
 * including version, environment, and feature flags. This is useful for:
 * - Client version compatibility checking
 * - Environment-specific behavior
 * - Feature discovery
 */

import { builder } from "../builder.ts";

/**
 * API information data shape.
 */
export interface ApiInfoData {
  /** API version string (semver format) */
  version: string;
  /** Current environment */
  environment: "development" | "staging" | "production";
  /** Whether introspection is enabled */
  introspectionEnabled: boolean;
  /** Available API features */
  features: string[];
}

/**
 * API info object reference.
 */
export const ApiInfoRef = builder.objectRef<ApiInfoData>("ApiInfo");

/**
 * API info GraphQL type implementation.
 *
 * @description Provides metadata about the running API instance.
 * Useful for client applications to check compatibility and available features.
 */
export const ApiInfoType = ApiInfoRef.implement({
  description:
    "Information about the Han Team Server API including version and capabilities",
  fields: (t) => ({
    version: t.exposeString("version", {
      description:
        "API version in semver format (e.g., '0.1.0'). Use for client compatibility checks.",
    }),
    environment: t.string({
      description:
        "Current deployment environment. Affects feature availability and error verbosity.",
      resolve: (info) => info.environment,
    }),
    introspectionEnabled: t.exposeBoolean("introspectionEnabled", {
      description:
        "Whether GraphQL introspection is enabled. Disabled in production for security.",
    }),
    features: t.exposeStringList("features", {
      description:
        "List of enabled API features. Check before using optional capabilities.",
    }),
  }),
});

/**
 * Create API info based on current environment.
 */
export function getApiInfo(
  env: "development" | "staging" | "production"
): ApiInfoData {
  return {
    version: "0.1.0",
    environment: env,
    introspectionEnabled: env !== "production",
    features: [
      "sessions",
      "teams",
      "organizations",
      "analytics",
      // Add feature flags as they're implemented
      ...(env !== "production" ? ["playground"] : []),
    ],
  };
}
