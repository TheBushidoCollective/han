/**
 * Performance Benchmarks for Secret Detection
 *
 * Verifies that detection performance meets requirements:
 * - <50ms for 100KB content
 */

import { describe, it, expect } from "bun:test";
import { SecretDetector } from "../../lib/security/index.ts";

describe("Performance Benchmarks", () => {
  /**
   * Generate random alphanumeric string
   */
  function randomString(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate content with realistic structure and some secrets
   */
  function generateRealisticContent(sizeKB: number): string {
    const targetSize = sizeKB * 1024;
    const lines: string[] = [];

    // Add some realistic secrets (using obviously fake patterns to avoid GitHub secret scanning)
    const secrets = [
      'AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"',
      'GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"',
      'DATABASE_URL = "postgres://user:password@localhost:5432/db"',
      'STRIPE_KEY = "api_key_4eC39HqLyjWDarjtT1zdp7dc"',
      "-----BEGIN RSA PRIVATE KEY-----",
      "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
    ];

    // Add secrets at various positions
    secrets.forEach((secret) => lines.push(secret));

    // Fill with realistic code-like content
    while (lines.join("\n").length < targetSize) {
      const lineTypes = [
        `const ${randomString(8)} = "${randomString(20)}";`,
        `function ${randomString(10)}() { return ${Math.random()}; }`,
        `// Comment: ${randomString(30)}`,
        `import { ${randomString(8)} } from './${randomString(12)}';`,
        `export default { key: "${randomString(16)}", value: ${Math.floor(Math.random() * 1000)} };`,
        `if (${randomString(6)} === "${randomString(12)}") { console.log("${randomString(20)}"); }`,
        `const data = { id: "${randomString(8)}", name: "${randomString(15)}" };`,
        "",
      ];

      const lineType = lineTypes[Math.floor(Math.random() * lineTypes.length)];
      lines.push(lineType);
    }

    return lines.join("\n");
  }

  describe("100KB Content Benchmark", () => {
    it("should scan 100KB content in under 50ms", () => {
      const content = generateRealisticContent(100);
      expect(content.length).toBeGreaterThan(100 * 1024 * 0.9); // ~100KB

      const detector = new SecretDetector();

      // Warm up
      detector.scan(content.slice(0, 1000));

      // Benchmark
      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        detector.scan(content);
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      console.log(`100KB scan performance (${iterations} iterations):`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);

      // Requirement: <50ms
      expect(avgTime).toBeLessThan(50);
    });

    it("should detect secrets in 100KB content", () => {
      const content = generateRealisticContent(100);
      const detector = new SecretDetector();

      const result = detector.scan(content);

      // Should find the embedded secrets
      expect(result.secrets.length).toBeGreaterThan(0);

      // Should find specific types
      const types = new Set(result.secrets.map((d) => d.type));
      expect(types.size).toBeGreaterThan(1);
    });
  });

  describe("Scaling Performance", () => {
    it("should scale linearly with content size", () => {
      const detector = new SecretDetector();
      const sizes = [10, 25, 50, 100]; // KB
      const results: Array<{ size: number; time: number }> = [];

      for (const size of sizes) {
        const content = generateRealisticContent(size);
        const start = performance.now();
        detector.scan(content);
        const end = performance.now();
        results.push({ size, time: end - start });
      }

      console.log("Scaling performance:");
      results.forEach((r) => {
        console.log(`  ${r.size}KB: ${r.time.toFixed(2)}ms`);
      });

      // Check roughly linear scaling (allow 3x ratio for 10x size increase)
      const ratio = results[3].time / results[0].time;
      expect(ratio).toBeLessThan(30); // 10KB -> 100KB should not be more than 30x slower
    });
  });

  describe("Redaction Performance", () => {
    it("should redact 100KB content quickly", () => {
      const content = generateRealisticContent(100);
      const detector = new SecretDetector();

      const start = performance.now();
      const redacted = detector.redact(content);
      const end = performance.now();

      console.log(`100KB redaction time: ${(end - start).toFixed(2)}ms`);

      // Redaction should also be fast (includes scan + replace)
      expect(end - start).toBeLessThan(100);

      // Should have produced redacted content
      expect(redacted).toContain("[REDACTED]");
    });
  });

  describe("hasSecrets Performance", () => {
    it("should quickly check for secrets (early exit)", () => {
      const content = generateRealisticContent(100);
      const detector = new SecretDetector();

      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        detector.hasSecrets(content);
        const end = performance.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`hasSecrets() average time: ${avgTime.toFixed(3)}ms`);

      // Quick check should be much faster than full scan
      expect(avgTime).toBeLessThan(5);
    });

    it("should return quickly for content without secrets", () => {
      const safeContent = "a".repeat(100 * 1024); // 100KB of 'a'
      const detector = new SecretDetector();

      const start = performance.now();
      const hasSecrets = detector.hasSecrets(safeContent);
      const end = performance.now();

      expect(hasSecrets).toBe(false);
      expect(end - start).toBeLessThan(10);
    });
  });

  describe("Memory Efficiency", () => {
    it("should not create excessive intermediate objects", () => {
      const content = generateRealisticContent(100);
      const detector = new SecretDetector();

      // Run GC if available
      if (typeof globalThis.gc === "function") {
        globalThis.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Run multiple scans
      for (let i = 0; i < 10; i++) {
        detector.scan(content);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024);

      console.log(`Memory increase after 10 scans: ${memoryIncrease.toFixed(2)}MB`);

      // Memory increase should be reasonable
      // (allowing for normal GC behavior)
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });

  describe("Edge Cases Performance", () => {
    it("should handle empty content quickly", () => {
      const detector = new SecretDetector();

      const start = performance.now();
      detector.scan("");
      const end = performance.now();

      expect(end - start).toBeLessThan(1);
    });

    it("should handle content with many matches quickly", () => {
      // Content with many secrets
      const secrets = Array(100)
        .fill(null)
        .map((_, i) => `AWS_KEY_${i}=AKIAIOSFODNN7EXAMPL${i.toString().padStart(1, "0")}`)
        .join("\n");

      const detector = new SecretDetector();

      const start = performance.now();
      const result = detector.scan(secrets);
      const end = performance.now();

      console.log(`100 secrets scan time: ${(end - start).toFixed(2)}ms`);
      console.log(`Detections found: ${result.secrets.length}`);

      expect(end - start).toBeLessThan(50);
      expect(result.secrets.length).toBeGreaterThan(50);
    });
  });
});
