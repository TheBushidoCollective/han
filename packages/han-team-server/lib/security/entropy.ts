/**
 * Entropy Analysis
 *
 * Functions for calculating Shannon entropy of strings to detect
 * high-entropy secrets that may not match known patterns.
 */

/**
 * Result of entropy analysis on a string segment
 */
export interface EntropyResult {
  /** The string that was analyzed */
  value: string;
  /** Shannon entropy in bits per character */
  entropy: number;
  /** Start position in the original content */
  startIndex: number;
  /** End position in the original content */
  endIndex: number;
  /** Character set detected (alphabetic, alphanumeric, base64, hex) */
  charset: CharacterSet;
}

export type CharacterSet = "alphabetic" | "alphanumeric" | "base64" | "hex" | "mixed";

/**
 * Default entropy thresholds by sensitivity level
 */
export const ENTROPY_THRESHOLDS = {
  /** Strict: lower threshold, more detections */
  strict: 4.0,
  /** Standard: balanced threshold */
  standard: 4.5,
  /** Permissive: higher threshold, fewer detections */
  permissive: 5.0,
};

/**
 * Minimum length for entropy-based detection
 */
export const MIN_ENTROPY_LENGTH = 20;

/**
 * Maximum length for entropy-based detection (to avoid analyzing huge strings)
 */
export const MAX_ENTROPY_LENGTH = 500;

/**
 * Calculate Shannon entropy of a string
 *
 * Shannon entropy measures the average amount of information in each character.
 * Higher entropy = more randomness = more likely to be a secret.
 *
 * @param str - String to analyze
 * @returns Entropy in bits per character
 */
