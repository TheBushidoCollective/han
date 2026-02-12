/**
 * Secret Detection Service for Han Team Platform
 *
 * Scans content for potential secrets and sensitive data.
 * Supports redaction to prevent accidental exposure.
 *
 * NOTE: This is a stub interface. Full implementation in unit-03-secret-detection.
 */

/**
 * Types of secrets that can be detected
 */
export type SecretType =
  | 'api_key'
  | 'aws_key'
  | 'github_token'
  | 'private_key'
  | 'password'
  | 'jwt'
  | 'database_url'
  | 'oauth_token'
  | 'generic_secret';

/**
 * Sensitivity levels for secret detection
 */
export type SensitivityLevel = 'standard' | 'strict' | 'permissive';

/**
 * A detected secret in content
 */
export interface DetectedSecret {
  /** Type of secret detected */
  type: SecretType;
  /** Pattern name that matched */
  patternName: string;
  /** Start position in content */
  startIndex: number;
  /** End position in content */
  endIndex: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Context around the secret (for logging, secret value redacted) */
  context: string;
}

/**
 * Result of a secret scan
 */
export interface ScanResult {
  /** Whether any secrets were found */
  hasSecrets: boolean;
  /** List of detected secrets */
  secrets: DetectedSecret[];
  /** Content with secrets redacted */
  redactedContent: string;
  /** Number of secrets found */
  secretCount: number;
}

/**
 * Options for secret detection
 */
export interface DetectionOptions {
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Secret types to detect (default: all) */
  types?: SecretType[];
  /** Custom patterns to detect */
  customPatterns?: Array<{
    name: string;
    pattern: RegExp;
    type: SecretType;
  }>;
}

/**
 * Default secret patterns
 */
