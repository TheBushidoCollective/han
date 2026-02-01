/**
 * Hash Chain Unit Tests
 *
 * Tests for tamper-evident hash chain calculation and verification.
 */

import { describe, expect, test } from "bun:test";
import {
  calculateEventHash,
  verifyEntryHash,
  formatHash,
  parseHash,
  GENESIS_HASH,
} from "../lib/audit/hash-chain.ts";
import type { AuditEventInput } from "../lib/audit/types.ts";

describe("Hash Chain", () => {
  const sampleEvent: AuditEventInput = {
    userId: "user-123",
    teamId: "team-456",
    action: "session.view",
    resourceType: "session",
    resourceId: "session-789",
  };

  const sampleTimestamp = new Date("2024-01-15T10:30:00.000Z");

  describe("calculateEventHash", () => {
    test("produces consistent hash for same input", () => {
      const hash1 = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);
      const hash2 = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);

      expect(hash1.equals(hash2)).toBe(true);
    });

    test("produces different hash for different userId", () => {
      const event2: AuditEventInput = { ...sampleEvent, userId: "user-999" };

      const hash1 = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);
      const hash2 = calculateEventHash(event2, GENESIS_HASH, sampleTimestamp);

      expect(hash1.equals(hash2)).toBe(false);
    });

    test("produces different hash for different action", () => {
      const event2: AuditEventInput = { ...sampleEvent, action: "session.decrypt" };

      const hash1 = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);
      const hash2 = calculateEventHash(event2, GENESIS_HASH, sampleTimestamp);

      expect(hash1.equals(hash2)).toBe(false);
    });

    test("produces different hash for different timestamp", () => {
      const timestamp2 = new Date("2024-01-15T10:31:00.000Z");

      const hash1 = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);
      const hash2 = calculateEventHash(sampleEvent, GENESIS_HASH, timestamp2);

      expect(hash1.equals(hash2)).toBe(false);
    });

    test("produces different hash for different prevHash", () => {
      const prevHash = Buffer.from("abcd".repeat(16), "hex");

      const hash1 = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);
      const hash2 = calculateEventHash(sampleEvent, prevHash, sampleTimestamp);

      expect(hash1.equals(hash2)).toBe(false);
    });

    test("handles null teamId", () => {
      const eventNoTeam: AuditEventInput = {
        userId: "user-123",
        action: "user.login",
        resourceType: "user",
      };

      const hash = calculateEventHash(eventNoTeam, GENESIS_HASH, sampleTimestamp);
      expect(hash.length).toBe(32); // SHA-256 is 32 bytes
    });

    test("handles null resourceId", () => {
      const eventNoResource: AuditEventInput = {
        userId: "user-123",
        action: "user.logout",
        resourceType: "user",
      };

      const hash = calculateEventHash(eventNoResource, GENESIS_HASH, sampleTimestamp);
      expect(hash.length).toBe(32);
    });

    test("produces 32-byte SHA-256 hash", () => {
      const hash = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);
      expect(hash.length).toBe(32);
    });

    // [SECURITY FIX - MEDIUM] Tests for ip_address, user_agent, metadata in hash
    test("produces different hash for different ipAddress", () => {
      const event1: AuditEventInput = { ...sampleEvent, ipAddress: "192.168.1.1" };
      const event2: AuditEventInput = { ...sampleEvent, ipAddress: "10.0.0.1" };

      const hash1 = calculateEventHash(event1, GENESIS_HASH, sampleTimestamp);
      const hash2 = calculateEventHash(event2, GENESIS_HASH, sampleTimestamp);

      expect(hash1.equals(hash2)).toBe(false);
    });

    test("produces different hash for different userAgent", () => {
      const event1: AuditEventInput = { ...sampleEvent, userAgent: "Chrome/120" };
      const event2: AuditEventInput = { ...sampleEvent, userAgent: "Firefox/121" };

      const hash1 = calculateEventHash(event1, GENESIS_HASH, sampleTimestamp);
      const hash2 = calculateEventHash(event2, GENESIS_HASH, sampleTimestamp);

      expect(hash1.equals(hash2)).toBe(false);
    });

    test("produces different hash for different metadata", () => {
      const event1: AuditEventInput = { ...sampleEvent, metadata: { key: "value1" } };
      const event2: AuditEventInput = { ...sampleEvent, metadata: { key: "value2" } };

      const hash1 = calculateEventHash(event1, GENESIS_HASH, sampleTimestamp);
      const hash2 = calculateEventHash(event2, GENESIS_HASH, sampleTimestamp);

      expect(hash1.equals(hash2)).toBe(false);
    });

    test("produces consistent hash for metadata with different key order", () => {
      // Metadata key order should not affect hash (canonical serialization)
      const event1: AuditEventInput = { ...sampleEvent, metadata: { a: 1, b: 2, c: 3 } };
      const event2: AuditEventInput = { ...sampleEvent, metadata: { c: 3, a: 1, b: 2 } };

      const hash1 = calculateEventHash(event1, GENESIS_HASH, sampleTimestamp);
      const hash2 = calculateEventHash(event2, GENESIS_HASH, sampleTimestamp);

      expect(hash1.equals(hash2)).toBe(true);
    });

    test("handles empty metadata consistently", () => {
      const event1: AuditEventInput = { ...sampleEvent, metadata: {} };
      const event2: AuditEventInput = { ...sampleEvent }; // undefined metadata

      const hash1 = calculateEventHash(event1, GENESIS_HASH, sampleTimestamp);
      const hash2 = calculateEventHash(event2, GENESIS_HASH, sampleTimestamp);

      expect(hash1.equals(hash2)).toBe(true);
    });
  });

  describe("verifyEntryHash", () => {
    test("returns true for valid hash", () => {
      const eventHash = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);

      const entry = {
        userId: sampleEvent.userId,
        teamId: sampleEvent.teamId ?? null,
        action: sampleEvent.action,
        resourceType: sampleEvent.resourceType,
        resourceId: sampleEvent.resourceId ?? null,
        createdAt: sampleTimestamp,
        eventHash,
      };

      expect(verifyEntryHash(entry, GENESIS_HASH)).toBe(true);
    });

    test("returns false for tampered userId", () => {
      const eventHash = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);

      const entry = {
        userId: "tampered-user", // Tampered!
        teamId: sampleEvent.teamId ?? null,
        action: sampleEvent.action,
        resourceType: sampleEvent.resourceType,
        resourceId: sampleEvent.resourceId ?? null,
        createdAt: sampleTimestamp,
        eventHash,
      };

      expect(verifyEntryHash(entry, GENESIS_HASH)).toBe(false);
    });

    test("returns false for tampered action", () => {
      const eventHash = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);

      const entry = {
        userId: sampleEvent.userId,
        teamId: sampleEvent.teamId ?? null,
        action: "session.decrypt", // Tampered!
        resourceType: sampleEvent.resourceType,
        resourceId: sampleEvent.resourceId ?? null,
        createdAt: sampleTimestamp,
        eventHash,
      };

      expect(verifyEntryHash(entry, GENESIS_HASH)).toBe(false);
    });

    test("returns false for tampered timestamp", () => {
      const eventHash = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);

      const entry = {
        userId: sampleEvent.userId,
        teamId: sampleEvent.teamId ?? null,
        action: sampleEvent.action,
        resourceType: sampleEvent.resourceType,
        resourceId: sampleEvent.resourceId ?? null,
        createdAt: new Date("2024-12-31T23:59:59.000Z"), // Tampered!
        eventHash,
      };

      expect(verifyEntryHash(entry, GENESIS_HASH)).toBe(false);
    });

    test("returns false for wrong prevHash", () => {
      const eventHash = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);
      const wrongPrevHash = Buffer.from("wrong".padEnd(64, "0"), "hex");

      const entry = {
        userId: sampleEvent.userId,
        teamId: sampleEvent.teamId ?? null,
        action: sampleEvent.action,
        resourceType: sampleEvent.resourceType,
        resourceId: sampleEvent.resourceId ?? null,
        createdAt: sampleTimestamp,
        eventHash,
      };

      expect(verifyEntryHash(entry, wrongPrevHash)).toBe(false);
    });

    // [SECURITY FIX - MEDIUM] Tests for ip_address, user_agent, metadata in hash
    test("returns false for tampered ipAddress", () => {
      const eventWithIp: AuditEventInput = {
        ...sampleEvent,
        ipAddress: "192.168.1.1",
      };
      const eventHash = calculateEventHash(eventWithIp, GENESIS_HASH, sampleTimestamp);

      const entry = {
        userId: eventWithIp.userId,
        teamId: eventWithIp.teamId ?? null,
        action: eventWithIp.action,
        resourceType: eventWithIp.resourceType,
        resourceId: eventWithIp.resourceId ?? null,
        ipAddress: "10.0.0.1", // Tampered!
        createdAt: sampleTimestamp,
        eventHash,
      };

      expect(verifyEntryHash(entry, GENESIS_HASH)).toBe(false);
    });

    test("returns false for tampered userAgent", () => {
      const eventWithAgent: AuditEventInput = {
        ...sampleEvent,
        userAgent: "Claude Code CLI/1.0",
      };
      const eventHash = calculateEventHash(eventWithAgent, GENESIS_HASH, sampleTimestamp);

      const entry = {
        userId: eventWithAgent.userId,
        teamId: eventWithAgent.teamId ?? null,
        action: eventWithAgent.action,
        resourceType: eventWithAgent.resourceType,
        resourceId: eventWithAgent.resourceId ?? null,
        userAgent: "Malicious Bot/1.0", // Tampered!
        createdAt: sampleTimestamp,
        eventHash,
      };

      expect(verifyEntryHash(entry, GENESIS_HASH)).toBe(false);
    });

    test("returns false for tampered metadata", () => {
      const eventWithMeta: AuditEventInput = {
        ...sampleEvent,
        metadata: { source: "web", requestId: "abc123" },
      };
      const eventHash = calculateEventHash(eventWithMeta, GENESIS_HASH, sampleTimestamp);

      const entry = {
        userId: eventWithMeta.userId,
        teamId: eventWithMeta.teamId ?? null,
        action: eventWithMeta.action,
        resourceType: eventWithMeta.resourceType,
        resourceId: eventWithMeta.resourceId ?? null,
        metadata: { source: "api", requestId: "xyz789" }, // Tampered!
        createdAt: sampleTimestamp,
        eventHash,
      };

      expect(verifyEntryHash(entry, GENESIS_HASH)).toBe(false);
    });

    test("verifies entry with all optional fields", () => {
      const fullEvent: AuditEventInput = {
        ...sampleEvent,
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        metadata: { nested: { key: "value" }, array: [1, 2, 3] },
      };
      const eventHash = calculateEventHash(fullEvent, GENESIS_HASH, sampleTimestamp);

      const entry = {
        userId: fullEvent.userId,
        teamId: fullEvent.teamId ?? null,
        action: fullEvent.action,
        resourceType: fullEvent.resourceType,
        resourceId: fullEvent.resourceId ?? null,
        ipAddress: fullEvent.ipAddress ?? null,
        userAgent: fullEvent.userAgent ?? null,
        metadata: fullEvent.metadata,
        createdAt: sampleTimestamp,
        eventHash,
      };

      expect(verifyEntryHash(entry, GENESIS_HASH)).toBe(true);
    });
  });

  describe("formatHash and parseHash", () => {
    test("formatHash converts buffer to hex string", () => {
      const hex = formatHash(GENESIS_HASH);
      expect(hex).toBe("0".repeat(64));
    });

    test("parseHash converts hex string to buffer", () => {
      const buffer = parseHash("0".repeat(64));
      expect(buffer.equals(GENESIS_HASH)).toBe(true);
    });

    test("roundtrip preserves data", () => {
      const hash = calculateEventHash(sampleEvent, GENESIS_HASH, sampleTimestamp);
      const hex = formatHash(hash);
      const parsed = parseHash(hex);

      expect(parsed.equals(hash)).toBe(true);
    });
  });

  describe("GENESIS_HASH", () => {
    test("is 32 bytes of zeros", () => {
      expect(GENESIS_HASH.length).toBe(32);
      expect(GENESIS_HASH.every((b) => b === 0)).toBe(true);
    });
  });

  describe("Chain integrity", () => {
    test("simulates valid chain of entries", () => {
      const entries: Array<{
        event: AuditEventInput;
        timestamp: Date;
        hash: Buffer;
        prevHash: Buffer;
      }> = [];

      // Create a chain of 5 entries
      for (let i = 0; i < 5; i++) {
        const prevHash = entries.length > 0 ? entries[entries.length - 1].hash : GENESIS_HASH;
        const event: AuditEventInput = {
          userId: `user-${i}`,
          action: "session.view",
          resourceType: "session",
          resourceId: `session-${i}`,
        };
        const timestamp = new Date(`2024-01-15T10:0${i}:00.000Z`);
        const hash = calculateEventHash(event, prevHash, timestamp);

        entries.push({ event, timestamp, hash, prevHash });
      }

      // Verify each entry
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const storedEntry = {
          userId: entry.event.userId,
          teamId: entry.event.teamId ?? null,
          action: entry.event.action,
          resourceType: entry.event.resourceType,
          resourceId: entry.event.resourceId ?? null,
          createdAt: entry.timestamp,
          eventHash: entry.hash,
        };

        expect(verifyEntryHash(storedEntry, entry.prevHash)).toBe(true);
      }
    });

    test("detects tampering in middle of chain", () => {
      const entries: Array<{
        event: AuditEventInput;
        timestamp: Date;
        hash: Buffer;
        prevHash: Buffer;
      }> = [];

      // Create a chain of 5 entries
      for (let i = 0; i < 5; i++) {
        const prevHash = entries.length > 0 ? entries[entries.length - 1].hash : GENESIS_HASH;
        const event: AuditEventInput = {
          userId: `user-${i}`,
          action: "session.view",
          resourceType: "session",
          resourceId: `session-${i}`,
        };
        const timestamp = new Date(`2024-01-15T10:0${i}:00.000Z`);
        const hash = calculateEventHash(event, prevHash, timestamp);

        entries.push({ event, timestamp, hash, prevHash });
      }

      // Tamper with entry at index 2
      entries[2].event.userId = "hacker";

      // Entry 0, 1 should still verify
      for (let i = 0; i < 2; i++) {
        const entry = entries[i];
        const storedEntry = {
          userId: entry.event.userId,
          teamId: entry.event.teamId ?? null,
          action: entry.event.action,
          resourceType: entry.event.resourceType,
          resourceId: entry.event.resourceId ?? null,
          createdAt: entry.timestamp,
          eventHash: entry.hash,
        };
        expect(verifyEntryHash(storedEntry, entry.prevHash)).toBe(true);
      }

      // Entry 2 should fail verification
      const tamperedEntry = entries[2];
      const storedTampered = {
        userId: tamperedEntry.event.userId, // "hacker"
        teamId: tamperedEntry.event.teamId ?? null,
        action: tamperedEntry.event.action,
        resourceType: tamperedEntry.event.resourceType,
        resourceId: tamperedEntry.event.resourceId ?? null,
        createdAt: tamperedEntry.timestamp,
        eventHash: tamperedEntry.hash, // Original hash
      };

      expect(verifyEntryHash(storedTampered, tamperedEntry.prevHash)).toBe(false);
    });
  });
});
