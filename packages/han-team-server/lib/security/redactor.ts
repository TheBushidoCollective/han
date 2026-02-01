/**
 * Secret Redaction
 *
 * Functions for redacting detected secrets from content while
 * preserving readability and context.
 */

import type { DetectedSecret } from "./secret-detector.ts";
import type { DetectionType } from "./patterns.ts";

/**
 * Redaction options
 */
export interface RedactionOptions {
  /** Format for redaction markers */
  format: "bracket" | "asterisk" | "hash";
  /** Whether to include the detection type in the marker */
  includeType: boolean;
  /** Whether to show partial content (first/last chars) */
  showPartial: boolean;
  /** Number of characters to show at start/end when showPartial is true */
  partialLength: number;
}

/**
 * Default redaction options
 */
export const DEFAULT_REDACTION_OPTIONS: RedactionOptions = {
  format: "bracket",
  includeType: true,
  showPartial: false,
  partialLength: 4,
};

/**
 * Human-readable labels for detection types
 */
const TYPE_LABELS: Record<DetectionType, string> = {
  api_key: "API_KEY",
  password: "PASSWORD",
  token: "TOKEN",
  private_key: "PRIVATE_KEY",
  connection_string: "CONNECTION_STRING",
  high_entropy: "SECRET",
};

/**
 * Generate a redaction marker for a detection type
 *
 * @param type - Detection type
 * @param options - Redaction options
 * @param original - Original secret value (for partial display)
 * @returns Redaction marker string
 */
export function createRedactionMarker(
  type: DetectionType,
  options: RedactionOptions = DEFAULT_REDACTION_OPTIONS,
  original?: string
): string {
  const label = options.includeType ? TYPE_LABELS[type] : "REDACTED";

  let partial = "";
  if (options.showPartial && original && original.length > options.partialLength * 2 + 4) {
    const start = original.slice(0, options.partialLength);
    const end = original.slice(-options.partialLength);
    partial = `:${start}...${end}`;
  }

  switch (options.format) {
    case "bracket":
      return `[REDACTED:${label}${partial}]`;
    case "asterisk":
      return `***${label}${partial}***`;
    case "hash":
      return `###${label}${partial}###`;
    default:
      return `[REDACTED:${label}${partial}]`;
  }
}

/**
 * Redact secrets from content
 *
 * Replaces detected secrets with redaction markers, handling overlapping
 * detections and preserving content structure.
 *
 * @param content - Original content
 * @param detections - Array of detected secrets
 * @param options - Redaction options
 * @returns Redacted content
 */
export function redact(
  content: string,
  detections: DetectedSecret[],
  options: Partial<RedactionOptions> = {}
): string {
  if (detections.length === 0) return content;

  const opts = { ...DEFAULT_REDACTION_OPTIONS, ...options };

  // Sort detections by start index (descending) to replace from end to start
  // This preserves indices while replacing
  const sorted = [...detections].sort((a, b) => b.startIndex - a.startIndex);

  let result = content;

  // Track replaced ranges to handle overlaps
  const replacedRanges: Array<{ start: number; end: number }> = [];

  for (const detection of sorted) {
    // Check if this detection overlaps with an already-replaced range
    const overlaps = replacedRanges.some(
      (range) =>
        (detection.startIndex >= range.start && detection.startIndex < range.end) ||
        (detection.endIndex > range.start && detection.endIndex <= range.end) ||
        (detection.startIndex <= range.start && detection.endIndex >= range.end)
    );

    if (overlaps) continue;

    const marker = createRedactionMarker(detection.type, opts, detection.value);

    result =
      result.slice(0, detection.startIndex) + marker + result.slice(detection.endIndex);

    replacedRanges.push({
      start: detection.startIndex,
      end: detection.endIndex,
    });
  }

  return result;
}

/**
 * Redact a single secret value
 *
 * Useful for redacting individual values without full content scanning.
 *
 * @param value - Secret value to redact
 * @param type - Detection type
 * @param options - Redaction options
 * @returns Redacted value
 */
export function redactValue(
  value: string,
  type: DetectionType,
  options: Partial<RedactionOptions> = {}
): string {
  const opts = { ...DEFAULT_REDACTION_OPTIONS, ...options };
  return createRedactionMarker(type, opts, value);
}

/**
 * Check if content has been redacted
 *
 * @param content - Content to check
 * @returns True if content contains redaction markers
 */
export function hasRedactions(content: string): boolean {
  return /\[REDACTED:[A-Z_]+(?::[^\]]+)?\]/.test(content);
}

/**
 * Count redactions in content
 *
 * @param content - Content to check
 * @returns Number of redaction markers found
 */
export function countRedactions(content: string): number {
  const matches = content.match(/\[REDACTED:[A-Z_]+(?::[^\]]+)?\]/g);
  return matches ? matches.length : 0;
}

/**
 * Extract redaction types from content
 *
 * @param content - Content to analyze
 * @returns Array of detection types that were redacted
 */
export function extractRedactionTypes(content: string): DetectionType[] {
  const pattern = /\[REDACTED:([A-Z_]+)(?::[^\]]+)?\]/g;
  const types = new Set<DetectionType>();
  let match: RegExpExecArray | null;

  const labelToType: Record<string, DetectionType> = {
    API_KEY: "api_key",
    PASSWORD: "password",
    TOKEN: "token",
    PRIVATE_KEY: "private_key",
    CONNECTION_STRING: "connection_string",
    SECRET: "high_entropy",
  };

  while ((match = pattern.exec(content)) !== null) {
    const label = match[1];
    const type = labelToType[label];
    if (type) types.add(type);
  }

  return Array.from(types);
}
