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

import { SecretDetector, getSecretDetector, type DetectionOptions, type ScanResult } from "./secret-detector.ts";

/**
 * Options for creating a new SecretDetector instance
 */
export interface CreateDetectorOptions {
  /** Sensitivity level for detection */
  sensitivity?: "strict" | "normal" | "relaxed";
}

/**
 * Factory function to create a new SecretDetector instance
 */
export function createSecretDetector(_options?: CreateDetectorOptions): SecretDetector {
  // Options are reserved for future use (sensitivity levels, etc.)
  return new SecretDetector();
}

/**
 * Convenience function to scan content for secrets
 * Wraps SecretDetector.scan() for quick usage
 */
export function scanForSecrets(content: string, options?: DetectionOptions): ScanResult {
  return getSecretDetector().scan(content, options);
}

/**
 * Convenience function to redact secrets from content
 * Wraps SecretDetector.redact() for quick usage
 */
export function redactSecrets(content: string, options?: DetectionOptions): string {
  return getSecretDetector().redact(content, options);
}