export function calculateEntropy(str: string): number {
  if (str.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Detect the character set used in a string
 *
 * @param str - String to analyze
 * @returns Detected character set
 */
export function detectCharset(str: string): CharacterSet {
  const hasLower = /[a-z]/.test(str);
  const hasUpper = /[A-Z]/.test(str);
  const hasDigit = /[0-9]/.test(str);
  const hasBase64Special = /[+/=]/.test(str);
  const hasOther = /[^a-zA-Z0-9+/=_-]/.test(str);

  if (hasOther) return "mixed";

  // Check for base64 special characters first
  if (hasBase64Special && (hasLower || hasUpper) && hasDigit) return "base64";

  // If it has both letters and digits, classify as alphanumeric first
  // This takes precedence over hex to handle cases like "abc123"
  if ((hasLower || hasUpper) && hasDigit) {
    // Only classify as hex if it's a "pure" hex string without mixed case
    // and looks like an actual hash (typically 32, 40, 64, or 128 chars)
    const isStrictHex = /^[0-9a-fA-F]+$/.test(str);
    const isPureHex =
      isStrictHex && ((!hasLower && hasUpper) || (hasLower && !hasUpper) || (!hasLower && !hasUpper));
    const isHashLength = [32, 40, 64, 128].includes(str.length);

    if (isPureHex && isHashLength) return "hex";

    return "alphanumeric";
  }

  // If it only has letters
  if (hasLower || hasUpper) return "alphabetic";

  // Only digits - could be hex if valid hex chars
  if (/^[0-9a-fA-F]+$/.test(str)) return "hex";

  // Default case
  return "mixed";
}

/**
 * Expected entropy ranges for different character sets
 * Used to determine if a string is "high entropy" relative to its charset
 */
const EXPECTED_ENTROPY: Record<CharacterSet, { min: number; max: number }> = {
  alphabetic: { min: 3.5, max: 4.7 },
  alphanumeric: { min: 4.0, max: 5.2 },
  base64: { min: 4.5, max: 6.0 },
  hex: { min: 3.5, max: 4.0 },
  mixed: { min: 4.0, max: 6.5 },
};

/**
 * Check if entropy is suspiciously high for the detected charset
 *
 * @param entropy - Calculated entropy
 * @param charset - Detected character set
 * @param threshold - Base threshold (adjusted by charset)
 * @returns True if entropy indicates likely secret
 */
export function isHighEntropy(
  entropy: number,
  charset: CharacterSet,
  threshold: number
): boolean {
  const expected = EXPECTED_ENTROPY[charset];
  // For hex strings, use a lower threshold since they have lower max entropy
  const adjustedThreshold = charset === "hex" ? Math.min(threshold, 3.8) : threshold;
  return entropy >= adjustedThreshold && entropy >= expected.min;
}

/**
 * Find high-entropy segments in content
 *
 * Scans content for contiguous alphanumeric sequences that exceed
 * the entropy threshold, indicating potential secrets.
 *
 * @param content - Content to scan
 * @param threshold - Entropy threshold (default: 4.5)
 * @param minLength - Minimum segment length (default: 20)
 * @returns Array of high-entropy segments
 */
export function findHighEntropySegments(
  content: string,
  threshold: number = ENTROPY_THRESHOLDS.standard,
  minLength: number = MIN_ENTROPY_LENGTH
): EntropyResult[] {
  const results: EntropyResult[] = [];

  // Match contiguous alphanumeric sequences (including base64 chars)
  const pattern = /[A-Za-z0-9+/=_-]{20,}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const value = match[0];

    // Skip if too long (probably encoded data, not a secret)
    if (value.length > MAX_ENTROPY_LENGTH) continue;

    // Skip if too short
    if (value.length < minLength) continue;

    const entropy = calculateEntropy(value);
    const charset = detectCharset(value);

    if (isHighEntropy(entropy, charset, threshold)) {
      results.push({
        value,
        entropy,
        startIndex: match.index,
        endIndex: match.index + value.length,
        charset,
      });
    }
  }

  return results;
}

/**
 * Calculate the theoretical maximum entropy for a character set
 *
 * @param charset - Character set to analyze
 * @returns Maximum possible entropy in bits
 */
export function maxEntropyForCharset(charset: CharacterSet): number {
  const charsetSizes: Record<CharacterSet, number> = {
    alphabetic: 52, // a-z, A-Z
    alphanumeric: 62, // a-z, A-Z, 0-9
    base64: 64, // a-z, A-Z, 0-9, +, /
    hex: 16, // 0-9, a-f
    mixed: 94, // printable ASCII
  };

  return Math.log2(charsetSizes[charset]);
}

/**
 * Get a normalized entropy score (0-1) relative to charset maximum
 *
 * @param entropy - Calculated entropy
 * @param charset - Detected character set
 * @returns Normalized score between 0 and 1
 */
export function normalizedEntropyScore(entropy: number, charset: CharacterSet): number {
  const maxEntropy = maxEntropyForCharset(charset);
  return Math.min(1, entropy / maxEntropy);
}

/**
 * Default window size for sliding window entropy analysis
 */
export const SLIDING_WINDOW_SIZE = 32;

/**
 * Step size for sliding window (overlapping windows)
 */
export const SLIDING_WINDOW_STEP = 8;

/**
 * Result of sliding window entropy analysis
 */
export interface SlidingWindowResult {
  /** Starting index of the high-entropy window */
  startIndex: number;
  /** Ending index of the high-entropy window */
  endIndex: number;
  /** The high-entropy substring */
  value: string;
  /** Entropy of this window */
  entropy: number;
  /** Maximum entropy found in any window of this segment */
  maxWindowEntropy: number;
}

/**
 * Analyze a string using sliding window entropy to detect
 * high-entropy segments hidden within low-entropy padding.
 *
 * This defeats attacks where secrets are padded with repetitive
 * characters to lower the overall entropy of the string.
 *
 * @param content - Content to analyze
 * @param threshold - Entropy threshold for detection
 * @param windowSize - Size of sliding window (default: 32)
 * @param stepSize - Step between windows (default: 8)
 * @returns Array of high-entropy segments found via sliding window
 */
export function findHighEntropyWithSlidingWindow(
  content: string,
  threshold: number = ENTROPY_THRESHOLDS.standard,
  windowSize: number = SLIDING_WINDOW_SIZE,
  stepSize: number = SLIDING_WINDOW_STEP
): SlidingWindowResult[] {
  const results: SlidingWindowResult[] = [];

  // Only analyze strings longer than the window size
  // (shorter strings are handled by regular entropy analysis)
  if (content.length <= windowSize) return results;

  // Track windows that exceed threshold to merge adjacent ones
  const highEntropyWindows: Array<{
    start: number;
    end: number;
    entropy: number;
  }> = [];

  // Slide window across content
  for (let i = 0; i <= content.length - windowSize; i += stepSize) {
    const window = content.slice(i, i + windowSize);
    const entropy = calculateEntropy(window);
    const charset = detectCharset(window);

    if (isHighEntropy(entropy, charset, threshold)) {
      highEntropyWindows.push({
        start: i,
        end: i + windowSize,
        entropy,
      });
    }
  }

  // Merge overlapping/adjacent high-entropy windows
  if (highEntropyWindows.length === 0) return results;

  let currentMerge = { ...highEntropyWindows[0] };
  let maxEntropy = currentMerge.entropy;

  for (let i = 1; i < highEntropyWindows.length; i++) {
    const window = highEntropyWindows[i];

    // Check if this window overlaps or is adjacent to current merge
    if (window.start <= currentMerge.end) {
      // Extend the merge
      currentMerge.end = Math.max(currentMerge.end, window.end);
      maxEntropy = Math.max(maxEntropy, window.entropy);
    } else {
      // Save current merge and start new one
      results.push({
        startIndex: currentMerge.start,
        endIndex: currentMerge.end,
        value: content.slice(currentMerge.start, currentMerge.end),
        entropy: calculateEntropy(content.slice(currentMerge.start, currentMerge.end)),
        maxWindowEntropy: maxEntropy,
      });

      currentMerge = { ...window };
      maxEntropy = window.entropy;
    }
  }

  // Don't forget the last merge
  results.push({
    startIndex: currentMerge.start,
    endIndex: currentMerge.end,
    value: content.slice(currentMerge.start, currentMerge.end),
    entropy: calculateEntropy(content.slice(currentMerge.start, currentMerge.end)),
    maxWindowEntropy: maxEntropy,
  });

  return results;
}

/**
 * Enhanced entropy segment finder that combines regular and sliding window analysis.
 * Use this to catch secrets that have been padded to evade detection.
 *
 * @param content - Content to scan
 * @param threshold - Entropy threshold
 * @param minLength - Minimum segment length
 * @returns Combined results from both methods
 */
export function findHighEntropySegmentsEnhanced(
  content: string,
  threshold: number = ENTROPY_THRESHOLDS.standard,
  minLength: number = MIN_ENTROPY_LENGTH
): EntropyResult[] {
  // Get standard results
  const standardResults = findHighEntropySegments(content, threshold, minLength);

  // For longer strings that didn't trigger standard detection,
  // try sliding window analysis
  const pattern = /[A-Za-z0-9+/=_-]{50,}/g;
  let match: RegExpExecArray | null;
  const additionalResults: EntropyResult[] = [];

  while ((match = pattern.exec(content)) !== null) {
    const segment = match[0];
    const segmentStart = match.index;

    // Skip if this segment was already detected
    const alreadyDetected = standardResults.some(
      (r) => r.startIndex <= segmentStart && r.endIndex >= segmentStart + segment.length
    );
    if (alreadyDetected) continue;

    // Apply sliding window analysis
    const windowResults = findHighEntropyWithSlidingWindow(segment, threshold);

    for (const wr of windowResults) {
      // Only add if the window entropy is high enough
      if (wr.maxWindowEntropy >= threshold) {
        const charset = detectCharset(wr.value);
        additionalResults.push({
          value: wr.value,
          entropy: wr.entropy,
          startIndex: segmentStart + wr.startIndex,
          endIndex: segmentStart + wr.endIndex,
          charset,
        });
      }
    }
  }

  // Combine and deduplicate
  const allResults = [...standardResults, ...additionalResults];

  // Remove duplicates based on overlapping ranges
  const uniqueResults: EntropyResult[] = [];
  for (const result of allResults) {
    const isDuplicate = uniqueResults.some(
      (existing) =>
        (result.startIndex >= existing.startIndex && result.startIndex < existing.endIndex) ||
        (result.endIndex > existing.startIndex && result.endIndex <= existing.endIndex)
    );
    if (!isDuplicate) {
      uniqueResults.push(result);
    }
  }

  return uniqueResults.sort((a, b) => a.startIndex - b.startIndex);
}
