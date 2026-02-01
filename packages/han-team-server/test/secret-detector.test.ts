/**
 * Tests for Secret Detector
 */

import { describe, test, expect } from "bun:test";
import { SecretDetector, getSecretDetector } from "../lib/security/secret-detector.ts";

describe("SecretDetector", () => {
  const detector = getSecretDetector();

  describe("scan", () => {
    test("should detect AWS access key IDs", () => {
      const content = "My AWS key is AKIAIOSFODNN7EXAMPLE";
      const result = detector.scan(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.secrets.length).toBeGreaterThan(0);
      expect(result.secrets.some((s) => s.type === "aws_key")).toBe(true);
    });

    test("should detect GitHub tokens", () => {
      const content = "Token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const result = detector.scan(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.secrets.some((s) => s.type === "github_token")).toBe(true);
    });

    test("should detect GitHub PATs", () => {
      const content = "PAT: github_pat_11ABCDEFG_0123456789abcdefABCDEF";
      const result = detector.scan(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.secrets.some((s) => s.type === "github_token")).toBe(true);
    });

    test("should detect API keys", () => {
      const content = 'const config = { api_key: "api_key_4eC39HqLyjWDarjtT1zdp7dc" }';
      const result = detector.scan(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.secrets.some((s) => s.type === "api_key")).toBe(true);
    });

    test("should detect private keys", () => {
      const content = `
-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA0Z3...
-----END RSA PRIVATE KEY-----
      `;
      const result = detector.scan(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.secrets.some((s) => s.type === "private_key")).toBe(true);
    });

    test("should detect JWTs", () => {
      const content =
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
      const result = detector.scan(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.secrets.some((s) => s.type === "jwt")).toBe(true);
    });

    test("should detect database URLs with credentials", () => {
      const content = "DATABASE_URL=postgres://user:password123@localhost:5432/db";
      const result = detector.scan(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.secrets.some((s) => s.type === "database_url")).toBe(true);
    });

    test("should detect password patterns", () => {
      const content = 'password: "mysecretpassword123"';
      const result = detector.scan(content);

      expect(result.hasSecrets).toBe(true);
      expect(result.secrets.some((s) => s.type === "password")).toBe(true);
    });

    test("should not flag content without secrets", () => {
      const content = "This is just some normal text without any secrets.";
      const result = detector.scan(content);

      expect(result.hasSecrets).toBe(false);
      expect(result.secrets.length).toBe(0);
    });

    test("should redact secrets in content", () => {
      const content = "My AWS key is AKIAIOSFODNN7EXAMPLE and that's it.";
      const result = detector.scan(content);

      expect(result.redactedContent).toContain("[REDACTED]");
      expect(result.redactedContent).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });
  });

  describe("hasSecrets", () => {
    test("should return true for content with secrets", () => {
      const content = "api_key=abc123def456ghi789jkl012mno";
      expect(detector.hasSecrets(content)).toBe(true);
    });

    test("should return false for clean content", () => {
      const content = "Just regular text here.";
      expect(detector.hasSecrets(content)).toBe(false);
    });
  });

  describe("redact", () => {
    test("should return redacted content", () => {
      const content = "Token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const redacted = detector.redact(content);

      expect(redacted).toContain("[REDACTED]");
      expect(redacted).not.toContain("ghp_");
    });

    test("should preserve non-secret content", () => {
      const content = "Hello ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx world";
      const redacted = detector.redact(content);

      expect(redacted).toContain("Hello");
      expect(redacted).toContain("world");
    });
  });

  describe("getSummary", () => {
    test("should return counts by secret type", () => {
      const content = `
        AWS: AKIAIOSFODNN7EXAMPLE
        GitHub: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
        Password: password=mysecret123
      `;
      const summary = detector.getSummary(content);

      expect(summary.aws_key).toBeGreaterThan(0);
      expect(summary.github_token).toBeGreaterThan(0);
    });
  });

  describe("options", () => {
    test("should respect minConfidence threshold", () => {
      // Generic secrets have lower confidence
      const content = 'secret: "low_confidence_value123"';

      const lowThreshold = detector.scan(content, { minConfidence: 0.3 });
      const highThreshold = detector.scan(content, { minConfidence: 0.9 });

      expect(lowThreshold.secrets.length).toBeGreaterThanOrEqual(
        highThreshold.secrets.length
      );
    });

    test("should filter by secret types", () => {
      const content = `
        AWS: AKIAIOSFODNN7EXAMPLE
        GitHub: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
      `;

      const result = detector.scan(content, { types: ["aws_key"] });

      expect(result.secrets.every((s) => s.type === "aws_key")).toBe(true);
    });
  });
});
