/**
 * Security module exports
 */
export {
  SecretDetector,
  getSecretDetector,
  type SecretType,
  type DetectedSecret,
  type ScanResult,
  type DetectionOptions,
} from "./secret-detector.ts";

import { SecretDetector, getSecretDetector, type DetectedSecret, type DetectionOptions } from "./secret-detector.ts";

/**
 * Sensitivity level for secret detection.
 */
export type SensitivityLevel = "strict" | "normal" | "permissive";

/**
 * Options for creating a secret detector.
 */
export interface CreateDetectorOptions {
  sensitivity?: SensitivityLevel;
}

/**
 * Create a new SecretDetector instance with optional configuration.
 */
export function createSecretDetector(_options: CreateDetectorOptions = {}): SecretDetector {
  return new SecretDetector();
}

/**
 * Convenience wrapper for scanning content for secrets.
 * Returns the array of detected secrets.
 */
export function scanForSecrets(
  content: string,
  options: DetectionOptions = {}
): DetectedSecret[] {
  return getSecretDetector().scan(content, options).secrets;
}

/**
 * Convenience wrapper for redacting secrets from content.
 * Uses the singleton SecretDetector instance.
 */
export function redactSecrets(
  content: string,
  options: DetectionOptions = {}
): string {
  return getSecretDetector().redact(content, options);
}
