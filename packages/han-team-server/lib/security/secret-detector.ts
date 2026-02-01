/**
 * Secret Detection Service for Han Team Platform
 *
 * Scans content for potential secrets and sensitive data.
 * Supports redaction to prevent accidental exposure.
 */

/**
 * Types of secrets that can be detected
 */
export type SecretType =
  | "api_key"
  | "token"
  | "private_key"
  | "password"
  | "connection_string"
  | "generic_secret";

/**
 * A detected secret in content
 */
export interface DetectedSecret {
  /** Type of secret detected */
  type: SecretType;
  /** Pattern name that matched */
  patternName: string;
  /** The matched secret value */
  value: string;
  /** Start position in content */
  startIndex: number;
  /** End position in content */
  endIndex: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Description of the pattern */
  description: string;
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
 * Sensitivity level for secret detection
 */
export type SensitivityLevel = "strict" | "normal" | "permissive";

/**
 * Custom pattern definition
 */
export interface CustomPattern {
  name: string;
  type: SecretType;
  pattern: RegExp;
  description: string;
}

/**
 * Options for creating a SecretDetector instance
 */
export interface SecretDetectorOptions {
  /** Sensitivity level (default: normal) */
  sensitivity?: SensitivityLevel;
  /** Minimum confidence threshold (0-1) - overrides sensitivity default */
  minConfidence?: number;
  /** Enable entropy-based detection (default: true) */
  enableEntropyDetection?: boolean;
  /** Enable preprocessing for unicode normalization (default: true) */
  enablePreprocessing?: boolean;
  /** Enable Base64 decoding detection (default: true) */
  enableBase64Decoding?: boolean;
  /** Custom patterns to add */
  customPatterns?: CustomPattern[];
  /** Pattern names to exclude */
  excludePatterns?: string[];
}

/**
 * Options for secret detection scan operations
 */
export interface DetectionOptions {
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Secret types to detect (default: all) */
  types?: SecretType[];
}

/**
 * Pattern definition
 */
interface PatternDef {
  name: string;
  type: SecretType;
  pattern: RegExp;
  confidence: number;
  description: string;
}

/**
 * Default secret patterns - expanded to cover common services
 */
const SECRET_PATTERNS: PatternDef[] = [
  // AWS keys
  {
    name: "aws_access_key",
    type: "api_key",
    pattern: /AKIA[0-9A-Z]{16}/g,
    confidence: 0.95,
    description: "AWS Access Key ID",
  },
  {
    name: "aws_secret_key",
    type: "api_key",
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)[=:\s]+["']?([A-Za-z0-9/+=]{40})["']?/gi,
    confidence: 0.9,
    description: "AWS Secret Access Key",
  },
  // GitHub tokens
  {
    name: "github_pat",
    type: "token",
    pattern: /ghp_[A-Za-z0-9_]{36,}/g,
    confidence: 0.95,
    description: "GitHub Personal Access Token",
  },
  {
    name: "github_server_token",
    type: "token",
    pattern: /ghs_[A-Za-z0-9_]{36,}/g,
    confidence: 0.95,
    description: "GitHub Server Token",
  },
  {
    name: "github_oauth",
    type: "token",
    pattern: /gho_[A-Za-z0-9_]{36,}/g,
    confidence: 0.95,
    description: "GitHub OAuth Token",
  },
  {
    name: "github_user_token",
    type: "token",
    pattern: /ghu_[A-Za-z0-9_]{36,}/g,
    confidence: 0.95,
    description: "GitHub User Token",
  },
  {
    name: "github_refresh_token",
    type: "token",
    pattern: /ghr_[A-Za-z0-9_]{36,}/g,
    confidence: 0.95,
    description: "GitHub Refresh Token",
  },
  {
    name: "github_fine_grained_pat",
    type: "token",
    pattern: /github_pat_[A-Za-z0-9_]{22,}/g,
    confidence: 0.95,
    description: "GitHub Fine-Grained Personal Access Token",
  },
  // Stripe keys
  {
    name: "stripe_live_key",
    type: "api_key",
    pattern: /sk_live_[A-Za-z0-9]{24,}/g,
    confidence: 0.95,
    description: "Stripe Live Secret Key",
  },
  {
    name: "stripe_test_key",
    type: "api_key",
    pattern: /sk_test_[A-Za-z0-9]{24,}/g,
    confidence: 0.90,
    description: "Stripe Test Secret Key",
  },
  // Private keys
  {
    name: "private_key",
    type: "private_key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    confidence: 0.99,
    description: "Private Key",
  },
  {
    name: "private_key_header",
    type: "private_key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
    confidence: 0.99,
    description: "Private Key Header",
  },
  // Connection strings
  {
    name: "postgres_connection",
    type: "connection_string",
    pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^\s"']+/gi,
    confidence: 0.95,
    description: "PostgreSQL Connection String",
  },
  {
    name: "mongodb_connection",
    type: "connection_string",
    pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^\s"']+/gi,
    confidence: 0.95,
    description: "MongoDB Connection String",
  },
  {
    name: "redis_connection",
    type: "connection_string",
    pattern: /redis:\/\/[^:]+:[^@]+@[^\s"']+/gi,
    confidence: 0.95,
    description: "Redis Connection String",
  },
  // JWT/Bearer tokens
  {
    name: "bearer_jwt",
    type: "token",
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    confidence: 0.85,
    description: "JWT Token",
  },
  // AI Service keys
  {
    name: "anthropic_api_key",
    type: "api_key",
    pattern: /sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{93}/g,
    confidence: 0.95,
    description: "Anthropic API Key",
  },
  {
    name: "google_api_key",
    type: "api_key",
    pattern: /AIzaSy[A-Za-z0-9_-]{33}/g,
    confidence: 0.90,
    description: "Google API Key",
  },
  // Slack tokens
  {
    name: "slack_bot_token",
    type: "token",
    pattern: /xoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+/g,
    confidence: 0.95,
    description: "Slack Bot Token",
  },
  {
    name: "slack_webhook",
    type: "api_key",
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g,
    confidence: 0.95,
    description: "Slack Webhook URL",
  },
  // NPM tokens
  {
    name: "npm_token",
    type: "token",
    pattern: /npm_[A-Za-z0-9]{36,}/g,
    confidence: 0.95,
    description: "NPM Token",
  },
  // Email service keys
  {
    name: "sendgrid_api_key",
    type: "api_key",
    pattern: /SG\.[A-Za-z0-9_-]{22,}\.[A-Za-z0-9_-]{43,}/g,
    confidence: 0.95,
    description: "SendGrid API Key",
  },
  {
    name: "mailgun_api_key",
    type: "api_key",
    pattern: /key-[A-Za-z0-9]{32}/g,
    confidence: 0.90,
    description: "Mailgun API Key",
  },
  // Generic patterns - lower confidence
  {
    name: "generic_api_key",
    type: "api_key",
    pattern: /(?:api[_-]?key|apikey)[=:\s]+["']?([A-Za-z0-9_\-]{20,})["']?/gi,
    confidence: 0.6,
    description: "Generic API Key",
  },
  {
    name: "generic_password",
    type: "password",
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']([^"'\s]{8,64})["']/gi,
    confidence: 0.6,
    description: "Password Assignment",
  },
  {
    name: "generic_secret",
    type: "generic_secret",
    pattern: /(?:secret|token|key|credential)[=:\s]+["']?([A-Za-z0-9_\-/+=]{20,})["']?/gi,
    confidence: 0.5,
    description: "Generic Secret",
  },
];

/**
 * Default confidence thresholds by sensitivity level
 */
const SENSITIVITY_THRESHOLDS: Record<SensitivityLevel, number> = {
  strict: 0.3,
  normal: 0.5,
  permissive: 0.7,
};

/**
 * Confidence adjustments by sensitivity level
 */
const SENSITIVITY_CONFIDENCE_BOOST: Record<SensitivityLevel, number> = {
  strict: 0.1,
  normal: 0,
  permissive: -0.1,
};

/**
 * Unicode confusable characters mapping
 */
const UNICODE_CONFUSABLES: Record<string, string> = {
  "\u0410": "A", // Cyrillic A
  "\u0412": "B", // Cyrillic B
  "\u0421": "C", // Cyrillic C
  "\u0415": "E", // Cyrillic E
  "\u041A": "K", // Cyrillic K
  "\u041C": "M", // Cyrillic M
  "\u041D": "H", // Cyrillic N looks like H
  "\u041E": "O", // Cyrillic O
  "\u0420": "P", // Cyrillic P
  "\u0422": "T", // Cyrillic T
  "\u0425": "X", // Cyrillic X
  "\u0430": "a", // Cyrillic lowercase a
  "\u0435": "e", // Cyrillic lowercase e
  "\u043E": "o", // Cyrillic lowercase o
  "\u0440": "p", // Cyrillic lowercase p
  "\u0441": "c", // Cyrillic lowercase c
  "\u0443": "y", // Cyrillic lowercase y
  "\u0445": "x", // Cyrillic lowercase x
  // Fullwidth characters
  "\uFF21": "A",
  "\uFF22": "B",
  "\uFF23": "C",
  "\uFF24": "D",
  "\uFF25": "E",
  "\uFF26": "F",
  "\uFF27": "G",
  "\uFF28": "H",
  "\uFF29": "I",
  "\uFF2A": "J",
  "\uFF2B": "K",
  "\uFF2C": "L",
  "\uFF2D": "M",
  "\uFF2E": "N",
  "\uFF2F": "O",
  "\uFF30": "P",
  "\uFF31": "Q",
  "\uFF32": "R",
  "\uFF33": "S",
  "\uFF34": "T",
  "\uFF35": "U",
  "\uFF36": "V",
  "\uFF37": "W",
  "\uFF38": "X",
  "\uFF39": "Y",
  "\uFF3A": "Z",
  "\uFF41": "a",
  "\uFF42": "b",
  "\uFF43": "c",
  "\uFF44": "d",
  "\uFF45": "e",
  "\uFF46": "f",
  "\uFF47": "g",
  "\uFF48": "h",
  "\uFF49": "i",
  "\uFF4A": "j",
  "\uFF4B": "k",
  "\uFF4C": "l",
  "\uFF4D": "m",
  "\uFF4E": "n",
  "\uFF4F": "o",
  "\uFF50": "p",
  "\uFF51": "q",
  "\uFF52": "r",
  "\uFF53": "s",
  "\uFF54": "t",
  "\uFF55": "u",
  "\uFF56": "v",
  "\uFF57": "w",
  "\uFF58": "x",
  "\uFF59": "y",
  "\uFF5A": "z",
};

/**
 * Zero-width characters to remove
 */
const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\uFEFF]/g;

/**
 * Secret Detector Service
 *
 * Scans content for potential secrets and sensitive data.
 */
export class SecretDetector {
  private patterns: PatternDef[];
  private defaultMinConfidence: number;
  private sensitivity: SensitivityLevel;
  private enableEntropyDetection: boolean;
  private enablePreprocessing: boolean;
  private enableBase64Decoding: boolean;
  private excludePatterns: Set<string>;

  constructor(options: SecretDetectorOptions = {}) {
    this.sensitivity = options.sensitivity ?? "normal";
    this.defaultMinConfidence =
      options.minConfidence ?? SENSITIVITY_THRESHOLDS[this.sensitivity];
    this.enableEntropyDetection = options.enableEntropyDetection ?? true;
    this.enablePreprocessing = options.enablePreprocessing ?? true;
    this.enableBase64Decoding = options.enableBase64Decoding ?? true;
    this.excludePatterns = new Set(options.excludePatterns ?? []);

    // Start with custom patterns (higher priority than default)
    const customPatterns: PatternDef[] = [];
    if (options.customPatterns) {
      for (const cp of options.customPatterns) {
        customPatterns.push({
          name: cp.name,
          type: cp.type,
          pattern: cp.pattern,
          confidence: 0.8,
          description: cp.description,
        });
      }
    }

    // Then add default patterns
    const defaultPatterns = SECRET_PATTERNS.filter(
      (p) => !this.excludePatterns.has(p.name)
    );

    // Custom patterns first, then default patterns
    this.patterns = [...customPatterns, ...defaultPatterns];
  }

  /**
   * Preprocess content for better detection
   */
  private preprocess(content: string): string {
    if (!this.enablePreprocessing) {
      return content;
    }

    let processed = content;

    // Remove zero-width characters
    processed = processed.replace(ZERO_WIDTH_CHARS, "");

    // Replace unicode confusables
    for (const [confusable, replacement] of Object.entries(UNICODE_CONFUSABLES)) {
      processed = processed.split(confusable).join(replacement);
    }

    return processed;
  }

  /**
   * Calculate Shannon entropy of a string
   */
  private calculateEntropy(str: string): number {
    const len = str.length;
    if (len === 0) return 0;

    const freq: Record<string, number> = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Check if string looks like a UUID
   */
  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  /**
   * Check if string looks like a hash
   */
  private isHash(str: string, context: string): boolean {
    // Check for hash labels in context
    if (/(?:sha\d*|md5|hash|commit|integrity)[:=\s]/i.test(context)) {
      // Verify it looks like a hex string
      if (/^[0-9a-f]+$/i.test(str)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if string is an example/placeholder
   *
   * NOTE: We are very conservative here to avoid filtering out real secrets.
   * Only filter when context STRONGLY indicates this is documentation.
   */
  private isExamplePlaceholder(str: string, context: string): boolean {
    const lowerStr = str.toLowerCase();
    const lowerContext = context.toLowerCase();

    // Check for obvious placeholder patterns in the value itself
    // that are definitely not real keys (like "your_api_key_here")
    const isPlaceholderValue =
      lowerStr.includes("your_") ||
      lowerStr.includes("_here") ||
      lowerStr.includes("placeholder") ||
      lowerStr === "your_api_key" ||
      lowerStr === "your_secret_key";

    // Check for documentation/example context that explicitly labels it as example
    const isExampleContext =
      lowerContext.includes("// example") ||
      lowerContext.includes("/* example") ||
      lowerContext.includes("# example") ||
      lowerContext.includes("example api key");

    return isPlaceholderValue || isExampleContext;
  }

  /**
   * Check if string is a data URI
   */
  private isDataURI(context: string): boolean {
    return /data:[^;]+;base64,/i.test(context);
  }

  /**
   * Detect high-entropy segments using sliding window
   */
  private detectEntropySecrets(content: string): DetectedSecret[] {
    if (!this.enableEntropyDetection) {
      return [];
    }

    const secrets: DetectedSecret[] = [];
    const minLength = 20;
    const windowSize = 32;
    const entropyThreshold = 4.0; // Bits per character threshold
    const seenRanges: Array<[number, number]> = [];

    // Helper to check if position is already covered
    const isCovered = (start: number, end: number): boolean => {
      return seenRanges.some(([s, e]) => start >= s && end <= e);
    };

    // First pass: Find quoted strings or likely secret values after keywords
    const valuePattern = /["']([A-Za-z0-9_\-/+=]{20,})["']|(?:secret|key|token)[=:\s]+([A-Za-z0-9_\-/+=]{20,})/gi;
    let match;

    while ((match = valuePattern.exec(content)) !== null) {
      const value = match[1] || match[2];
      if (!value || value.length < minLength) continue;

      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(content.length, match.index + match[0].length + 50);
      const context = content.slice(contextStart, contextEnd);

      if (this.isExamplePlaceholder(value, context)) continue;
      if (this.isDataURI(context)) continue;

      const valueStart = match.index + (match[1] ? 1 : match[0].indexOf(value));
      const valueEnd = valueStart + value.length;

      this.detectEntropyInValue(value, valueStart, secrets, seenRanges);
    }

    // Second pass: Sliding window over long alphanumeric sequences
    // This catches high-entropy segments embedded in longer strings
    const longAlphanumPattern = /[A-Za-z0-9_\-/+=]{50,}/g;
    while ((match = longAlphanumPattern.exec(content)) !== null) {
      const fullValue = match[0];
      const startPos = match.index;

      // Skip if this range is already covered
      if (isCovered(startPos, startPos + fullValue.length)) continue;

      // Use sliding window to find high-entropy segments
      for (let i = 0; i <= fullValue.length - windowSize; i += 8) {
        const windowStart = startPos + i;
        const windowValue = fullValue.slice(i, i + windowSize);
        const entropy = this.calculateEntropy(windowValue);

        if (entropy > entropyThreshold) {
          const confidence = Math.min(0.9, 0.3 + (entropy - entropyThreshold) * 0.15);
          const adjustedConfidence = confidence + SENSITIVITY_CONFIDENCE_BOOST[this.sensitivity];

          if (adjustedConfidence >= this.defaultMinConfidence) {
            // Find the actual high-entropy segment bounds
            let segStart = i;
            let segEnd = i + windowSize;

            // Extend the segment to include adjacent high-entropy characters
            while (segStart > 0 && this.calculateEntropy(fullValue.slice(segStart - 1, segEnd)) > entropyThreshold) {
              segStart--;
            }
            while (segEnd < fullValue.length && this.calculateEntropy(fullValue.slice(segStart, segEnd + 1)) > entropyThreshold) {
              segEnd++;
            }

            const segValue = fullValue.slice(segStart, segEnd);
            const actualStart = startPos + segStart;
            const actualEnd = startPos + segEnd;

            if (!isCovered(actualStart, actualEnd)) {
              seenRanges.push([actualStart, actualEnd]);
              secrets.push({
                type: "generic_secret",
                patternName: "entropy",
                value: segValue,
                startIndex: actualStart,
                endIndex: actualEnd,
                confidence: adjustedConfidence,
                description: "High-entropy string detected",
              });
              // Skip ahead past this segment
              i = segEnd - windowSize;
            }
          }
        }
      }
    }

    return secrets;
  }

  /**
   * Helper to detect entropy in a specific value
   */
  private detectEntropyInValue(
    value: string,
    startIndex: number,
    secrets: DetectedSecret[],
    seenRanges: Array<[number, number]>
  ): void {
    const windowSize = 32;
    const entropyThreshold = 4.0;

    const isCovered = (start: number, end: number): boolean => {
      return seenRanges.some(([s, e]) => start >= s && end <= e);
    };

    if (value.length > 50) {
      // Use sliding window for long strings
      for (let i = 0; i <= value.length - windowSize; i += 10) {
        const window = value.slice(i, i + windowSize);
        const entropy = this.calculateEntropy(window);
        if (entropy > entropyThreshold) {
          const confidence = Math.min(0.9, 0.3 + (entropy - entropyThreshold) * 0.15);
          const adjustedConfidence = confidence + SENSITIVITY_CONFIDENCE_BOOST[this.sensitivity];

          if (adjustedConfidence >= this.defaultMinConfidence) {
            const actualStart = startIndex;
            const actualEnd = startIndex + value.length;
            if (!isCovered(actualStart, actualEnd)) {
              seenRanges.push([actualStart, actualEnd]);
              secrets.push({
                type: "generic_secret",
                patternName: "entropy",
                value,
                startIndex: actualStart,
                endIndex: actualEnd,
                confidence: adjustedConfidence,
                description: "High-entropy string detected",
              });
            }
            break; // Only report once per value
          }
        }
      }
    } else {
      // For shorter strings, check full entropy
      const entropy = this.calculateEntropy(value);
      if (entropy > entropyThreshold) {
        const confidence = Math.min(0.9, 0.3 + (entropy - entropyThreshold) * 0.15);
        const adjustedConfidence = confidence + SENSITIVITY_CONFIDENCE_BOOST[this.sensitivity];

        if (adjustedConfidence >= this.defaultMinConfidence) {
          const actualStart = startIndex;
          const actualEnd = startIndex + value.length;
          if (!isCovered(actualStart, actualEnd)) {
            seenRanges.push([actualStart, actualEnd]);
            secrets.push({
              type: "generic_secret",
              patternName: "entropy",
              value,
              startIndex: actualStart,
              endIndex: actualEnd,
              confidence: adjustedConfidence,
              description: "High-entropy string detected",
            });
          }
        }
      }
    }
  }

  /**
   * Detect Base64 encoded secrets
   */
  private detectBase64Secrets(content: string): DetectedSecret[] {
    if (!this.enableBase64Decoding) {
      return [];
    }

    const secrets: DetectedSecret[] = [];
    // Look for Base64-like strings (at least 20 chars, proper Base64 alphabet)
    // Match both quoted strings and unquoted values after keywords
    const base64Pattern = /(?:["']([A-Za-z0-9+/]{20,}={0,2})["']|(?:token|key|secret|encoded)[=:\s]+([A-Za-z0-9+/]{20,}={0,2}))/gi;

    let match;
    while ((match = base64Pattern.exec(content)) !== null) {
      const base64Value = match[1] || match[2];
      if (!base64Value) continue;

      // Skip data URIs
      const contextStart = Math.max(0, match.index - 30);
      const context = content.slice(contextStart, match.index);
      if (this.isDataURI(context)) continue;

      // Calculate actual position of the base64 value in the match
      const valueIndex = match[0].indexOf(base64Value);
      const startIndex = match.index + valueIndex;
      const endIndex = startIndex + base64Value.length;

      try {
        const decoded = atob(base64Value);

        // Check if decoded content contains known secret patterns
        for (const pattern of this.patterns) {
          if (this.excludePatterns.has(pattern.name)) continue;

          pattern.pattern.lastIndex = 0;
          const patternMatch = pattern.pattern.exec(decoded);
          if (patternMatch) {
            secrets.push({
              type: pattern.type,
              patternName: `${pattern.name}_base64`,
              value: base64Value,
              startIndex,
              endIndex,
              confidence: pattern.confidence * 0.9,
              description: `Base64 encoded ${pattern.description}`,
            });
            break;
          }
        }
      } catch {
        // Not valid Base64, skip
      }
    }

    return secrets;
  }

  /**
   * Scan content for secrets
   * Returns array of detected secrets
   */
  scan(content: string, options: DetectionOptions = {}): DetectedSecret[] {
    const minConfidence = options.minConfidence ?? this.defaultMinConfidence;
    const typesToDetect = options.types ?? null;
    const secrets: DetectedSecret[] = [];
    const seenPositions = new Set<string>();

    // Preprocess content
    const processedContent = this.preprocess(content);

    // Scan with each pattern
    for (const patternDef of this.patterns) {
      const { name, type, pattern, confidence, description } = patternDef;

      // Skip if type filtering enabled and this type not included
      if (typesToDetect && !typesToDetect.includes(type)) {
        continue;
      }

      // Apply sensitivity confidence adjustment
      const adjustedConfidence = confidence + SENSITIVITY_CONFIDENCE_BOOST[this.sensitivity];

      // Skip if below confidence threshold
      if (adjustedConfidence < minConfidence) {
        continue;
      }

      // Reset regex state for global patterns
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(processedContent)) !== null) {
        // Get the matched value (could be the whole match or a capture group)
        const fullMatch = match[0];
        const capturedValue = match[1] || fullMatch;

        // Find the value position in the full match
        const valueIndex = fullMatch.indexOf(capturedValue);
        const startIndex = match.index + (valueIndex >= 0 ? valueIndex : 0);
        const endIndex = startIndex + capturedValue.length;

        // Skip duplicates at same position
        const posKey = `${startIndex}:${endIndex}`;
        if (seenPositions.has(posKey)) continue;

        // Get context for false positive checks
        const contextStart = Math.max(0, match.index - 50);
        const contextEnd = Math.min(processedContent.length, match.index + fullMatch.length + 50);
        const context = processedContent.slice(contextStart, contextEnd);

        // Skip false positives
        if (this.isUUID(capturedValue)) continue;
        if (this.isHash(capturedValue, context)) continue;
        if (this.isExamplePlaceholder(capturedValue, context)) continue;
        if (this.isDataURI(context)) continue;

        seenPositions.add(posKey);
        secrets.push({
          type,
          patternName: name,
          value: capturedValue,
          startIndex,
          endIndex,
          confidence: adjustedConfidence,
          description,
        });
      }
    }

    // Add entropy-based detections
    // NOTE: Don't deduplicate against pattern matches - they're complementary detections
    const entropySecrets = this.detectEntropySecrets(processedContent);
    const seenEntropyPositions = new Set<string>();
    for (const es of entropySecrets) {
      const posKey = `${es.startIndex}:${es.endIndex}`;
      if (!seenEntropyPositions.has(posKey)) {
        seenEntropyPositions.add(posKey);
        secrets.push(es);
      }
    }

    // Add Base64-encoded secret detections
    // NOTE: Don't deduplicate against pattern matches - Base64 detection is separate
    const base64Secrets = this.detectBase64Secrets(processedContent);
    const seenBase64Positions = new Set<string>();
    for (const bs of base64Secrets) {
      const posKey = `${bs.startIndex}:${bs.endIndex}`;
      if (!seenBase64Positions.has(posKey)) {
        seenBase64Positions.add(posKey);
        secrets.push(bs);
      }
    }

    // Sort by position (ascending for reporting)
    secrets.sort((a, b) => a.startIndex - b.startIndex);

    // Filter out detections based on overlap rules:
    // 1. Header patterns contained within full patterns (e.g., private_key_header in private_key)
    // 2. Entropy detections that significantly overlap with specific pattern detections
    const filteredSecrets: DetectedSecret[] = [];
    for (const secret of secrets) {
      // Rule 1: Filter contained detections of same type/related patterns
      const isContainedByOther = secrets.some(
        (other) => {
          if (other === secret) return false;

          // Check if same secret type (e.g., both private_key type)
          // OR if one pattern name is a variant of the other (e.g., private_key vs private_key_header)
          const sameType = other.type === secret.type;
          const relatedPattern =
            other.patternName.startsWith(secret.patternName.replace(/_header$/, "")) ||
            secret.patternName.startsWith(other.patternName.replace(/_header$/, ""));

          if (!sameType && !relatedPattern) return false;

          // Check if completely contained (not just overlapping)
          const isContained =
            other.startIndex <= secret.startIndex &&
            other.endIndex >= secret.endIndex &&
            // Prefer the larger detection
            other.endIndex - other.startIndex > secret.endIndex - secret.startIndex;

          return isContained;
        }
      );

      // Rule 2: Filter entropy detections that overlap with specific patterns
      // Entropy is a fallback detection method - prefer explicit patterns
      const isEntropyOverlappingSpecific =
        secret.patternName === "entropy" &&
        secrets.some((other) => {
          if (other === secret) return false;
          if (other.patternName === "entropy" || other.patternName === "generic_secret") return false;

          // Calculate overlap
          const overlapStart = Math.max(secret.startIndex, other.startIndex);
          const overlapEnd = Math.min(secret.endIndex, other.endIndex);
          const overlapLength = Math.max(0, overlapEnd - overlapStart);

          // If >30% overlap, filter out entropy in favor of specific pattern
          const secretLength = secret.endIndex - secret.startIndex;
          return overlapLength > secretLength * 0.3;
        });

      if (!isContainedByOther && !isEntropyOverlappingSpecific) {
        filteredSecrets.push(secret);
      }
    }

    return filteredSecrets;
  }

  /**
   * Scan and return full result object with secrets and redacted content
   */
  scanWithRedaction(content: string, options: DetectionOptions = {}): ScanResult {
    const secrets = this.scan(content, options);
    const redactedContent = this.redact(content, secrets);

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
    return this.scan(content, options).length > 0;
  }

  /**
   * Redact secrets from content
   * Can accept pre-scanned detections for efficiency, or will scan automatically
   */
  redact(content: string, detections?: DetectedSecret[]): string {
    const secrets = detections ?? this.scan(content);

    // Sort by position descending for safe in-place replacement
    const sortedSecrets = [...secrets].sort(
      (a, b) => b.startIndex - a.startIndex
    );

    let redactedContent = content;
    for (const secret of sortedSecrets) {
      const redactionLabel = `[REDACTED:${secret.type.toUpperCase()}]`;
      redactedContent =
        redactedContent.slice(0, secret.startIndex) +
        redactionLabel +
        redactedContent.slice(secret.endIndex);
    }

    return redactedContent;
  }

  /**
   * Get summary of secret types found (for logging without exposing values)
   */
  getSummary(content: string, options: DetectionOptions = {}): Record<SecretType, number> {
    const secrets = this.scan(content, options);
    const summary: Partial<Record<SecretType, number>> = {};

    for (const secret of secrets) {
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
 * Convenience function to scan content for secrets
 * Uses the singleton detector instance
 */
export function scanForSecrets(
  content: string,
  options?: DetectionOptions
): DetectedSecret[] {
  const detector = getSecretDetector();
  return detector.scan(content, options);
}

/**
 * Convenience function to redact secrets from content
 * Uses the singleton detector instance
 */
export function redactSecrets(
  content: string,
  options?: DetectionOptions
): string {
  const detector = getSecretDetector();
  return detector.redact(content);
}

/**
 * Factory function to create a new SecretDetector instance
 * (not the singleton - use for custom configurations)
 */
export function createSecretDetector(
  options?: SecretDetectorOptions
): SecretDetector {
  return new SecretDetector(options);
}
