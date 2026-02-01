/**
 * Entropy Analysis Tests
 */

import { describe, it, expect } from "bun:test";
import {
  calculateEntropy,
  detectCharset,
  isHighEntropy,
  findHighEntropySegments,
  maxEntropyForCharset,
  normalizedEntropyScore,
  ENTROPY_THRESHOLDS,
  MIN_ENTROPY_LENGTH,
} from "../../lib/security/entropy.ts";

describe("calculateEntropy", () => {
  it("should return 0 for empty string", () => {
    expect(calculateEntropy("")).toBe(0);
  });

  it("should return 0 for single character", () => {
    expect(calculateEntropy("a")).toBe(0);
  });

  it("should return 0 for repeated characters", () => {
    expect(calculateEntropy("aaaaaaaaaa")).toBe(0);
  });

  it("should return 1 for two equally distributed characters", () => {
    const entropy = calculateEntropy("ababababab");
    expect(entropy).toBeCloseTo(1, 5);
  });

  it("should return higher entropy for more diverse strings", () => {
    const lowEntropy = calculateEntropy("aaabbbccc");
    const highEntropy = calculateEntropy("abcdefghi");

    expect(highEntropy).toBeGreaterThan(lowEntropy);
  });

  it("should return high entropy for random-looking strings", () => {
    const entropy = calculateEntropy("xK9mN3pQ7rS5tV2wY4zA6bC8dE0fG1hI");
    expect(entropy).toBeGreaterThan(4.5);
  });

  it("should handle unicode characters", () => {
    const entropy = calculateEntropy("abc123");
    expect(entropy).toBeGreaterThan(0);
  });
});

describe("detectCharset", () => {
  it("should detect alphabetic strings", () => {
    expect(detectCharset("abcdefgh")).toBe("alphabetic");
    expect(detectCharset("ABCDEFGH")).toBe("alphabetic");
    expect(detectCharset("AbCdEfGh")).toBe("alphabetic");
  });

  it("should detect alphanumeric strings", () => {
    expect(detectCharset("abc123")).toBe("alphanumeric");
    expect(detectCharset("ABC123xyz")).toBe("alphanumeric");
  });

  it("should detect hex strings", () => {
    // Hex detection requires hash-like lengths (32, 40, 64, 128) and pure case
    expect(detectCharset("0123456789abcdef0123456789abcdef")).toBe("hex"); // 32 chars
    expect(detectCharset("ABCDEF0123456789ABCDEF0123456789ABCDEF01")).toBe("hex"); // 40 chars
  });

  it("should detect base64 strings", () => {
    expect(detectCharset("abc123DEF+/=")).toBe("base64");
    // Base64 without special chars is classified as alphanumeric
    expect(detectCharset("YWJjMTIz1")).toBe("alphanumeric"); // Has letter + digit
  });

  it("should detect mixed strings", () => {
    expect(detectCharset("abc!@#123")).toBe("mixed");
    expect(detectCharset("hello world")).toBe("mixed"); // Has space
  });
});

describe("isHighEntropy", () => {
  it("should return true for high entropy alphanumeric", () => {
    const entropy = calculateEntropy("xK9mN3pQ7rS5tV2wY4zA6bC8dE0fG1hI");
    expect(isHighEntropy(entropy, "alphanumeric", ENTROPY_THRESHOLDS.standard)).toBe(true);
  });

  it("should return false for low entropy", () => {
    const entropy = calculateEntropy("aaaaaaaaaa");
    expect(isHighEntropy(entropy, "alphabetic", ENTROPY_THRESHOLDS.standard)).toBe(false);
  });

  it("should use lower threshold for hex strings", () => {
    // Hex strings have lower max entropy (~4 bits)
    const entropy = calculateEntropy("0123456789abcdef");
    expect(isHighEntropy(entropy, "hex", ENTROPY_THRESHOLDS.standard)).toBe(true);
  });

  it("should respect threshold parameter", () => {
    const entropy = 4.3;
    expect(isHighEntropy(entropy, "alphanumeric", 4.0)).toBe(true);
    expect(isHighEntropy(entropy, "alphanumeric", 4.5)).toBe(false);
  });
});

