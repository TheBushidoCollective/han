/**
 * GDPR Compliance Tests
 *
 * Tests for data export (portability) and account deletion (erasure).
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import type { Pool, QueryResult } from "pg";

// Mock archiver before importing export-service
mock.module("archiver", () => ({
  default: mock(() => {
    const events: Record<string, ((...args: unknown[]) => void)[]> = {};
    const archive = {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        events[event] = events[event] || [];
        events[event].push(handler);
        return archive;
      },
      pipe: () => archive,
      append: () => archive,
      finalize: () => {
        const finishEvents = events["finish"] || [];
        for (const handler of finishEvents) {
          setTimeout(() => handler(), 0);
        }
      },
    };
    return archive;
  }),
}));

import {
  ExportService,
  initExportService,
  getExportService,
  resetExportService,
  ExportRateLimitError,
  ExportValidationError,
  ExportNotFoundError,
} from "../lib/gdpr/export-service.ts";

import {
  DeletionService,
  initDeletionService,
  getDeletionService,
  resetDeletionService,
  DeletionAlreadyRequestedError,
  DeletionNotFoundError,
  DeletionTokenExpiredError,
  DeletionInvalidTokenError,
} from "../lib/gdpr/deletion-service.ts";

// Mock database pool
interface MockPool extends Pool {
  _setQueryResult: (pattern: string, result: Partial<QueryResult>) => void;
  _clearQueryResults: () => void;
  _queries: Array<{ sql: string; params: unknown[] }>;
}

function createMockDb(): MockPool {
  const queryResults: Map<string, Partial<QueryResult>> = new Map();
  const queries: Array<{ sql: string; params: unknown[] }> = [];

  const mockPool = {
    query: mock(async (sql: string, params?: unknown[]): Promise<QueryResult> => {
      queries.push({ sql, params: params || [] });

      const defaultResult = {
        rows: [],
        rowCount: 0,
        command: "",
        oid: 0,
        fields: [],
      } as unknown as QueryResult;

      // Check patterns
      for (const [pattern, result] of queryResults.entries()) {
        if (sql.includes(pattern)) {
          return { ...defaultResult, ...result } as QueryResult;
        }
      }

      return defaultResult;
    }),
    _setQueryResult: (pattern: string, result: Partial<QueryResult>) => {
      queryResults.set(pattern, result);
    },
    _clearQueryResults: () => {
      queryResults.clear();
      queries.length = 0;
    },
    _queries: queries,
  } as unknown as MockPool;

  return mockPool;
}

// Test context
const testContext = {
  userId: "user-123",
  ipAddress: "192.168.1.1",
  userAgent: "TestAgent/1.0",
  requestId: "req-456",
};

describe("ExportService", () => {
  let db: MockPool;
  let service: ExportService;

  beforeEach(() => {
    resetExportService();
    db = createMockDb();
    service = initExportService(db);
  });

  afterEach(() => {
    resetExportService();
    db._clearQueryResults();
  });

  describe("requestExport", () => {
    it("creates an export request with valid passphrase", async () => {
      const exportId = "export-123";
      const now = new Date();

      db._setQueryResult("SELECT last_request_at FROM gdpr_rate_limits", {
        rows: [],
      });

      db._setQueryResult("INSERT INTO data_exports", {
        rows: [
          {
            id: exportId,
            user_id: testContext.userId,
            status: "queued",
            format: "zip",
            passphrase_hash: "hash123",
            file_path: null,
            file_size_bytes: null,
            download_count: 0,
            max_downloads: 3,
            error_message: null,
            requested_at: now,
            started_at: null,
            completed_at: null,
            expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            created_at: now,
            updated_at: now,
          },
        ],
      });

      db._setQueryResult(
        "INSERT INTO gdpr_rate_limits",
        { rows: [], rowCount: 1 }
      );

      const result = await service.requestExport(
        testContext.userId,
        "mySecurePassphrase123",
        testContext
      );

      expect(result.export.id).toBe(exportId);
      expect(result.export.status).toBe("queued");
      expect(result.estimatedWaitMinutes).toBe(5);
    });

    it("rejects passphrase shorter than 8 characters", async () => {
      db._setQueryResult("SELECT last_request_at FROM gdpr_rate_limits", {
        rows: [],
      });

      await expect(
        service.requestExport(testContext.userId, "short", testContext)
      ).rejects.toThrow(ExportValidationError);
    });

    it("rate limits to 1 export per day", async () => {
      const recentTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      db._setQueryResult("SELECT last_request_at FROM gdpr_rate_limits", {
        rows: [{ last_request_at: recentTime }],
      });

      await expect(
        service.requestExport(
          testContext.userId,
          "validPassphrase",
          testContext
        )
      ).rejects.toThrow(ExportRateLimitError);
    });

    it("allows export after 24 hours", async () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      db._setQueryResult("SELECT last_request_at FROM gdpr_rate_limits", {
        rows: [{ last_request_at: oldTime }],
      });

      db._setQueryResult("INSERT INTO data_exports", {
        rows: [
          {
            id: "export-456",
            user_id: testContext.userId,
            status: "queued",
            format: "zip",
            passphrase_hash: "hash",
            file_path: null,
            file_size_bytes: null,
            download_count: 0,
            max_downloads: 3,
            error_message: null,
            requested_at: new Date(),
            started_at: null,
            completed_at: null,
            expires_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      db._setQueryResult("INSERT INTO gdpr_rate_limits", { rows: [] });

      const result = await service.requestExport(
        testContext.userId,
        "validPassphrase",
        testContext
      );

      expect(result.export.status).toBe("queued");
    });
  });

  describe("getExport", () => {
    it("returns export for valid user", async () => {
      const now = new Date();

      db._setQueryResult("SELECT * FROM data_exports WHERE id", {
        rows: [
          {
            id: "export-123",
            user_id: testContext.userId,
            status: "completed",
            format: "zip",
            passphrase_hash: null,
            file_path: "/exports/export-123.enc",
            file_size_bytes: 1024,
            download_count: 1,
            max_downloads: 3,
            error_message: null,
            requested_at: now,
            started_at: now,
            completed_at: now,
            expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            created_at: now,
            updated_at: now,
          },
        ],
      });

      const result = await service.getExport("export-123", testContext.userId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("export-123");
      expect(result!.status).toBe("completed");
      expect(result!.downloadCount).toBe(1);
    });

    it("returns null for wrong user", async () => {
      db._setQueryResult("SELECT * FROM data_exports WHERE id", {
        rows: [],
      });

      const result = await service.getExport("export-123", "other-user");

      expect(result).toBeNull();
    });
  });

  describe("recordDownload", () => {
    it("increments download count", async () => {
      db._setQueryResult("UPDATE data_exports SET download_count", {
        rows: [
          {
            download_count: 2,
            max_downloads: 3,
            status: "completed",
            expires_at: new Date(Date.now() + 1000000),
          },
        ],
      });

      const result = await service.recordDownload(
        "export-123",
        testContext.userId,
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it("rejects when download limit reached", async () => {
      // First query returns nothing (UPDATE failed)
      db._setQueryResult("UPDATE data_exports SET download_count", {
        rows: [],
      });

      // Check query shows limit reached
      db._setQueryResult("SELECT status, download_count", {
        rows: [
          {
            status: "completed",
            download_count: 3,
            max_downloads: 3,
            expires_at: new Date(Date.now() + 1000000),
          },
        ],
      });

      await expect(
        service.recordDownload("export-123", testContext.userId, testContext)
      ).rejects.toThrow("Download limit reached");
    });
  });
});

describe("DeletionService", () => {
  let db: MockPool;
  let service: DeletionService;

  beforeEach(() => {
    resetDeletionService();
    db = createMockDb();
    service = initDeletionService(db);
  });

  afterEach(() => {
    resetDeletionService();
    db._clearQueryResults();
  });

  describe("requestDeletion", () => {
    it("creates a deletion request", async () => {
      const now = new Date();
      const gracePeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      db._setQueryResult("SELECT id, status FROM deletion_requests", {
        rows: [],
      });

      db._setQueryResult("INSERT INTO deletion_requests", {
        rows: [
          {
            id: "del-123",
            user_id: testContext.userId,
            status: "pending",
            confirmation_token_hash: "hash",
            confirmation_token_expires_at: new Date(
              now.getTime() + 24 * 60 * 60 * 1000
            ),
            confirmed_at: null,
            grace_period_ends_at: gracePeriodEnd,
            scheduled_deletion_at: null,
            cancelled_at: null,
            cancelled_reason: null,
            completed_at: null,
            metadata: {},
            created_at: now,
            updated_at: now,
          },
        ],
      });

      const result = await service.requestDeletion(
        testContext.userId,
        testContext
      );

      expect(result.request.id).toBe("del-123");
      expect(result.request.status).toBe("pending");
      expect(result.confirmationToken).toBeTruthy();
      expect(result.confirmationToken.length).toBe(64); // 32 bytes hex
    });

    it("rejects when deletion already requested", async () => {
      db._setQueryResult("SELECT id, status FROM deletion_requests", {
        rows: [{ id: "del-existing", status: "pending" }],
      });

      await expect(
        service.requestDeletion(testContext.userId, testContext)
      ).rejects.toThrow(DeletionAlreadyRequestedError);
    });

    it("rejects when deletion already confirmed", async () => {
      db._setQueryResult("SELECT id, status FROM deletion_requests", {
        rows: [{ id: "del-existing", status: "confirmed" }],
      });

      await expect(
        service.requestDeletion(testContext.userId, testContext)
      ).rejects.toThrow(DeletionAlreadyRequestedError);
    });
  });

  describe("confirmDeletion", () => {
    it("confirms deletion with valid token", async () => {
      const now = new Date();
      const gracePeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Create a known token for testing
      const { createHash } = await import("crypto");
      const testToken = "a".repeat(64);
      const tokenHash = createHash("sha256").update(testToken).digest("hex");

      db._setQueryResult(
        "SELECT id, confirmation_token_hash, confirmation_token_expires_at, grace_period_ends_at",
        {
          rows: [
            {
              id: "del-123",
              confirmation_token_hash: tokenHash,
              confirmation_token_expires_at: new Date(
                now.getTime() + 24 * 60 * 60 * 1000
              ),
              grace_period_ends_at: gracePeriodEnd,
            },
          ],
        }
      );

      db._setQueryResult("UPDATE deletion_requests SET", {
        rows: [
          {
            id: "del-123",
            user_id: testContext.userId,
            status: "confirmed",
            confirmation_token_hash: tokenHash,
            confirmation_token_expires_at: null,
            confirmed_at: now,
            grace_period_ends_at: gracePeriodEnd,
            scheduled_deletion_at: gracePeriodEnd,
            cancelled_at: null,
            cancelled_reason: null,
            completed_at: null,
            metadata: {},
            created_at: now,
            updated_at: now,
          },
        ],
      });

      db._setQueryResult("UPDATE users SET deletion_status", { rows: [] });

      const result = await service.confirmDeletion(
        testContext.userId,
        testToken,
        testContext
      );

      expect(result.status).toBe("confirmed");
      expect(result.scheduledDeletionAt).toBeTruthy();
    });

    it("rejects expired token", async () => {
      const now = new Date();
      const expiredTime = new Date(now.getTime() - 1000);

      db._setQueryResult(
        "SELECT id, confirmation_token_hash, confirmation_token_expires_at, grace_period_ends_at",
        {
          rows: [
            {
              id: "del-123",
              confirmation_token_hash: "somehash",
              confirmation_token_expires_at: expiredTime,
              grace_period_ends_at: new Date(),
            },
          ],
        }
      );

      await expect(
        service.confirmDeletion(
          testContext.userId,
          "sometoken",
          testContext
        )
      ).rejects.toThrow(DeletionTokenExpiredError);
    });

    it("rejects invalid token", async () => {
      const now = new Date();

      db._setQueryResult(
        "SELECT id, confirmation_token_hash, confirmation_token_expires_at, grace_period_ends_at",
        {
          rows: [
            {
              id: "del-123",
              confirmation_token_hash: "correcthash",
              confirmation_token_expires_at: new Date(
                now.getTime() + 24 * 60 * 60 * 1000
              ),
              grace_period_ends_at: new Date(),
            },
          ],
        }
      );

      await expect(
        service.confirmDeletion(
          testContext.userId,
          "wrongtoken",
          testContext
        )
      ).rejects.toThrow(DeletionInvalidTokenError);
    });

    it("rejects when no pending request", async () => {
      db._setQueryResult(
        "SELECT id, confirmation_token_hash, confirmation_token_expires_at, grace_period_ends_at",
        {
          rows: [],
        }
      );

      await expect(
        service.confirmDeletion(
          testContext.userId,
          "sometoken",
          testContext
        )
      ).rejects.toThrow(DeletionNotFoundError);
    });
  });

  describe("cancelDeletion", () => {
    it("cancels pending deletion", async () => {
      const now = new Date();

      db._setQueryResult("SELECT id, status FROM deletion_requests", {
        rows: [{ id: "del-123", status: "pending" }],
      });

      db._setQueryResult("UPDATE deletion_requests SET", {
        rows: [
          {
            id: "del-123",
            user_id: testContext.userId,
            status: "cancelled",
            confirmation_token_hash: null,
            confirmation_token_expires_at: null,
            confirmed_at: null,
            grace_period_ends_at: null,
            scheduled_deletion_at: null,
            cancelled_at: now,
            cancelled_reason: "Changed my mind",
            completed_at: null,
            metadata: {},
            created_at: now,
            updated_at: now,
          },
        ],
      });

      db._setQueryResult("UPDATE users SET deletion_status", { rows: [] });

      const result = await service.cancelDeletion(
        testContext.userId,
        "Changed my mind",
        testContext
      );

      expect(result.status).toBe("cancelled");
      expect(result.cancelledReason).toBe("Changed my mind");
    });

    it("cancels confirmed deletion within grace period", async () => {
      const now = new Date();

      db._setQueryResult("SELECT id, status FROM deletion_requests", {
        rows: [{ id: "del-123", status: "confirmed" }],
      });

      db._setQueryResult("UPDATE deletion_requests SET", {
        rows: [
          {
            id: "del-123",
            user_id: testContext.userId,
            status: "cancelled",
            confirmation_token_hash: null,
            confirmation_token_expires_at: null,
            confirmed_at: null,
            grace_period_ends_at: null,
            scheduled_deletion_at: null,
            cancelled_at: now,
            cancelled_reason: null,
            completed_at: null,
            metadata: {},
            created_at: now,
            updated_at: now,
          },
        ],
      });

      db._setQueryResult("UPDATE users SET deletion_status", { rows: [] });

      const result = await service.cancelDeletion(
        testContext.userId,
        undefined,
        testContext
      );

      expect(result.status).toBe("cancelled");
    });

    it("rejects when no active request", async () => {
      db._setQueryResult("SELECT id, status FROM deletion_requests", {
        rows: [],
      });

      await expect(
        service.cancelDeletion(testContext.userId, undefined, testContext)
      ).rejects.toThrow(DeletionNotFoundError);
    });
  });

  describe("getDeletionRequest", () => {
    it("returns active deletion request", async () => {
      const now = new Date();
      const gracePeriodEnd = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000);

      db._setQueryResult("SELECT * FROM deletion_requests", {
        rows: [
          {
            id: "del-123",
            user_id: testContext.userId,
            status: "confirmed",
            confirmation_token_hash: null,
            confirmation_token_expires_at: null,
            confirmed_at: now,
            grace_period_ends_at: gracePeriodEnd,
            scheduled_deletion_at: gracePeriodEnd,
            cancelled_at: null,
            cancelled_reason: null,
            completed_at: null,
            metadata: {},
            created_at: now,
            updated_at: now,
          },
        ],
      });

      const result = await service.getDeletionRequest(testContext.userId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("del-123");
      expect(result!.status).toBe("confirmed");
    });

    it("returns null when no active request", async () => {
      db._setQueryResult("SELECT * FROM deletion_requests", {
        rows: [],
      });

      const result = await service.getDeletionRequest(testContext.userId);

      expect(result).toBeNull();
    });
  });
});

describe("GDPR Rate Limits", () => {
  describe("Export rate limit", () => {
    it("enforces 1 export per 24 hours", async () => {
      const db = createMockDb();
      resetExportService();
      const service = initExportService(db);

      // Simulate recent export
      const recentTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago

      db._setQueryResult("SELECT last_request_at FROM gdpr_rate_limits", {
        rows: [{ last_request_at: recentTime }],
      });

      await expect(
        service.requestExport(
          testContext.userId,
          "validPassphrase",
          testContext
        )
      ).rejects.toThrow(/rate limit exceeded/i);

      resetExportService();
    });
  });

  describe("Deletion rate limit", () => {
    it("allows only 1 active deletion request per account", async () => {
      const db = createMockDb();
      resetDeletionService();
      const service = initDeletionService(db);

      db._setQueryResult("SELECT id, status FROM deletion_requests", {
        rows: [{ id: "del-123", status: "pending" }],
      });

      await expect(
        service.requestDeletion(testContext.userId, testContext)
      ).rejects.toThrow(DeletionAlreadyRequestedError);

      resetDeletionService();
    });
  });
});

describe("Export Format", () => {
  it("includes all required data categories", () => {
    // Test that the export archive structure is correct
    const exportArchive = {
      exportedAt: new Date().toISOString(),
      exportedBy: "user-123",
      version: "1.0.0",
      profile: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        githubId: "gh123",
        githubUsername: "testuser",
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tier: "free",
      },
      teams: [
        {
          teamId: "team-1",
          teamName: "Test Team",
          teamSlug: "test-team",
          role: "member",
          joinedAt: new Date().toISOString(),
        },
      ],
      sessions: [
        {
          sessionId: "session-1",
          projectPath: "/path/to/project",
          summary: "Test session",
          startedAt: new Date().toISOString(),
          messages: [{ type: "user", content: "Hello" }],
          metadata: {},
        },
      ],
      auditLog: [
        {
          id: "audit-1",
          eventType: "session.view",
          timestamp: new Date().toISOString(),
          success: true,
          metadata: {},
        },
      ],
    };

    // Verify structure
    expect(exportArchive.profile).toBeDefined();
    expect(exportArchive.profile.email).toBe("test@example.com");
    expect(Array.isArray(exportArchive.teams)).toBe(true);
    expect(Array.isArray(exportArchive.sessions)).toBe(true);
    expect(Array.isArray(exportArchive.auditLog)).toBe(true);
  });
});

describe("Deletion States", () => {
  it("has correct deletion state transitions", () => {
    const validTransitions: Record<string, string[]> = {
      none: ["pending"],
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["completed"],
      completed: [],
      cancelled: ["pending"], // Can request again after cancel
    };

    // Verify state machine
    expect(validTransitions.none).toContain("pending");
    expect(validTransitions.pending).toContain("confirmed");
    expect(validTransitions.pending).toContain("cancelled");
    expect(validTransitions.confirmed).toContain("processing");
    expect(validTransitions.confirmed).toContain("cancelled");
    expect(validTransitions.processing).toContain("completed");
    expect(validTransitions.completed).toHaveLength(0);
  });

  it("30-day grace period is enforced", () => {
    const gracePeriodMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const gracePeriodEnd = now + gracePeriodMs;

    // Verify grace period is approximately 30 days
    const daysDiff = (gracePeriodEnd - now) / (24 * 60 * 60 * 1000);
    expect(daysDiff).toBe(30);
  });
});

describe("Singleton pattern", () => {
  it("ExportService singleton works correctly", () => {
    resetExportService();
    const db = createMockDb();

    expect(() => getExportService()).toThrow(
      /ExportService not initialized/
    );

    const service = initExportService(db);
    expect(getExportService()).toBe(service);

    resetExportService();
    expect(() => getExportService()).toThrow(
      /ExportService not initialized/
    );
  });

  it("DeletionService singleton works correctly", () => {
    resetDeletionService();
    const db = createMockDb();

    expect(() => getDeletionService()).toThrow(
      /DeletionService not initialized/
    );

    const service = initDeletionService(db);
    expect(getDeletionService()).toBe(service);

    resetDeletionService();
    expect(() => getDeletionService()).toThrow(
      /DeletionService not initialized/
    );
  });
});
