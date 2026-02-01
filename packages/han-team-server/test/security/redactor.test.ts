/**
 * Redactor Tests
 */

import { describe, it, expect } from "bun:test";
import {
  redact,
  redactValue,
  createRedactionMarker,
  hasRedactions,
  countRedactions,
  extractRedactionTypes,
  DEFAULT_REDACTION_OPTIONS,
  type RedactionOptions,
} from "../../lib/security/redactor.ts";
import type { DetectedSecret } from "../../lib/security/secret-detector.ts";

describe("createRedactionMarker", () => {
  it("should create bracket format by default", () => {
    const marker = createRedactionMarker("api_key");
    expect(marker).toBe("[REDACTED:API_KEY]");
  });

  it("should create asterisk format", () => {
    const marker = createRedactionMarker("api_key", { ...DEFAULT_REDACTION_OPTIONS, format: "asterisk" });
    expect(marker).toBe("***API_KEY***");
  });

  it("should create hash format", () => {
    const marker = createRedactionMarker("api_key", { ...DEFAULT_REDACTION_OPTIONS, format: "hash" });
    expect(marker).toBe("###API_KEY###");
  });

  it("should include type label by default", () => {
    const marker = createRedactionMarker("password");
    expect(marker).toContain("PASSWORD");
  });

  it("should use generic REDACTED when includeType is false", () => {
    const marker = createRedactionMarker("password", { ...DEFAULT_REDACTION_OPTIONS, includeType: false });
    expect(marker).toBe("[REDACTED:REDACTED]");
  });

  it("should show partial content when enabled", () => {
    const options: RedactionOptions = {
      ...DEFAULT_REDACTION_OPTIONS,
      showPartial: true,
      partialLength: 4,
    };
    const marker = createRedactionMarker("api_key", options, "AKIAIOSFODNN7EXAMPLE");
    expect(marker).toContain("AKIA");
    expect(marker).toContain("MPLE");
  });

  it("should not show partial for short strings", () => {
    const options: RedactionOptions = {
      ...DEFAULT_REDACTION_OPTIONS,
      showPartial: true,
      partialLength: 4,
    };
    const marker = createRedactionMarker("api_key", options, "short");
    expect(marker).not.toContain("...");
  });

  it("should handle all detection types", () => {
    expect(createRedactionMarker("api_key")).toContain("API_KEY");
    expect(createRedactionMarker("password")).toContain("PASSWORD");
    expect(createRedactionMarker("token")).toContain("TOKEN");
    expect(createRedactionMarker("private_key")).toContain("PRIVATE_KEY");
    expect(createRedactionMarker("connection_string")).toContain("CONNECTION_STRING");
    expect(createRedactionMarker("high_entropy")).toContain("SECRET");
  });
});

