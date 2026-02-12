/**
 * Preprocessing Module Tests
 *
 * Tests for Unicode normalization, zero-width removal, and Base64 detection.
 */

import { describe, it, expect } from "bun:test";
import {
  normalizeConfusables,
  stripZeroWidth,
  extractBase64Secrets,
  preprocessContent,
  preprocessContentWithMetadata,
} from "../../lib/security/preprocessing.ts";

describe("normalizeConfusables", () => {
  describe("Cyrillic lookalikes", () => {
    it("should normalize Cyrillic A to ASCII A", () => {
      const input = "\u0410KIA"; // Cyrillic А followed by KIA
      const result = normalizeConfusables(input);
      expect(result).toBe("AKIA");
    });

    it("should normalize multiple Cyrillic characters", () => {
      const input = "\u0410\u0412\u0421"; // Cyrillic А, В, С
      const result = normalizeConfusables(input);
      expect(result).toBe("ABC");
    });

    it("should normalize lowercase Cyrillic", () => {
      const input = "\u0430\u0435\u043E"; // Cyrillic а, е, о
      const result = normalizeConfusables(input);
      expect(result).toBe("aeo");
    });
  });

  describe("Greek lookalikes", () => {
    it("should normalize Greek Alpha to A", () => {
      const input = "\u0391PHA"; // Greek Α followed by PHA
      const result = normalizeConfusables(input);
      expect(result).toBe("APHA");
    });

    it("should normalize Greek Omicron to O", () => {
      const input = "\u039FAUTH"; // Greek Ο followed by AUTH
      const result = normalizeConfusables(input);
      expect(result).toBe("OAUTH");
    });
  });

  describe("Fullwidth characters", () => {
    it("should normalize fullwidth letters", () => {
      const input = "\uFF21\uFF22\uFF23"; // Fullwidth ABC
      const result = normalizeConfusables(input);
      expect(result).toBe("ABC");
    });

    it("should normalize fullwidth digits", () => {
      const input = "\uFF11\uFF12\uFF13"; // Fullwidth 123
      const result = normalizeConfusables(input);
      expect(result).toBe("123");
    });

    it("should normalize mixed fullwidth content", () => {
      const input = "ghp_\uFF41\uFF42\uFF43"; // ghp_ followed by fullwidth abc
      const result = normalizeConfusables(input);
      expect(result).toBe("ghp_abc");
    });
  });

  describe("Mixed content", () => {
    it("should handle mixed ASCII and confusables", () => {
      const input = "AKI\u0410" + "1234567890ABCDEF";
      const result = normalizeConfusables(input);
      expect(result).toBe("AKIA1234567890ABCDEF");
    });

    it("should preserve non-confusable characters", () => {
      const input = "Hello World!";
      const result = normalizeConfusables(input);
      expect(result).toBe("Hello World!");
    });
  });
});

describe("stripZeroWidth", () => {
  it("should remove zero-width space", () => {
    const input = "AKIA\u200B1234";
    const result = stripZeroWidth(input);
    expect(result).toBe("AKIA1234");
  });

  it("should remove zero-width joiner", () => {
    const input = "ghp_\u200Dabc";
    const result = stripZeroWidth(input);
    expect(result).toBe("ghp_abc");
  });

  it("should remove zero-width non-joiner", () => {
    const input = "key\u200C=value";
    const result = stripZeroWidth(input);
    expect(result).toBe("key=value");
  });

  it("should remove byte order mark", () => {
    const input = "\uFEFFcontent";
    const result = stripZeroWidth(input);
    expect(result).toBe("content");
  });

  it("should remove multiple zero-width characters", () => {
    const input = "\u200BAKIA\u200C1234\u200D5678\u200E90AB\u200FCDEF\u2060";
    const result = stripZeroWidth(input);
    expect(result).toBe("AKIA1234567890ABCDEF");
  });

  it("should handle content without zero-width chars", () => {
    const input = "Normal content here";
    const result = stripZeroWidth(input);
    expect(result).toBe("Normal content here");
  });

  it("should handle empty string", () => {
    const input = "";
    const result = stripZeroWidth(input);
    expect(result).toBe("");
  });
});

