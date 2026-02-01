/**
 * Content Preprocessing for Secret Detection
 *
 * Normalizes content before scanning to prevent bypass techniques:
 * - Unicode homoglyph normalization
 * - Zero-width character removal
 * - Base64 decoding of high-entropy segments
 */

/**
 * Unicode confusable characters that look like ASCII but aren't
 * Maps non-ASCII lookalikes to their ASCII equivalents
 */
const CONFUSABLE_MAP: Record<string, string> = {
  // Cyrillic lookalikes
  "\u0410": "A", // А (Cyrillic A)
  "\u0412": "B", // В (Cyrillic B)
  "\u0421": "C", // С (Cyrillic C)
  "\u0415": "E", // Е (Cyrillic E)
  "\u041D": "H", // Н (Cyrillic H)
  "\u0406": "I", // І (Cyrillic I)
  "\u041A": "K", // К (Cyrillic K)
  "\u041C": "M", // М (Cyrillic M)
  "\u041E": "O", // О (Cyrillic O)
  "\u0420": "P", // Р (Cyrillic P)
  "\u0422": "T", // Т (Cyrillic T)
  "\u0425": "X", // Х (Cyrillic X)
  "\u0430": "a", // а (Cyrillic a)
  "\u0435": "e", // е (Cyrillic e)
  "\u043E": "o", // о (Cyrillic o)
  "\u0440": "p", // р (Cyrillic p)
  "\u0441": "c", // с (Cyrillic c)
  "\u0443": "y", // у (Cyrillic y)
  "\u0445": "x", // х (Cyrillic x)

  // Greek lookalikes
  "\u0391": "A", // Α (Greek Alpha)
  "\u0392": "B", // Β (Greek Beta)
  "\u0395": "E", // Ε (Greek Epsilon)
  "\u0396": "Z", // Ζ (Greek Zeta)
  "\u0397": "H", // Η (Greek Eta)
  "\u0399": "I", // Ι (Greek Iota)
  "\u039A": "K", // Κ (Greek Kappa)
  "\u039C": "M", // Μ (Greek Mu)
  "\u039D": "N", // Ν (Greek Nu)
  "\u039F": "O", // Ο (Greek Omicron)
  "\u03A1": "P", // Ρ (Greek Rho)
  "\u03A4": "T", // Τ (Greek Tau)
  "\u03A5": "Y", // Υ (Greek Upsilon)
  "\u03A7": "X", // Χ (Greek Chi)
  "\u03B1": "a", // α (Greek alpha) - visually distinct but sometimes used
  "\u03BF": "o", // ο (Greek omicron)

  // Fullwidth Latin (used in CJK contexts)
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
  "\uFF10": "0",
  "\uFF11": "1",
  "\uFF12": "2",
  "\uFF13": "3",
  "\uFF14": "4",
  "\uFF15": "5",
  "\uFF16": "6",
  "\uFF17": "7",
  "\uFF18": "8",
  "\uFF19": "9",

  // Mathematical alphanumeric symbols (partial - most common)
  "\u{1D400}": "A", // MATHEMATICAL BOLD CAPITAL A
  "\u{1D41A}": "a", // MATHEMATICAL BOLD SMALL A

  // Other common confusables
  "\u0131": "i", // ı (dotless i)
  "\u0130": "I", // İ (dotted I)
  "\u01C0": "l", // ǀ (Latin click)
  "\u0269": "i", // ɩ (iota)
  "\u00D8": "0", // Ø (O with stroke - sometimes used as zero)
  "\u2070": "0", // superscript 0
  "\u00B9": "1", // superscript 1
  "\u00B2": "2", // superscript 2
  "\u00B3": "3", // superscript 3
};

/**
 * Zero-width and invisible characters that should be stripped
 */
const ZERO_WIDTH_CHARS = [
  "\u200B", // Zero Width Space
  "\u200C", // Zero Width Non-Joiner
  "\u200D", // Zero Width Joiner
  "\u200E", // Left-to-Right Mark
  "\u200F", // Right-to-Left Mark
  "\u2060", // Word Joiner
  "\u2061", // Function Application
  "\u2062", // Invisible Times
  "\u2063", // Invisible Separator
  "\u2064", // Invisible Plus
  "\uFEFF", // Byte Order Mark / Zero Width No-Break Space
  "\u00AD", // Soft Hyphen
  "\u034F", // Combining Grapheme Joiner
  "\u061C", // Arabic Letter Mark
  "\u115F", // Hangul Choseong Filler
  "\u1160", // Hangul Jungseong Filler
  "\u17B4", // Khmer Vowel Inherent Aq
  "\u17B5", // Khmer Vowel Inherent Aa
  "\u180E", // Mongolian Vowel Separator
  "\u3164", // Hangul Filler
];

