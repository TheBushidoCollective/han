/**
 * Secret Detector Tests
 *
 * Comprehensive tests for secret detection functionality.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  SecretDetector,
  createSecretDetector,
  scanForSecrets,
  redactSecrets,
  type DetectedSecret,
  type SensitivityLevel,
} from "../../lib/security/index.ts";

describe("SecretDetector", () => {
  let detector: SecretDetector;

  beforeEach(() => {
    detector = new SecretDetector();
  });

  describe("scan()", () => {
    describe("AWS Secrets", () => {
      it("should detect AWS access key IDs", () => {
        const content = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].type).toBe("api_key");
        expect(detections[0].patternName).toBe("aws_access_key");
        expect(detections[0].value).toBe("AKIAIOSFODNN7EXAMPLE");
      });

      it("should detect AWS secret access keys with context", () => {
        const content = 'aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"';
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].type).toBe("api_key");
        expect(detections[0].patternName).toBe("aws_secret_key");
      });
    });

    describe("GitHub Tokens", () => {
      it("should detect GitHub personal access tokens", () => {
        const content = "GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].type).toBe("token");
        expect(detections[0].patternName).toBe("github_pat");
      });

      it("should detect GitHub server tokens", () => {
        const content = "token: ghs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].patternName).toBe("github_server_token");
      });

      it("should detect GitHub OAuth tokens", () => {
        const content = "gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].patternName).toBe("github_oauth");
      });
    });

    describe("Stripe Keys", () => {
      // NOTE: Tests use generic patterns to avoid GitHub Push Protection false positives
      // Real Stripe key detection (sk_test_, sk_live_) is validated in integration tests
      it("should detect generic API key patterns with stripe context", () => {
        const content = 'STRIPE_SECRET_KEY="api_key_4eC39HqLyjWDarjtT1zdp7dc"';
        const detections = detector.scan(content);

        expect(detections.length).toBeGreaterThan(0);
        expect(detections[0].type).toBe("api_key");
      });

      it("should detect API keys in stripe configuration", () => {
        const content = 'stripe_key = "rk_prod_51HxxxxxxxxxxxxxxxxxxxxxxxxX"';
        const detections = detector.scan(content);

        expect(detections.length).toBeGreaterThan(0);
        expect(detections.some((d) => d.type === "api_key")).toBe(true);
      });
    });

    describe("Private Keys", () => {
      it("should detect RSA private key headers", () => {
        const content = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
-----END RSA PRIVATE KEY-----
        `;
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].type).toBe("private_key");
        expect(detections[0].patternName).toBe("private_key");
      });

      it("should detect OpenSSH private key headers", () => {
        const content = "-----BEGIN OPENSSH PRIVATE KEY-----";
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].type).toBe("private_key");
      });
    });

    describe("Connection Strings", () => {
      it("should detect PostgreSQL connection strings", () => {
        const content = "DATABASE_URL=postgres://user:password123@localhost:5432/mydb";
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].type).toBe("connection_string");
      });

      it("should detect MongoDB connection strings", () => {
        const content = "MONGO_URI=mongodb+srv://admin:secretpass@cluster.mongodb.net/db";
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].type).toBe("connection_string");
      });

      it("should detect Redis connection strings", () => {
        const content = "REDIS_URL=redis://default:mypassword@redis.example.com:6379";
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].type).toBe("connection_string");
      });
    });

    describe("Generic API Keys", () => {
      it("should detect generic API key assignments", () => {
        const content = 'const apiKey = "sk_prod_abcdefghijklmnopqrstuvwxyz123456"';
        const detections = detector.scan(content);

        expect(detections.some((d) => d.patternName === "generic_api_key")).toBe(true);
      });

      it("should detect API secret assignments", () => {
        const content = "API_SECRET: 'very_long_secret_key_that_is_at_least_20_chars'";
        const detections = detector.scan(content);

        expect(detections.length).toBeGreaterThan(0);
      });
    });

    describe("JWT Tokens", () => {
      it("should detect Bearer JWT tokens", () => {
        const content =
          "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
        const detections = detector.scan(content);

        expect(detections.length).toBe(1);
        expect(detections[0].type).toBe("token");
        expect(detections[0].patternName).toBe("bearer_jwt");
      });
    });

    describe("AI Service Keys", () => {
      it("should detect Anthropic API keys", () => {
        // Anthropic keys: sk-ant-api03- followed by 93 characters
        const content =
          "ANTHROPIC_API_KEY=sk-ant-api03-abcdefghij1234567890abcdefghij1234567890abcdefghij1234567890abcdefghij1234567890abcdefghij123";
        const detections = detector.scan(content);

        expect(detections.some((d) => d.patternName === "anthropic_api_key")).toBe(true);
      });

      it("should detect Google API keys", () => {
        const content = "GOOGLE_API_KEY=AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe";
        const detections = detector.scan(content);

        expect(detections.some((d) => d.patternName === "google_api_key")).toBe(true);
      });
    });

    describe("Slack Tokens", () => {
      // NOTE: Tests use generic patterns to avoid GitHub Push Protection
      // Real Slack token detection (xoxb-, hooks.slack.com) is validated in integration tests
      it("should detect generic token patterns in slack context", () => {
        const content = "SLACK_BOT_TOKEN=bot_token_ABCDEFghijklmnopqrstuvwxyz123456";
        const detections = detector.scan(content);

        expect(detections.length).toBeGreaterThan(0);
        expect(detections.some((d) => d.type === "token" || d.type === "api_key")).toBe(true);
      });

      it("should detect webhook URLs with credentials", () => {
        const content =
          "SLACK_WEBHOOK=https://webhooks.example-service.test/services/T000/B000/secrettoken123";
        const detections = detector.scan(content);

        // Detects as connection string or API key based on URL structure
        expect(detections.length).toBeGreaterThan(0);
      });
    });

    describe("NPM/PyPI Tokens", () => {
      it("should detect NPM tokens", () => {
        const content = "NPM_TOKEN=npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
        const detections = detector.scan(content);

        expect(detections.some((d) => d.patternName === "npm_token")).toBe(true);
      });
    });

    describe("SendGrid/Mailgun", () => {
      it("should detect SendGrid API keys", () => {
        const content =
          "SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
        const detections = detector.scan(content);

        expect(detections.some((d) => d.patternName === "sendgrid_api_key")).toBe(true);
      });

      it("should detect Mailgun API keys", () => {
        const content = "MAILGUN_API_KEY=key-12345678901234567890123456789012";
        const detections = detector.scan(content);

        expect(detections.some((d) => d.patternName === "mailgun_api_key")).toBe(true);
      });
    });
  });

  describe("False Positive Reduction", () => {
    it("should skip UUIDs", () => {
      const content = "id: 550e8400-e29b-41d4-a716-446655440000";
      const detections = detector.scan(content);

      // Should not detect UUID as a secret
      expect(detections.filter((d) => d.value.includes("550e8400"))).toHaveLength(0);
    });

    it("should skip SHA hashes when labeled", () => {
      const content = "sha256: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
      const detections = detector.scan(content);

      expect(detections).toHaveLength(0);
    });

    it("should skip git commit hashes", () => {
      const content = "commit a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
      const detections = detector.scan(content);

      expect(detections).toHaveLength(0);
    });

    it("should skip integrity hashes", () => {
      const content =
        '"integrity": "sha512-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"';
      const detections = detector.scan(content);

      // Integrity hashes should be skipped
      expect(
        detections.filter((d) => d.value.includes("sha512-abc123"))
      ).toHaveLength(0);
    });

    it("should skip example/test placeholders", () => {
      const content = `
        // Example API key
        const testKey = "your_api_key_here_example";
      `;
      const detections = detector.scan(content);

      // Low confidence or no detections for example content
      const highConfidence = detections.filter((d) => d.confidence > 0.7);
      expect(highConfidence).toHaveLength(0);
    });

    it("should skip data URIs", () => {
      const content =
        'src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"';
      const detections = detector.scan(content);

      // Base64 image data should not be detected
      const imageDetections = detections.filter((d) => d.value.includes("iVBORw0K"));
      expect(imageDetections).toHaveLength(0);
    });
  });

  describe("Sensitivity Levels", () => {
    it("should detect more secrets in strict mode", () => {
      const content = `
        // Potentially sensitive
        const config = {
          key: "abcdefghijklmnopqrstuvwxyz12345678901234567890",
          secret: "qwertyuiopasdfghjklzxcvbnm1234567890"
        };
      `;

      const strictDetector = new SecretDetector({ sensitivity: "strict" });
      const permissiveDetector = new SecretDetector({ sensitivity: "permissive" });

      const strictDetections = strictDetector.scan(content);
      const permissiveDetections = permissiveDetector.scan(content);

      // Strict should find more or equal
      expect(strictDetections.length).toBeGreaterThanOrEqual(permissiveDetections.length);
    });

    it("should adjust confidence based on sensitivity", () => {
      const content = "STRIPE_SECRET_KEY=api_key_4eC39HqLyjWDarjtT1zdp7dc";

      const strictDetector = new SecretDetector({ sensitivity: "strict" });
      const permissiveDetector = new SecretDetector({ sensitivity: "permissive" });

      const strictDetections = strictDetector.scan(content);
      const permissiveDetections = permissiveDetector.scan(content);

      // Both should detect, but strict should have higher confidence
      expect(strictDetections[0].confidence).toBeGreaterThan(
        permissiveDetections[0].confidence
      );
    });
  });

  describe("Entropy-based Detection", () => {
    it("should detect high-entropy strings", () => {
      const detector = new SecretDetector({ sensitivity: "strict" });
      const content =
        'const secret = "xK9mN3pQ7rS5tV2wY4zA6bC8dE0fG1hI3jL5nO7pQ9sU1wX3yZ";';
      const detections = detector.scan(content);

      expect(detections.some((d) => d.patternName === "entropy")).toBe(true);
    });

    it("should not detect low-entropy strings", () => {
      const content = 'const text = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";';
      const detections = detector.scan(content);

      // Low entropy repetitive string should not be detected
      expect(detections.filter((d) => d.value.includes("aaaaaa"))).toHaveLength(0);
    });

    it("should respect enableEntropyDetection option", () => {
      const detector = new SecretDetector({ enableEntropyDetection: false });
      const content =
        'const secret = "xK9mN3pQ7rS5tV2wY4zA6bC8dE0fG1hI3jL5nO7pQ9sU1wX3yZ";';
      const detections = detector.scan(content);

      // No entropy-based detections
      expect(detections.filter((d) => d.patternName === "entropy")).toHaveLength(0);
    });
  });

  describe("redact()", () => {
    it("should redact detected secrets", () => {
      const content = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
      const redacted = detector.redact(content);

      expect(redacted).toContain("[REDACTED:API_KEY]");
      expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });

    it("should redact multiple secrets", () => {
      const content = `
        AWS_KEY=AKIAIOSFODNN7EXAMPLE
        GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
      `;
      const redacted = detector.redact(content);

      expect(redacted).toContain("[REDACTED:API_KEY]");
      expect(redacted).toContain("[REDACTED:TOKEN]");
      expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(redacted).not.toContain("ghp_");
    });

    it("should preserve non-secret content", () => {
      const content = "Hello world! AWS_KEY=AKIAIOSFODNN7EXAMPLE Goodbye!";
      const redacted = detector.redact(content);

      expect(redacted).toContain("Hello world!");
      expect(redacted).toContain("Goodbye!");
    });

    it("should use provided detections", () => {
      const content = "custom secret: mysecretvalue";
      const detections: DetectedSecret[] = [
        {
          value: "mysecretvalue",
          type: "password",
          patternName: "custom",
          startIndex: content.indexOf("mysecretvalue"),
          endIndex: content.indexOf("mysecretvalue") + "mysecretvalue".length,
          confidence: 0.9,
          description: "Custom secret",
        },
      ];
      const redacted = detector.redact(content, detections);

      expect(redacted).toContain("[REDACTED:PASSWORD]");
      expect(redacted).not.toContain("mysecretvalue");
    });
  });

  describe("hasSecrets()", () => {
    it("should return true for content with obvious secrets", () => {
      expect(detector.hasSecrets("AKIAIOSFODNN7EXAMPLE")).toBe(true);
      expect(detector.hasSecrets("ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")).toBe(true);
      expect(detector.hasSecrets("api_key_4eC39HqLyjWDarjtT1zdp7dc")).toBe(true);
      expect(detector.hasSecrets("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
    });

    it("should return false for content without secrets", () => {
      expect(detector.hasSecrets("Hello, world!")).toBe(false);
      expect(detector.hasSecrets("Just some regular text")).toBe(false);
    });
  });

  describe("Custom Patterns", () => {
    it("should include custom patterns", () => {
      const customDetector = new SecretDetector({
        customPatterns: [
          {
            name: "custom_token",
            type: "token",
            pattern: /CUSTOM_[A-Z0-9]{20}/g,
            description: "Custom Token",
          },
        ],
      });

      const content = "TOKEN=CUSTOM_ABCDEFGHIJ1234567890";
      const detections = customDetector.scan(content);

      expect(detections.some((d) => d.patternName === "custom_token")).toBe(true);
    });

    it("should exclude specified patterns", () => {
      const customDetector = new SecretDetector({
        excludePatterns: ["github_pat"],
      });

      const content = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const detections = customDetector.scan(content);

      expect(detections.filter((d) => d.patternName === "github_pat")).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty content", () => {
      const detections = detector.scan("");
      expect(detections).toHaveLength(0);
    });

    it("should handle content with no secrets", () => {
      const detections = detector.scan("Just some regular text without any secrets");
      expect(detections).toHaveLength(0);
    });

    it("should handle very long content", () => {
      const longContent = "x".repeat(100000);
      const detections = detector.scan(longContent);
      expect(detections).toHaveLength(0);
    });

    it("should handle overlapping patterns", () => {
      // AWS key inside a larger string
      const content = "AKIAIOSFODNN7EXAMPLEextratext";
      const detections = detector.scan(content);

      // Should detect the AWS key without issues
      expect(detections.length).toBeGreaterThan(0);
    });

    it("should handle special characters in content", () => {
      const content = "key = \"AKIAIOSFODNN7EXAMPLE\"; // <-- secret!";
      const detections = detector.scan(content);

      expect(detections.length).toBeGreaterThan(0);
    });
  });
});

describe("Helper Functions", () => {
  describe("createSecretDetector()", () => {
    it("should create detector with default options", () => {
      const detector = createSecretDetector();
      expect(detector).toBeInstanceOf(SecretDetector);
    });

    it("should create detector with custom options", () => {
      const detector = createSecretDetector({ sensitivity: "strict" });
      expect(detector).toBeInstanceOf(SecretDetector);
    });
  });

  describe("scanForSecrets()", () => {
    it("should scan content with default detector", () => {
      const detections = scanForSecrets("AKIAIOSFODNN7EXAMPLE");
      expect(detections.length).toBeGreaterThan(0);
    });
  });

  describe("redactSecrets()", () => {
    it("should redact content with default detector", () => {
      const redacted = redactSecrets("AKIAIOSFODNN7EXAMPLE");
      expect(redacted).toContain("[REDACTED");
    });
  });
});

describe("Security Hardening", () => {
  describe("GitHub Fine-Grained PAT Detection", () => {
    it("should detect GitHub fine-grained personal access tokens", () => {
      const detector = new SecretDetector();
      const content = "GITHUB_TOKEN=github_pat_11ABCD123_abcdefghij1234567890abcdef";
      const detections = detector.scan(content);

      expect(detections.some((d) => d.patternName === "github_fine_grained_pat")).toBe(true);
    });

    it("should detect longer fine-grained tokens", () => {
      const detector = new SecretDetector();
      const content = "github_pat_11AAAAAAAAAAAAAAAAAAAAAA_BBBBBBBBBBBBBBBBBBBBBBBB";
      const detections = detector.scan(content);

      expect(detections.length).toBeGreaterThan(0);
    });
  });

  describe("Unicode Homoglyph Bypass Prevention", () => {
    it("should detect AWS keys with Cyrillic lookalikes", () => {
      const detector = new SecretDetector();
      // АКІ\u0410 uses Cyrillic A (U+0410) instead of ASCII A
      const content = "AWS_KEY=\u0410KIA1234567890ABCDEF";
      const detections = detector.scan(content);

      // Should normalize Cyrillic A to ASCII A and detect
      expect(detections.some((d) => d.patternName === "aws_access_key")).toBe(true);
    });

    it("should detect tokens with fullwidth characters", () => {
      const detector = new SecretDetector();
      // Uses fullwidth letters
      const content = "ghp_\uFF41\uFF42\uFF43\uFF44efghijklmnopqrstuvwxyz1234567890";
      const detections = detector.scan(content);

      expect(detections.some((d) => d.patternName === "github_pat")).toBe(true);
    });
  });

  describe("Zero-Width Character Bypass Prevention", () => {
    it("should detect secrets with zero-width spaces", () => {
      const detector = new SecretDetector();
      // Inserts zero-width spaces in the middle of AWS key
      const content = "AKIA1234\u200B5678\u200B90AB\u200BCDEF";
      const detections = detector.scan(content);

      expect(detections.some((d) => d.patternName === "aws_access_key")).toBe(true);
    });

    it("should detect secrets with zero-width joiners", () => {
      const detector = new SecretDetector();
      const content = "ghp_\u200Dabcdefghij\u200Dklmnopqrstuvwxyz1234567890";
      const detections = detector.scan(content);

      expect(detections.some((d) => d.patternName === "github_pat")).toBe(true);
    });
  });

  describe("Base64 Encoded Secret Detection", () => {
    it("should detect Base64 encoded AWS keys", () => {
      const detector = new SecretDetector();
      // Base64 of "AKIAIOSFODNN7EXAMPLE"
      const base64Key = btoa("AKIAIOSFODNN7EXAMPLE");
      const content = `encoded_key = "${base64Key}"`;
      const detections = detector.scan(content);

      expect(detections.some((d) => d.patternName === "aws_access_key_base64")).toBe(true);
    });

    it("should detect Base64 encoded GitHub tokens", () => {
      const detector = new SecretDetector();
      // Base64 of a GitHub token
      const base64Token = btoa("ghp_abcdefghijklmnopqrstuvwxyz1234567890");
      const content = `token: ${base64Token}`;
      const detections = detector.scan(content);

      expect(detections.some((d) => d.patternName === "github_pat_base64")).toBe(true);
    });
  });

  describe("Entropy Padding Evasion Prevention", () => {
    it("should detect high-entropy segments within low-entropy padding", () => {
      // Use low minConfidence to catch borderline cases where sliding window helps
      const detector = new SecretDetector({ sensitivity: "strict", minConfidence: 0.2 });
      // Long string (60+ chars) with high-entropy segment - triggers sliding window
      // The secret is 40 chars of high entropy padded with 30 chars of low entropy on each side
      const secret = "xK9mN3pQ7rS5tV2wY4zA6bC8dE0fG1hI3jL5nO7p";
      const paddedContent = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" + secret + "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      const detections = detector.scan(paddedContent);

      // Should detect via sliding window analysis (may show as entropy or pattern-based)
      expect(detections.length).toBeGreaterThan(0);
    });

    it("should detect secrets hidden in long padded strings", () => {
      // Lower confidence threshold to catch padded secrets
      const detector = new SecretDetector({ sensitivity: "strict", minConfidence: 0.2 });
      // 100+ char string with secret in the middle - must be >50 chars to trigger enhanced detection
      const content = "0000000000000000000000000000xK9mN3pQ7rS5tV2wY4zA6bC8dE0fG1hI3jL5nO7pQ9sU1w0000000000000000000000000000";
      const detections = detector.scan(content);

      expect(detections.length).toBeGreaterThan(0);
    });

    it("should use sliding window for long strings that fail standard detection", () => {
      // Lower confidence threshold for padded content detection
      const detector = new SecretDetector({ sensitivity: "strict", minConfidence: 0.2 });
      // Standard detection fails because overall entropy is lowered by padding
      // But sliding window should find the high-entropy core
      const highEntropy = "aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0";
      const lowEntropy = "00000000000000000000"; // 20 zeros
      const content = lowEntropy + highEntropy + lowEntropy; // 70 chars total

      // Verify sliding window detection works
      const detections = detector.scan(content);

      // The high-entropy core should be detected
      expect(detections.length).toBeGreaterThan(0);
    });

    it("should detect very high entropy secrets regardless of padding", () => {
      const detector = new SecretDetector({ sensitivity: "strict" });
      // Extremely high entropy secret should be detected even with default confidence
      const highEntropySecret = "xK9mN3pQ7rS5tV2wY4zA6bC8dE0fG1hI3jL5nO7pQ9sU1wX3yZ5aB7cD9eF";
      const paddedContent = "aaaaa" + highEntropySecret + "bbbbb";
      const detections = detector.scan(paddedContent);

      expect(detections.some((d) => d.patternName === "entropy")).toBe(true);
    });
  });

  describe("ReDoS Prevention", () => {
    it("should handle long password values without hanging", () => {
      const detector = new SecretDetector();
      // This would cause catastrophic backtracking with the old pattern
      const longString = "'".repeat(1000);
      const content = `password = "${longString}`;

      const startTime = Date.now();
      detector.scan(content);
      const elapsed = Date.now() - startTime;

      // Should complete in under 1 second, not hang
      expect(elapsed).toBeLessThan(1000);
    });

    it("should still detect normal passwords", () => {
      const detector = new SecretDetector();
      const content = 'password = "mySuperSecretP@ssw0rd!"';
      const detections = detector.scan(content);

      expect(detections.some((d) => d.patternName === "generic_password")).toBe(true);
    });
  });

  describe("Preprocessing Options", () => {
    it("should allow disabling preprocessing", () => {
      const detector = new SecretDetector({ enablePreprocessing: false });
      // With preprocessing disabled, this should NOT be detected
      const content = "\u0410KIA1234567890ABCDEF"; // Cyrillic A
      const detections = detector.scan(content);

      // Should NOT find it because preprocessing is disabled
      expect(detections.some((d) => d.patternName === "aws_access_key")).toBe(false);
    });

    it("should allow disabling Base64 detection", () => {
      const detector = new SecretDetector({ enableBase64Decoding: false });
      const base64Key = btoa("AKIAIOSFODNN7EXAMPLE");
      const content = `encoded_key = "${base64Key}"`;
      const detections = detector.scan(content);

      // Should NOT find Base64-encoded secrets
      expect(detections.some((d) => d.patternName.includes("_base64"))).toBe(false);
    });
  });
});

describe("Multiple Secrets in Real-World Content", () => {
  it("should detect secrets in a config file", () => {
    const content = `
# Environment Configuration
DATABASE_URL=postgres://admin:supersecret@db.example.com:5432/app
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=api_key_4eC39HqLyjWDarjtT1zdp7dc
    `;

    const detector = new SecretDetector();
    const detections = detector.scan(content);

    expect(detections.length).toBeGreaterThanOrEqual(4);

    const types = new Set(detections.map((d) => d.type));
    expect(types.has("api_key")).toBe(true);
    expect(types.has("token")).toBe(true);
    expect(types.has("connection_string")).toBe(true);
  });

  it("should detect secrets in source code", () => {
    const content = `
import Stripe from 'stripe';

const stripe = new Stripe('api_key_4eC39HqLyjWDarjtT1zdp7dc', {
  apiVersion: '2023-10-16',
});

// GitHub API client
const octokit = new Octokit({
  auth: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
});
    `;

    const detector = new SecretDetector();
    const detections = detector.scan(content);

    expect(detections.length).toBeGreaterThanOrEqual(2);
  });
});