describe("extractBase64Secrets", () => {
  it("should extract valid Base64 encoded content", () => {
    // Base64 of "AKIAIOSFODNN7EXAMPLE"
    const base64 = btoa("AKIAIOSFODNN7EXAMPLE");
    const content = `key = "${base64}"`;
    const result = extractBase64Secrets(content);

    expect(result.decodedSegments.length).toBe(1);
    expect(result.decodedSegments[0].decoded).toBe("AKIAIOSFODNN7EXAMPLE");
  });

  it("should extract multiple Base64 segments", () => {
    const base64_1 = btoa("secret_token_one");
    const base64_2 = btoa("secret_token_two");
    const content = `tokens: ["${base64_1}", "${base64_2}"]`;
    const result = extractBase64Secrets(content);

    expect(result.decodedSegments.length).toBe(2);
  });

  it("should skip short Base64 segments", () => {
    const content = `short: "YWJj"`; // "abc" - only 3 chars decoded
    const result = extractBase64Secrets(content);

    // Should not extract because decoded content is too short
    expect(result.decodedSegments.length).toBe(0);
  });

  it("should skip invalid Base64", () => {
    const content = `invalid: "!!!notbase64!!!"`;
    const result = extractBase64Secrets(content);

    expect(result.decodedSegments.length).toBe(0);
  });

  it("should skip binary content (low printable ratio)", () => {
    // Create Base64 of mostly non-printable bytes
    const binaryData = String.fromCharCode(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15);
    const base64 = btoa(binaryData);
    const content = `binary: "${base64}"`;
    const result = extractBase64Secrets(content);

    // Should not extract because it's binary
    expect(result.decodedSegments.length).toBe(0);
  });

  it("should include index information", () => {
    const base64 = btoa("my_secret_token_123");
    const content = `prefix: key = "${base64}"`;
    const result = extractBase64Secrets(content);

    expect(result.decodedSegments[0].index).toBeGreaterThan(0);
    expect(result.decodedSegments[0].original).toBe(base64);
  });
});

describe("preprocessContent", () => {
  it("should apply both zero-width and confusable normalization", () => {
    const input = "\u200BAKI\u0410\u200C1234"; // Zero-width + Cyrillic A
    const result = preprocessContent(input);
    expect(result).toBe("AKIA1234");
  });

  it("should handle complex bypass attempts", () => {
    // Combines multiple evasion techniques
    const input = "\uFEFF\u0410K\u200BI\u0391"; // BOM + Cyrillic A + ZWS + Greek Alpha
    const result = preprocessContent(input);
    expect(result).toBe("AKIA");
  });
});

describe("preprocessContentWithMetadata", () => {
  it("should return metadata about preprocessing", () => {
    const input = "\u200B\u0410BC\u200CDEF";
    const result = preprocessContentWithMetadata(input);

    expect(result.content).toBe("ABCDEF");
    expect(result.modified).toBe(true);
    expect(result.zeroWidthRemoved).toBe(2);
    expect(result.confusablesNormalized).toBe(1);
  });

  it("should indicate when no modifications were needed", () => {
    const input = "Normal ASCII content";
    const result = preprocessContentWithMetadata(input);

    expect(result.content).toBe("Normal ASCII content");
    expect(result.modified).toBe(false);
    expect(result.zeroWidthRemoved).toBe(0);
    expect(result.confusablesNormalized).toBe(0);
  });

  it("should extract Base64 segments", () => {
    const base64 = btoa("AKIAIOSFODNN7EXAMPLE");
    const input = `key = "${base64}"`;
    const result = preprocessContentWithMetadata(input);

    expect(result.base64Segments.length).toBe(1);
    expect(result.base64Segments[0].decoded).toBe("AKIAIOSFODNN7EXAMPLE");
  });
});