// Build regex pattern for zero-width characters
const ZERO_WIDTH_PATTERN = new RegExp(`[${ZERO_WIDTH_CHARS.join("")}]`, "g");

// Build regex pattern for confusables (including supplementary plane chars)
const confusableKeys = Object.keys(CONFUSABLE_MAP);
const CONFUSABLE_PATTERN = new RegExp(`[${confusableKeys.join("")}]`, "gu");

/**
 * Normalize Unicode confusable characters to their ASCII equivalents
 *
 * @param content - Content to normalize
 * @returns Content with confusables replaced by ASCII
 */
export function normalizeConfusables(content: string): string {
  return content.replace(CONFUSABLE_PATTERN, (char) => CONFUSABLE_MAP[char] || char);
}

/**
 * Strip zero-width and invisible characters from content
 *
 * @param content - Content to clean
 * @returns Content without zero-width characters
 */
export function stripZeroWidth(content: string): string {
  return content.replace(ZERO_WIDTH_PATTERN, "");
}

/**
 * Check if a string is valid Base64
 *
 * @param str - String to check
 * @returns True if valid Base64
 */
function isValidBase64(str: string): boolean {
  // Must be at least 4 chars and have proper padding
  if (str.length < 4) return false;

  // Check character set
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(str)) return false;

  // Check length (must be multiple of 4, accounting for padding)
  const withoutPadding = str.replace(/=+$/, "");
  const paddingNeeded = (4 - (withoutPadding.length % 4)) % 4;
  if (paddingNeeded > 2) return false;

  return true;
}

/**
 * Attempt to decode Base64 segments and return both original and decoded
 * for scanning. Only includes decoded content if it looks like it could
 * contain secrets (high entropy, printable characters).
 *
 * @param content - Content to analyze
 * @returns Object with original content and decoded segments
 */
export function extractBase64Secrets(content: string): {
  decodedSegments: Array<{ original: string; decoded: string; index: number }>;
} {
  const decodedSegments: Array<{ original: string; decoded: string; index: number }> = [];

  // Find potential Base64 segments (16+ chars to avoid short false positives)
  const base64Pattern = /[A-Za-z0-9+/]{16,}={0,2}/g;
  let match: RegExpExecArray | null;

  while ((match = base64Pattern.exec(content)) !== null) {
    const segment = match[0];

    if (!isValidBase64(segment)) continue;

    try {
      // Use atob for browser/Bun compatibility
      const decoded = atob(segment);

      // Check if decoded content is mostly printable ASCII
      const printableRatio = decoded.split("").filter((c) => {
        const code = c.charCodeAt(0);
        return code >= 32 && code < 127;
      }).length / decoded.length;

      // Only include if >80% printable and has some length
      if (printableRatio > 0.8 && decoded.length >= 8) {
        decodedSegments.push({
          original: segment,
          decoded,
          index: match.index,
        });
      }
    } catch {
      // Invalid Base64, skip
    }
  }

  return { decodedSegments };
}

/**
 * Full preprocessing pipeline for secret detection
 *
 * @param content - Raw content to preprocess
 * @returns Preprocessed content ready for scanning
 */
export function preprocessContent(content: string): string {
  let result = content;

  // Step 1: Strip zero-width characters
  result = stripZeroWidth(result);

  // Step 2: Normalize Unicode confusables
  result = normalizeConfusables(result);

  return result;
}

/**
 * Result of preprocessing with metadata
 */
export interface PreprocessingResult {
  /** Preprocessed content */
  content: string;
  /** Whether any modifications were made */
  modified: boolean;
  /** Number of zero-width characters removed */
  zeroWidthRemoved: number;
  /** Number of confusables normalized */
  confusablesNormalized: number;
  /** Decoded Base64 segments for additional scanning */
  base64Segments: Array<{ original: string; decoded: string; index: number }>;
}

/**
 * Preprocess content with detailed metadata
 *
 * @param content - Raw content to preprocess
 * @returns Preprocessing result with metadata
 */
export function preprocessContentWithMetadata(content: string): PreprocessingResult {
  // Count zero-width chars before removal
  const zeroWidthMatches = content.match(ZERO_WIDTH_PATTERN);
  const zeroWidthRemoved = zeroWidthMatches?.length ?? 0;

  // Count confusables before normalization
  const strippedContent = stripZeroWidth(content);
  const confusableMatches = strippedContent.match(CONFUSABLE_PATTERN);
  const confusablesNormalized = confusableMatches?.length ?? 0;

  // Full preprocessing
  const processedContent = preprocessContent(content);

  // Extract Base64 segments
  const { decodedSegments } = extractBase64Secrets(processedContent);

  return {
    content: processedContent,
    modified: zeroWidthRemoved > 0 || confusablesNormalized > 0,
    zeroWidthRemoved,
    confusablesNormalized,
    base64Segments: decodedSegments,
  };
}