const SECRET_PATTERNS: Array<{
  name: string;
  type: SecretType;
  pattern: RegExp;
  confidence: number;
}> = [
  // AWS keys
  {
    name: 'aws_access_key',
    type: 'aws_key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    confidence: 0.95,
  },
  {
    name: 'aws_secret_key',
    type: 'aws_key',
    pattern:
      /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)[=:\s]+['""]?([A-Za-z0-9/+=]{40})['""]?/gi,
    confidence: 0.9,
  },
  // GitHub tokens
  {
    name: 'github_token',
    type: 'github_token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    confidence: 0.95,
  },
  {
    name: 'github_fine_grained_pat',
    type: 'github_token',
    pattern: /github_pat_[A-Za-z0-9_]{22,}/g,
    confidence: 0.95,
  },
  // API keys (generic patterns)
  {
    name: 'api_key',
    type: 'api_key',
    pattern: /(?:api[_-]?key|apikey)[=:\s]+['""]?([A-Za-z0-9_-]{20,})['""]?/gi,
    confidence: 0.7,
  },
  // Private keys
  {
    name: 'private_key',
    type: 'private_key',
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    confidence: 0.99,
  },
  // JWTs
  {
    name: 'jwt',
    type: 'jwt',
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    confidence: 0.85,
  },
  // Database URLs with credentials
  {
    name: 'database_url',
    type: 'database_url',
    pattern:
      /(?:postgres|mysql|mongodb|redis)(?:ql)?:\/\/[^:]+:[^@]+@[^\s'"]+/gi,
    confidence: 0.9,
  },
  // Password patterns
  {
    name: 'password',
    type: 'password',
    pattern: /(?:password|passwd|pwd)[=:\s]+['""]?([^\s'"]{8,})['""]?/gi,
    confidence: 0.6,
  },
  // OAuth tokens
  {
    name: 'oauth_token',
    type: 'oauth_token',
    pattern:
      /(?:access_token|refresh_token|bearer)[=:\s]+['""]?([A-Za-z0-9_\-.]{20,})['""]?/gi,
    confidence: 0.75,
  },
  // Generic secrets (high entropy strings in suspicious contexts)
  {
    name: 'generic_secret',
    type: 'generic_secret',
    pattern:
      /(?:secret|token|key|credential)[=:\s]+['""]?([A-Za-z0-9_\-/+=]{16,})['""]?/gi,
    confidence: 0.5,
  },
];

/**
 * Redaction placeholder
 */
const REDACTION_PLACEHOLDER = '[REDACTED]';

/**
 * Secret Detector Service
 *
 * Scans content for potential secrets and sensitive data.
 */
export class SecretDetector {
  private patterns = SECRET_PATTERNS;
  private defaultMinConfidence = 0.5;

  /**
   * Scan content for secrets
   */
  scan(content: string, options: DetectionOptions = {}): ScanResult {
    const minConfidence = options.minConfidence ?? this.defaultMinConfidence;
    const typesToDetect = options.types ?? null;
    const secrets: DetectedSecret[] = [];

    // Add custom patterns if provided
    const allPatterns = options.customPatterns
      ? [
          ...this.patterns,
          ...options.customPatterns.map((p) => ({
            ...p,
            confidence: 0.8,
          })),
        ]
      : this.patterns;

    // Scan with each pattern
    for (const { name, type, pattern, confidence } of allPatterns) {
      // Skip if type filtering enabled and this type not included
      if (typesToDetect && !typesToDetect.includes(type)) {
        continue;
      }

      // Skip if below confidence threshold
      if (confidence < minConfidence) {
        continue;
      }

      // Reset regex state for global patterns
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        const startIndex = match.index;
        const endIndex = match.index + match[0].length;

        // Extract context (surrounding characters, with the secret itself redacted)
        const contextStart = Math.max(0, startIndex - 20);
        const contextEnd = Math.min(content.length, endIndex + 20);
        const beforeSecret = content.slice(contextStart, startIndex);
        const afterSecret = content.slice(endIndex, contextEnd);
        const context = `...${beforeSecret}${REDACTION_PLACEHOLDER}${afterSecret}...`;

        secrets.push({
          type,
          patternName: name,
          startIndex,
          endIndex,
          confidence,
          context,
        });
      }
    }

    // Sort by position (descending for safe redaction)
    secrets.sort((a, b) => b.startIndex - a.startIndex);

    // Redact secrets from content
    let redactedContent = content;
    for (const secret of secrets) {
      redactedContent =
        redactedContent.slice(0, secret.startIndex) +
        REDACTION_PLACEHOLDER +
        redactedContent.slice(secret.endIndex);
    }

    // Re-sort by position (ascending for reporting)
    secrets.sort((a, b) => a.startIndex - b.startIndex);

    return {
      hasSecrets: secrets.length > 0,
      secrets,
      redactedContent,
      secretCount: secrets.length,
    };
  }

  /**
   * Quick check if content likely contains secrets
   */
  hasSecrets(content: string, options: DetectionOptions = {}): boolean {
    return this.scan(content, options).hasSecrets;
  }

  /**
   * Redact secrets from content without detailed results
   */
  redact(content: string, options: DetectionOptions = {}): string {
    return this.scan(content, options).redactedContent;
  }

  /**
   * Get summary of secret types found (for logging without exposing values)
   */
  getSummary(
    content: string,
    options: DetectionOptions = {}
  ): Record<SecretType, number> {
    const result = this.scan(content, options);
    const summary: Partial<Record<SecretType, number>> = {};

    for (const secret of result.secrets) {
      summary[secret.type] = (summary[secret.type] || 0) + 1;
    }

    return summary as Record<SecretType, number>;
  }
}

/**
 * Singleton instance
 */
let _instance: SecretDetector | null = null;

/**
 * Get the secret detector instance
 */
export function getSecretDetector(): SecretDetector {
  if (!_instance) {
    _instance = new SecretDetector();
  }
  return _instance;
}

/**
 * Create a new SecretDetector instance with optional sensitivity
 */
export function createSecretDetector(options?: {
  sensitivity?: SensitivityLevel;
}): SecretDetector {
  const detector = new SecretDetector();
  // Sensitivity can be used to adjust minConfidence in future
  if (options?.sensitivity) {
    // Currently all sensitivities use the same detector
    // Future: adjust thresholds based on sensitivity level
  }
  return detector;
}

/**
 * Convenience function to scan content for secrets using default detector
 */
export function scanForSecrets(
  content: string,
  options?: DetectionOptions
): DetectedSecret[] {
  return getSecretDetector().scan(content, options).secrets;
}

/**
 * Convenience function to redact secrets from content using default detector
 */
export function redactSecrets(
  content: string,
  options?: DetectionOptions
): string {
  return getSecretDetector().redact(content, options);
}