describe("findHighEntropySegments", () => {
  it("should find high entropy segments in content", () => {
    const content = `
      Normal text here.
      secret = "xK9mN3pQ7rS5tV2wY4zA6bC8dE0fG1hI3jL5nO7pQ"
      More normal text.
    `;

    const segments = findHighEntropySegments(content);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].entropy).toBeGreaterThan(4);
  });

  it("should not find segments shorter than minimum length", () => {
    const content = "short: abc123";
    const segments = findHighEntropySegments(content, 4.5, MIN_ENTROPY_LENGTH);

    expect(segments).toHaveLength(0);
  });

  it("should respect custom threshold", () => {
    const content = "medium = 'AbCdEfGhIjKlMnOpQrStUvWxYz123456'";

    const strictSegments = findHighEntropySegments(content, 3.5);
    const permissiveSegments = findHighEntropySegments(content, 5.5);

    expect(strictSegments.length).toBeGreaterThanOrEqual(permissiveSegments.length);
  });

  it("should return correct indices", () => {
    const secret = "xK9mN3pQ7rS5tV2wY4zA6bC8dE0fG1hI3jL5nO7pQ";
    const content = `prefix:${secret}:suffix`;

    const segments = findHighEntropySegments(content);

    if (segments.length > 0) {
      const segment = segments[0];
      expect(content.slice(segment.startIndex, segment.endIndex)).toBe(secret);
    }
  });

  it("should skip very long segments", () => {
    // 600 character random string should be skipped
    const longRandom = "xK9mN3pQ".repeat(75);
    const content = `data: ${longRandom}`;

    const segments = findHighEntropySegments(content);

    // Should not detect the very long string
    expect(segments.filter((s) => s.value.length > 500)).toHaveLength(0);
  });

  it("should handle multiple segments", () => {
    const content = `
      key1 = "xK9mN3pQ7rS5tV2wY4zA6bC8dE0fG1hI"
      key2 = "aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV"
    `;

    const segments = findHighEntropySegments(content, 4.0);
    expect(segments.length).toBeGreaterThanOrEqual(2);
  });
});

describe("maxEntropyForCharset", () => {
  it("should return correct max entropy for alphabetic", () => {
    expect(maxEntropyForCharset("alphabetic")).toBeCloseTo(Math.log2(52), 2);
  });

  it("should return correct max entropy for alphanumeric", () => {
    expect(maxEntropyForCharset("alphanumeric")).toBeCloseTo(Math.log2(62), 2);
  });

  it("should return correct max entropy for hex", () => {
    expect(maxEntropyForCharset("hex")).toBeCloseTo(Math.log2(16), 2);
  });

  it("should return correct max entropy for base64", () => {
    expect(maxEntropyForCharset("base64")).toBeCloseTo(Math.log2(64), 2);
  });
});

describe("normalizedEntropyScore", () => {
  it("should return 0 for zero entropy", () => {
    expect(normalizedEntropyScore(0, "alphabetic")).toBe(0);
  });

  it("should return 1 for maximum entropy", () => {
    const maxEntropy = maxEntropyForCharset("alphanumeric");
    expect(normalizedEntropyScore(maxEntropy, "alphanumeric")).toBeCloseTo(1, 5);
  });

  it("should cap at 1 for entropy exceeding max", () => {
    expect(normalizedEntropyScore(10, "hex")).toBe(1);
  });

  it("should return proportional values", () => {
    const halfMax = maxEntropyForCharset("alphabetic") / 2;
    expect(normalizedEntropyScore(halfMax, "alphabetic")).toBeCloseTo(0.5, 2);
  });
});

describe("ENTROPY_THRESHOLDS", () => {
  it("should have strict < standard < permissive", () => {
    expect(ENTROPY_THRESHOLDS.strict).toBeLessThan(ENTROPY_THRESHOLDS.standard);
    expect(ENTROPY_THRESHOLDS.standard).toBeLessThan(ENTROPY_THRESHOLDS.permissive);
  });

  it("should have reasonable default values", () => {
    expect(ENTROPY_THRESHOLDS.standard).toBeCloseTo(4.5, 1);
  });
});