describe("redact", () => {
  it("should redact detected secrets", () => {
    const content = "key = AKIAIOSFODNN7EXAMPLE";
    const detections: DetectedSecret[] = [
      {
        value: "AKIAIOSFODNN7EXAMPLE",
        type: "api_key",
        patternName: "aws_access_key",
        startIndex: 6,
        endIndex: 26,
        confidence: 0.9,
        description: "AWS Access Key",
      },
    ];

    const redacted = redact(content, detections);
    expect(redacted).toBe("key = [REDACTED:API_KEY]");
  });

  it("should handle multiple non-overlapping secrets", () => {
    const content = "key1 = secret1 and key2 = secret2";
    const detections: DetectedSecret[] = [
      {
        value: "secret1",
        type: "password",
        patternName: "test",
        startIndex: 7,
        endIndex: 14,
        confidence: 0.9,
        description: "Secret 1",
      },
      {
        value: "secret2",
        type: "token",
        patternName: "test",
        startIndex: 26,
        endIndex: 33,
        confidence: 0.9,
        description: "Secret 2",
      },
    ];

    const redacted = redact(content, detections);
    expect(redacted).toContain("[REDACTED:PASSWORD]");
    expect(redacted).toContain("[REDACTED:TOKEN]");
    expect(redacted).not.toContain("secret1");
    expect(redacted).not.toContain("secret2");
  });

  it("should handle overlapping secrets by keeping higher confidence", () => {
    const content = "mysupersecretkey";
    const detections: DetectedSecret[] = [
      {
        value: "mysupersecret",
        type: "password",
        patternName: "test1",
        startIndex: 0,
        endIndex: 13,
        confidence: 0.7,
        description: "Lower confidence",
      },
      {
        value: "supersecretkey",
        type: "api_key",
        patternName: "test2",
        startIndex: 2,
        endIndex: 16,
        confidence: 0.9,
        description: "Higher confidence",
      },
    ];

    const redacted = redact(content, detections);
    // Should keep the higher confidence one
    expect(redacted).toContain("[REDACTED:API_KEY]");
    expect(countRedactions(redacted)).toBe(1);
  });

  it("should return original content when no detections", () => {
    const content = "safe content here";
    const redacted = redact(content, []);
    expect(redacted).toBe(content);
  });

  it("should preserve content before and after secrets", () => {
    const content = "prefix SECRET suffix";
    const detections: DetectedSecret[] = [
      {
        value: "SECRET",
        type: "password",
        patternName: "test",
        startIndex: 7,
        endIndex: 13,
        confidence: 0.9,
        description: "Test",
      },
    ];

    const redacted = redact(content, detections);
    expect(redacted).toBe("prefix [REDACTED:PASSWORD] suffix");
  });

  it("should handle secrets at start of content", () => {
    const content = "SECRET_VALUE rest of content";
    const detections: DetectedSecret[] = [
      {
        value: "SECRET_VALUE",
        type: "api_key",
        patternName: "test",
        startIndex: 0,
        endIndex: 12,
        confidence: 0.9,
        description: "Test",
      },
    ];

    const redacted = redact(content, detections);
    expect(redacted).toBe("[REDACTED:API_KEY] rest of content");
  });

  it("should handle secrets at end of content", () => {
    const content = "prefix SECRET_VALUE";
    const detections: DetectedSecret[] = [
      {
        value: "SECRET_VALUE",
        type: "api_key",
        patternName: "test",
        startIndex: 7,
        endIndex: 19,
        confidence: 0.9,
        description: "Test",
      },
    ];

    const redacted = redact(content, detections);
    expect(redacted).toBe("prefix [REDACTED:API_KEY]");
  });

  it("should apply custom redaction options", () => {
    const content = "key = AKIAIOSFODNN7EXAMPLE";
    const detections: DetectedSecret[] = [
      {
        value: "AKIAIOSFODNN7EXAMPLE",
        type: "api_key",
        patternName: "aws_access_key",
        startIndex: 6,
        endIndex: 26,
        confidence: 0.9,
        description: "AWS Access Key",
      },
    ];

    const redacted = redact(content, detections, { format: "asterisk" });
    expect(redacted).toBe("key = ***API_KEY***");
  });
});

describe("redactValue", () => {
  it("should redact a single value", () => {
    const redacted = redactValue("supersecret", "password");
    expect(redacted).toBe("[REDACTED:PASSWORD]");
  });

  it("should apply custom options", () => {
    const redacted = redactValue("supersecret", "token", { format: "hash" });
    expect(redacted).toBe("###TOKEN###");
  });
});

describe("hasRedactions", () => {
  it("should return true for content with redactions", () => {
    expect(hasRedactions("config = [REDACTED:API_KEY]")).toBe(true);
    expect(hasRedactions("[REDACTED:PASSWORD]")).toBe(true);
  });

  it("should return false for content without redactions", () => {
    expect(hasRedactions("normal content")).toBe(false);
    expect(hasRedactions("")).toBe(false);
  });

  it("should return true for redactions with partial content", () => {
    expect(hasRedactions("[REDACTED:API_KEY:AKIA...MPLE]")).toBe(true);
  });
});

describe("countRedactions", () => {
  it("should return 0 for no redactions", () => {
    expect(countRedactions("normal content")).toBe(0);
  });

  it("should count single redaction", () => {
    expect(countRedactions("[REDACTED:API_KEY]")).toBe(1);
  });

  it("should count multiple redactions", () => {
    const content = "[REDACTED:API_KEY] and [REDACTED:PASSWORD] and [REDACTED:TOKEN]";
    expect(countRedactions(content)).toBe(3);
  });
});

describe("extractRedactionTypes", () => {
  it("should return empty array for no redactions", () => {
    expect(extractRedactionTypes("normal content")).toEqual([]);
  });

  it("should extract single type", () => {
    expect(extractRedactionTypes("[REDACTED:API_KEY]")).toEqual(["api_key"]);
  });

  it("should extract multiple types", () => {
    const content = "[REDACTED:API_KEY] and [REDACTED:PASSWORD]";
    const types = extractRedactionTypes(content);
    expect(types).toContain("api_key");
    expect(types).toContain("password");
  });

  it("should deduplicate types", () => {
    const content = "[REDACTED:TOKEN] and [REDACTED:TOKEN]";
    expect(extractRedactionTypes(content)).toEqual(["token"]);
  });

  it("should handle all known types", () => {
    const content = `
      [REDACTED:API_KEY]
      [REDACTED:PASSWORD]
      [REDACTED:TOKEN]
      [REDACTED:PRIVATE_KEY]
      [REDACTED:CONNECTION_STRING]
      [REDACTED:SECRET]
    `;
    const types = extractRedactionTypes(content);
    expect(types).toHaveLength(6);
  });
});
