/**
 * Security module exports
 */
export {
  SecretDetector,
  getSecretDetector,
  createSecretDetector,
  scanForSecrets,
  redactSecrets,
  type SecretType,
  type SensitivityLevel,
  type SecretDetectorOptions,
  type DetectedSecret,
  type ScanResult,
  type DetectionOptions,
} from "./secret-detector.ts";
