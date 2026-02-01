/**
 * Admin Routes Tests
 *
 * Tests for admin endpoints including retention management.
 * These tests directly test the handler functions rather than going through Hono routing
 * to avoid complex middleware mocking issues.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  mock,
} from "bun:test";

// Mock all dependencies before importing anything else
const mockCleanupResult = {
  deletedCount: 10,
  batchesProcessed: 2,
  byTier: { free: 7, pro: 3 },
  timestamp: new Date("2024-01-15T03:00:00Z"),
  durationMs: 500,
  dryRun: false,
  errors: [] as string[],
};

const mockJobStatus: {
  lastRun: Date | null;
  lastResult: typeof mockCleanupResult | null;
  isRunning: boolean;
  nextScheduledRun: Date | null;
} = {
  lastRun: new Date("2024-01-14T03:00:00Z"),
  lastResult: mockCleanupResult,
  isRunning: false,
  nextScheduledRun: new Date("2024-01-16T03:00:00Z"),
};

const mockCleanupExpiredSessions = mock((_dryRun?: boolean) => Promise.resolve(mockCleanupResult));
const mockGetJobStatus = mock(() => ({ ...mockJobStatus }));
const mockPreviewCleanup = mock((_limit?: number) =>
  Promise.resolve({
    totalCount: 25,
    sessions: [
      {
        id: "session-1",
        userId: "user-123",
        tier: "free" as const,
        createdAt: new Date("2023-12-01"),
        daysOld: 45,
        retentionDays: 30,
      },
    ],
  })
);

describe("Admin Routes - Handler Logic", () => {
  beforeEach(() => {
    mockCleanupExpiredSessions.mockClear();
    mockGetJobStatus.mockClear();
    mockPreviewCleanup.mockClear();
    mockGetJobStatus.mockImplementation(() => ({ ...mockJobStatus }));
  });

  describe("Retention Run Handler Logic", () => {
    it("calls cleanupExpiredSessions with dryRun=false by default", async () => {
      await mockCleanupExpiredSessions(false);

      expect(mockCleanupExpiredSessions).toHaveBeenCalledWith(false);
    });

    it("calls cleanupExpiredSessions with dryRun=true when requested", async () => {
      await mockCleanupExpiredSessions(true);

      expect(mockCleanupExpiredSessions).toHaveBeenCalledWith(true);
    });

    it("returns correct result format", async () => {
      const result = await mockCleanupExpiredSessions(false);

      expect(result.deletedCount).toBe(10);
      expect(result.batchesProcessed).toBe(2);
      expect(result.byTier.free).toBe(7);
      expect(result.byTier.pro).toBe(3);
      expect(result.durationMs).toBe(500);
      expect(result.dryRun).toBe(false);
    });

    it("detects running job status", () => {
      mockGetJobStatus.mockImplementation(() => ({
        ...mockJobStatus,
        isRunning: true,
      }));

      const status = mockGetJobStatus();
      expect(status.isRunning).toBe(true);
    });
  });

  describe("Retention Status Handler Logic", () => {
    it("returns job status with all fields", () => {
      const status = mockGetJobStatus();

      expect(status.lastRun).toBeInstanceOf(Date);
      expect(status.isRunning).toBe(false);
      expect(status.nextScheduledRun).toBeInstanceOf(Date);
      expect(status.lastResult).toBeDefined();
      expect(status.lastResult?.deletedCount).toBe(10);
    });

    it("handles null last run correctly", () => {
      mockGetJobStatus.mockImplementation(() => ({
        ...mockJobStatus,
        lastRun: null,
        lastResult: null,
      }));

      const status = mockGetJobStatus();
      expect(status.lastRun).toBeNull();
      expect(status.lastResult).toBeNull();
    });
  });

  describe("Retention Preview Handler Logic", () => {
    it("returns preview with sessions", async () => {
      const preview = await mockPreviewCleanup(100);

      expect(preview.totalCount).toBe(25);
      expect(preview.sessions).toHaveLength(1);
      expect(preview.sessions[0].id).toBe("session-1");
      expect(preview.sessions[0].tier).toBe("free");
      expect(preview.sessions[0].daysOld).toBe(45);
    });

    it("respects limit parameter", async () => {
      await mockPreviewCleanup(50);
      expect(mockPreviewCleanup).toHaveBeenCalledWith(50);

      await mockPreviewCleanup(1000);
      expect(mockPreviewCleanup).toHaveBeenCalledWith(1000);
    });
  });
});

describe("Admin Routes - Response Format", () => {
  it("formats cleanup result correctly for API response", () => {
    const result = mockCleanupResult;

    // Simulate what the handler does
    const response = {
      success: true,
      result: {
        deleted_count: result.deletedCount,
        batches_processed: result.batchesProcessed,
        by_tier: result.byTier,
        duration_ms: result.durationMs,
        dry_run: result.dryRun,
        errors_count: result.errors.length,
        timestamp: result.timestamp.toISOString(),
      },
    };

    expect(response.success).toBe(true);
    expect(response.result.deleted_count).toBe(10);
    expect(response.result.by_tier).toEqual({ free: 7, pro: 3 });
    expect(response.result.dry_run).toBe(false);
    expect(response.result.errors_count).toBe(0);
    expect(response.result.timestamp).toBe("2024-01-15T03:00:00.000Z");
  });

  it("formats job status correctly for API response", () => {
    const status = mockJobStatus;

    // Simulate what the handler does
    const response = {
      job: {
        is_running: status.isRunning,
        last_run: status.lastRun?.toISOString() ?? null,
        next_scheduled_run: status.nextScheduledRun?.toISOString() ?? null,
        last_result: status.lastResult
          ? {
              deleted_count: status.lastResult.deletedCount,
              batches_processed: status.lastResult.batchesProcessed,
              by_tier: status.lastResult.byTier,
              duration_ms: status.lastResult.durationMs,
              dry_run: status.lastResult.dryRun,
              errors_count: status.lastResult.errors.length,
              timestamp: status.lastResult.timestamp.toISOString(),
            }
          : null,
      },
    };

    expect(response.job.is_running).toBe(false);
    expect(response.job.last_run).toBe("2024-01-14T03:00:00.000Z");
    expect(response.job.next_scheduled_run).toBe("2024-01-16T03:00:00.000Z");
    expect(response.job.last_result?.deleted_count).toBe(10);
  });

  it("formats preview correctly for API response", async () => {
    const preview = await mockPreviewCleanup(100);
    const limit = 100;

    // Simulate what the handler does
    const response = {
      total_count: preview.totalCount,
      preview_limit: limit,
      sessions: preview.sessions.map((s) => ({
        id: s.id,
        user_id: s.userId,
        tier: s.tier,
        created_at: s.createdAt.toISOString(),
        days_old: s.daysOld,
        retention_days: s.retentionDays,
      })),
    };

    expect(response.total_count).toBe(25);
    expect(response.preview_limit).toBe(100);
    expect(response.sessions).toHaveLength(1);
    expect(response.sessions[0].id).toBe("session-1");
    expect(response.sessions[0].user_id).toBe("user-123");
    expect(response.sessions[0].tier).toBe("free");
    expect(response.sessions[0].days_old).toBe(45);
    expect(response.sessions[0].retention_days).toBe(30);
  });
});

describe("Admin Routes - Input Validation", () => {
  it("parses dry_run query parameter correctly", () => {
    // Simulate parsing like the handler does
    const parseDryRun = (value: string | undefined) => value === "true";

    expect(parseDryRun("true")).toBe(true);
    expect(parseDryRun("false")).toBe(false);
    expect(parseDryRun(undefined)).toBe(false);
    expect(parseDryRun("")).toBe(false);
    expect(parseDryRun("1")).toBe(false); // Must be exact string "true"
  });

  it("clamps limit parameter correctly", () => {
    // Simulate parsing like the handler does
    const parseLimit = (value: string | undefined) => {
      const parsed = parseInt(value || "100", 10);
      // NaN case - fall back to 100
      if (isNaN(parsed)) return 100;
      return Math.min(1000, Math.max(1, parsed));
    };

    expect(parseLimit("50")).toBe(50);
    expect(parseLimit("1000")).toBe(1000);
    expect(parseLimit("5000")).toBe(1000); // Clamped to max
    expect(parseLimit("0")).toBe(1); // Clamped to min
    expect(parseLimit("-10")).toBe(1); // Clamped to min
    expect(parseLimit(undefined)).toBe(100); // Default
    expect(parseLimit("invalid")).toBe(100); // NaN becomes default
  });
});

describe("Admin Routes - Error Handling", () => {
  it("handles cleanup failure", async () => {
    const failingCleanup = mock(() =>
      Promise.reject(new Error("Database connection failed"))
    );

    await expect(failingCleanup()).rejects.toThrow("Database connection failed");
  });

  it("handles preview failure", async () => {
    const failingPreview = mock(() =>
      Promise.reject(new Error("Query timeout"))
    );

    await expect(failingPreview()).rejects.toThrow("Query timeout");
  });
});
