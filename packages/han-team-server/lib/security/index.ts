/**
 * Security module exports
 */
export {
  createSecretDetector,
  type DetectedSecret,
  type DetectionOptions,
  getSecretDetector,
  redactSecrets,
  type ScanResult,
  SecretDetector,
  type SecretType,
  type SensitivityLevel,
  scanForSecrets,
} from './secret-detector.ts';
